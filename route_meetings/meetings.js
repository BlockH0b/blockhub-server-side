/*
 * ==================================================================
 * BlockHub Meetings  -  /meetings
 * ==================================================================
 * General BlockHub calls (community calls, AMAs, partner calls...).
 * Only ADMINS create them. Anyone with the link can RSVP; RSVPing
 * emails a calendar invite so it lands in their calendar. At the
 * time, the host starts the call and everyone joins the BlockHub
 * Live room (/meet/<code>/room).
 *
 *  ADMIN  (requireAdmin)
 *    GET    /admin                        list (?scope=upcoming|past|all)
 *    POST   /admin                        create (+ optional email invites)
 *    GET    /admin/:id                    details + who's coming
 *    PATCH  /admin/:id                    edit (booked people get the update)
 *    POST   /admin/:id/invite             email invitations
 *    POST   /admin/:id/cancel             cancel (removed from calendars)
 *    POST   /admin/:id/reopen             reopen an ended meeting
 *    DELETE /admin/:id                    delete
 *    DELETE /admin/:id/rsvps/:rsvpId      remove someone from the list
 *
 *  SIGNED-IN USER
 *    GET    /mine                         my upcoming meetings + invitations
 *
 *  PUBLIC  (the share link)
 *    GET    /public/:code                 meeting page info
 *    POST   /public/:code/rsvp            "I'll attend" / "Can't make it"
 *    POST   /public/:code/claim           personal link from an email
 *    GET    /public/:code/calendar.ics    add to calendar file
 * ==================================================================
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const router = express.Router();

const Meeting = require("../models/Meeting");
const LiveSession = require("../models/LiveSession");
const User = require("../models/user");

const { requireAdmin } = require("../middlewave/adminAuth");
const livekit = require("../services/livekit.service");
const { generateUniqueCode, normaliseCode, closeAllVisits } = require("../services/liveClass.helpers");
const { isValidEmail } = require("../services/email");
const { buildIcs, calendarLinks, meetingUrl, endsAtOf } = require("../services/meetings/calendar");
const meetingNotify = require("../services/meetings/notify");
const {
    meetingAccessToken,
    readMeetingAccessToken,
    readMeetingInviteToken,
    meetingCookieName,
    meetingCookieOptions,
} = require("../services/meetings/tokens");

/* ==================================================================
   HELPERS
================================================================== */

const MAX_INVITES_PER_REQUEST = 300;

const clean = (value, max) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

function badRequest(res, message) {
    return res.status(400).json({ success: false, message });
}

/** Signed-in BlockHub user from the main "token" cookie (or null) */
async function currentUser(req) {
    try {
        const token = req.cookies?.token;
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const id = decoded?.id || decoded?.userId || decoded?._id;
        if (!id) return null;
        return await User.findById(id).select("_id fullName email profileImage admin").lean();
    } catch {
        return null;
    }
}

/** "a@b.com, Jane <jane@x.com>\nc@d.com" -> [{ email, name }] */
function parseEmails(input) {
    const raw = Array.isArray(input) ? input.join("\n") : String(input || "");
    const out = [];
    const seen = new Set();

    for (const chunk of raw.split(/[\n,;]+/)) {
        const part = chunk.trim();
        if (!part) continue;

        const named = part.match(/^(.*)<([^>]+)>$/);
        const candidates = named
            ? [{ name: named[1].trim().replace(/^"|"$/g, ""), email: named[2] }]
            : part.split(/\s+/).map((email) => ({ name: "", email }));

        for (const c of candidates) {
            const email = String(c.email || "").trim().toLowerCase();
            if (!isValidEmail(email) || seen.has(email)) continue;
            seen.add(email);
            out.push({ email, name: c.name.slice(0, 80) });
        }
    }
    return out;
}

function parseStart(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseDuration(value, fallback = 60) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(600, Math.max(5, n));
}

function counts(meeting) {
    const rsvps = meeting.rsvps || [];
    return {
        going: rsvps.filter((r) => r.status === "going").length,
        declined: rsvps.filter((r) => r.status === "declined").length,
        joined: rsvps.filter((r) => r.firstJoinedAt).length,
        invited: (meeting.invites || []).length,
    };
}

function summaryDTO(meeting) {
    return {
        id: String(meeting._id),
        code: meeting.code,
        title: meeting.title,
        startsAt: meeting.startsAt,
        endsAt: endsAtOf(meeting),
        durationMinutes: meeting.durationMinutes,
        hostName: meeting.hostName,
        status: meeting.status,
        url: meetingUrl(meeting),
        roomUrl: `${meetingUrl(meeting)}/room`,
        counts: counts(meeting),
        createdAt: meeting.createdAt,
    };
}

function detailDTO(meeting) {
    const rsvpByEmail = new Map((meeting.rsvps || []).map((r) => [r.email, r]));
    return {
        ...summaryDTO(meeting),
        description: meeting.description || "",
        settings: {
            waitingRoom: Boolean(meeting.settings?.waitingRoom),
            allowScreenShare: Boolean(meeting.settings?.allowScreenShare),
            muteOnJoin: meeting.settings?.muteOnJoin !== false,
            notifyOnStart: meeting.settings?.notifyOnStart !== false,
        },
        cancelReason: meeting.cancelReason || "",
        links: calendarLinks(meeting),
        rsvps: (meeting.rsvps || [])
            .map((r) => ({
                id: String(r._id),
                name: r.name,
                email: r.email,
                status: r.status,
                source: r.source,
                hasAccount: Boolean(r.user),
                respondedAt: r.respondedAt,
                firstJoinedAt: r.firstJoinedAt,
            }))
            .sort((a, b) => new Date(b.respondedAt) - new Date(a.respondedAt)),
        invites: (meeting.invites || [])
            .map((i) => ({
                email: i.email,
                name: i.name,
                invitedAt: i.invitedAt,
                response: rsvpByEmail.get(i.email)?.status || null,
            }))
            .sort((a, b) => new Date(b.invitedAt) - new Date(a.invitedAt)),
    };
}

function publicDTO(meeting) {
    return {
        code: meeting.code,
        title: meeting.title,
        description: meeting.description || "",
        startsAt: meeting.startsAt,
        endsAt: endsAtOf(meeting),
        durationMinutes: meeting.durationMinutes,
        hostName: meeting.hostName,
        status: meeting.status,
        cancelReason: meeting.status === "cancelled" ? meeting.cancelReason || "" : "",
        goingCount: counts(meeting).going,
        waitingRoom: Boolean(meeting.settings?.waitingRoom),
        url: meetingUrl(meeting),
        roomPath: `/meet/${meeting.code}/room`,
    };
}

function meDTO(rsvp) {
    if (!rsvp) return null;
    return {
        rsvpId: String(rsvp._id),
        name: rsvp.name,
        email: rsvp.email,
        status: rsvp.status,
        respondedAt: rsvp.respondedAt,
    };
}

/** Load a meeting by :id for admin routes (sends 404 itself) */
async function loadById(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid meeting." });
        return null;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
        res.status(404).json({ success: false, message: "Meeting not found." });
        return null;
    }
    return meeting;
}

/** Load a meeting by :code for public routes (sends 404 itself) */
async function loadByCode(req, res) {
    const code = normaliseCode(req.params.code);
    if (!code) {
        res.status(400).json({ success: false, code: "BAD_CODE", message: "That meeting link doesn't look right." });
        return null;
    }
    const meeting = await Meeting.findOne({ code });
    if (!meeting) {
        res.status(404).json({ success: false, code: "NOT_FOUND", message: "We couldn't find this meeting." });
        return null;
    }
    return meeting;
}

/** The RSVP this browser already has for the meeting (cookie / header) */
function rsvpFromBrowser(req, meeting) {
    const token = req.cookies?.[meetingCookieName(meeting.code)] || req.get("x-meeting-token");
    const decoded = readMeetingAccessToken(token);
    if (!decoded || decoded.meetingId !== String(meeting._id)) return null;
    return meeting.rsvps.id(decoded.rsvpId) || null;
}

function rsvpForAccount(meeting, user) {
    if (!user) return null;
    const email = String(user.email || "").toLowerCase();
    return (
        meeting.rsvps.find((r) => r.user && String(r.user) === String(user._id)) ||
        (email ? meeting.rsvps.find((r) => r.email === email) : null) ||
        null
    );
}

function setAccessCookie(res, meeting, rsvp) {
    const token = meetingAccessToken(meeting, rsvp._id);
    res.cookie(meetingCookieName(meeting.code), token, meetingCookieOptions());
    return token;
}

function clearAccessCookie(res, meeting) {
    const { maxAge, ...options } = meetingCookieOptions();
    res.clearCookie(meetingCookieName(meeting.code), options);
}

/** Make the meeting's video room match the meeting */
async function syncLiveSession(meeting, extra = {}) {
    await LiveSession.updateOne(
        { _id: meeting.liveSession },
        {
            $set: {
                title: meeting.title,
                "settings.waitingRoom": Boolean(meeting.settings?.waitingRoom),
                "settings.allowStudentScreenShare": Boolean(meeting.settings?.allowScreenShare),
                "settings.muteStudentsOnJoin": meeting.settings?.muteOnJoin !== false,
                ...extra,
            },
        }
    );
}

/** End the meeting's video room (never throws - cancelling must still notify people) */
async function closeLiveRoom(meeting) {
    try {
        const session = await LiveSession.findById(meeting.liveSession);
        if (!session || session.status === "ended") return;
        session.status = "ended";
        session.endedAt = new Date();
        session.lobby.forEach((entry) => {
            if (entry.status === "waiting") entry.status = "denied";
        });
        await session.save();
        if (livekit.isConfigured()) await livekit.closeRoom(session.roomName).catch(() => null);
        await closeAllVisits(session._id).catch(() => null);
    } catch (error) {
        console.error("[meetings] close room:", error?.message);
    }
}

// Small in-memory rate limit for the public RSVP form
const hits = new Map();
function tooMany(key, limit = 20, windowMs = 10 * 60 * 1000) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
        hits.set(key, { count: 1, reset: now + windowMs });
        if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
        return false;
    }
    entry.count += 1;
    return entry.count > limit;
}

/* ==================================================================
   PUBLIC
================================================================== */

router.get("/public/:code", async (req, res) => {
    try {
        const meeting = await loadByCode(req, res);
        if (!meeting) return;

        const user = await currentUser(req);
        const rsvp = rsvpFromBrowser(req, meeting) || rsvpForAccount(meeting, user);

        return res.json({
            success: true,
            data: {
                meeting: publicDTO(meeting),
                links: calendarLinks(meeting),
                me: meDTO(rsvp),
                account: user ? { name: user.fullName || "", email: user.email || "" } : null,
                isHost: Boolean(user?.admin),
                liveKitReady: livekit.isConfigured(),
            },
        });
    } catch (error) {
        console.error("meeting public get error:", error);
        return res.status(500).json({ success: false, message: "Unable to load this meeting." });
    }
});

router.get("/public/:code/calendar.ics", async (req, res) => {
    try {
        const code = normaliseCode(req.params.code);
        const meeting = code ? await Meeting.findOne({ code }).lean() : null;
        if (!meeting) return res.status(404).send("Meeting not found");

        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="blockhub-meeting-${meeting.code}.ics"`);
        return res.send(buildIcs(meeting, { method: "PUBLISH" }));
    } catch (error) {
        console.error("meeting ics error:", error);
        return res.status(500).send("Unable to build the calendar file");
    }
});

/* body: { token } - the personal link in our emails (?t=...) */
router.post("/public/:code/claim", async (req, res) => {
    try {
        const meeting = await loadByCode(req, res);
        if (!meeting) return;

        const decoded = readMeetingAccessToken(req.body?.token);
        const rsvp = decoded && decoded.meetingId === String(meeting._id) ? meeting.rsvps.id(decoded.rsvpId) : null;

        if (!rsvp) {
            return res.status(400).json({ success: false, message: "This link has expired. Please RSVP again." });
        }

        const accessToken = setAccessCookie(res, meeting, rsvp);
        return res.json({ success: true, data: { me: meDTO(rsvp), accessToken } });
    } catch (error) {
        console.error("meeting claim error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong." });
    }
});

/*
 * body: { name, email, status: "going" | "declined", inviteToken? }
 * "going"    -> books a spot + emails a calendar invite
 * "declined" -> cancels the spot + removes it from their calendar
 */
router.post("/public/:code/rsvp", async (req, res) => {
    try {
        if (tooMany(`rsvp:${req.ip}`)) {
            return res.status(429).json({ success: false, message: "Too many attempts. Please wait a few minutes." });
        }

        const meeting = await loadByCode(req, res);
        if (!meeting) return;

        if (meeting.status === "cancelled") {
            return res.status(410).json({ success: false, code: "CANCELLED", message: "This meeting was cancelled." });
        }
        if (meeting.status === "ended") {
            return res.status(410).json({ success: false, code: "ENDED", message: "This meeting has ended." });
        }

        const status = req.body?.status === "declined" ? "declined" : "going";
        const user = await currentUser(req);
        const invite = readMeetingInviteToken(req.body?.inviteToken);
        const validInvite = invite && invite.meetingId === String(meeting._id) ? invite : null;

        // Who is this? (this browser's RSVP > invite link > typed email > account)
        let rsvp = rsvpFromBrowser(req, meeting);

        let email = String(
            validInvite?.email || req.body?.email || rsvp?.email || user?.email || ""
        )
            .trim()
            .toLowerCase();
        const name = clean(req.body?.name, 80) || rsvp?.name || validInvite?.name || user?.fullName || "";

        if (rsvp && email && rsvp.email !== email) rsvp = null; // typed a different email
        if (!rsvp && email) rsvp = meeting.rsvps.find((r) => r.email === email) || null;
        if (!rsvp && user) rsvp = rsvpForAccount(meeting, user);
        if (!email && rsvp) email = rsvp.email;

        /* ---------- Can't make it ---------- */
        if (status === "declined") {
            if (rsvp) {
                const wasGoing = rsvp.status === "going";
                rsvp.status = "declined";
                rsvp.respondedAt = new Date();
                await meeting.save();
                if (wasGoing) meetingNotify.rsvpDeclined(meeting, rsvp);
            } else if (validInvite) {
                // Record the "no" so the host can see it
                meeting.rsvps.push({
                    name: name || validInvite.email,
                    email: validInvite.email,
                    user: user?._id || null,
                    status: "declined",
                    source: "invite",
                });
                await meeting.save();
            }
            clearAccessCookie(res, meeting);

            return res.json({
                success: true,
                message: "Got it — your spot is cancelled.",
                data: { me: meDTO(rsvp), meeting: publicDTO(meeting) },
            });
        }

        /* ---------- I'll attend ---------- */
        if (!name) return badRequest(res, "Please enter your name.");
        if (!isValidEmail(email)) return badRequest(res, "Please enter a valid email so we can send your calendar invite.");

        let isNewBooking = false;

        if (rsvp) {
            rsvp.name = name;
            if (!rsvp.user && user && String(user.email || "").toLowerCase() === rsvp.email) rsvp.user = user._id;
            if (rsvp.status !== "going") {
                rsvp.status = "going";
                rsvp.respondedAt = new Date();
                isNewBooking = true;
            }
        } else {
            const ownsEmail = user && String(user.email || "").toLowerCase() === email;
            meeting.rsvps.push({
                name,
                email,
                user: ownsEmail ? user._id : null,
                status: "going",
                source: validInvite ? "invite" : ownsEmail ? "account" : "link",
                respondedAt: new Date(),
            });
            rsvp = meeting.rsvps[meeting.rsvps.length - 1];
            isNewBooking = true;
        }

        await meeting.save();

        // Calendar invite email (fire-and-forget so the page stays fast)
        if (isNewBooking) meetingNotify.rsvpConfirmed(meeting, rsvp);

        const accessToken = setAccessCookie(res, meeting, rsvp);

        return res.json({
            success: true,
            message: isNewBooking
                ? "You're booked! Check your email for the calendar invite."
                : "You're already booked for this meeting.",
            data: {
                me: meDTO(rsvp),
                accessToken,
                alreadyBooked: !isNewBooking,
                meeting: publicDTO(meeting),
                links: calendarLinks(meeting),
            },
        });
    } catch (error) {
        console.error("meeting rsvp error:", error);
        return res.status(500).json({ success: false, message: "We couldn't save your RSVP. Please try again." });
    }
});

/* ==================================================================
   SIGNED-IN USER: my meetings
================================================================== */

router.get("/mine", async (req, res) => {
    try {
        const user = await currentUser(req);
        if (!user) return res.status(401).json({ success: false, message: "Please sign in." });

        const email = String(user.email || "").toLowerCase();
        const or = [{ "rsvps.user": user._id }];
        if (email) or.push({ "rsvps.email": email }, { "invites.email": email });

        const meetings = await Meeting.find({
            status: { $in: ["scheduled", "live"] },
            startsAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
            $or: or,
        })
            .sort({ startsAt: 1 })
            .limit(20)
            .lean();

        const data = meetings
            .map((m) => {
                // Hide meetings that already finished their time slot
                if (endsAtOf(m).getTime() + 2 * 60 * 60 * 1000 < Date.now() && m.status !== "live") return null;

                const rsvp =
                    (m.rsvps || []).find((r) => r.user && String(r.user) === String(user._id)) ||
                    (email ? (m.rsvps || []).find((r) => r.email === email) : null);

                if (rsvp?.status === "declined") return null;

                return {
                    code: m.code,
                    title: m.title,
                    startsAt: m.startsAt,
                    endsAt: endsAtOf(m),
                    durationMinutes: m.durationMinutes,
                    hostName: m.hostName,
                    status: m.status,
                    myStatus: rsvp?.status === "going" ? "going" : "invited",
                    path: `/meet/${m.code}`,
                    links: calendarLinks(m),
                };
            })
            .filter(Boolean);

        return res.json({ success: true, data });
    } catch (error) {
        console.error("my meetings error:", error);
        return res.status(500).json({ success: false, message: "Unable to load your meetings." });
    }
});

/* ==================================================================
   ADMIN
================================================================== */

router.use("/admin", requireAdmin);

router.get("/admin", async (req, res) => {
    try {
        const scope = ["upcoming", "past", "all"].includes(req.query.scope) ? req.query.scope : "all";
        const now = new Date();
        const filter = {};

        if (scope === "upcoming") {
            filter.status = { $in: ["scheduled", "live"] };
        } else if (scope === "past") {
            filter.$or = [{ status: { $in: ["ended", "cancelled"] } }, { startsAt: { $lt: new Date(now - 24 * 3600000) } }];
        }

        const meetings = await Meeting.find(filter)
            .sort({ startsAt: scope === "past" ? -1 : 1 })
            .limit(200)
            .lean();

        return res.json({ success: true, data: meetings.map(summaryDTO) });
    } catch (error) {
        console.error("admin meetings list error:", error);
        return res.status(500).json({ success: false, message: "Unable to load meetings." });
    }
});

/*
 * body: { title, description, startsAt (ISO), durationMinutes, hostName,
 *         settings: { waitingRoom, allowScreenShare, muteOnJoin, notifyOnStart },
 *         invites: "a@b.com, c@d.com", inviteMessage }
 */
router.post("/admin", async (req, res) => {
    try {
        const body = req.body || {};
        const title = clean(body.title, 140);
        const startsAt = parseStart(body.startsAt);

        if (!title) return badRequest(res, "Give the meeting a title.");
        if (!startsAt) return badRequest(res, "Choose when the meeting starts.");
        if (startsAt.getTime() < Date.now() - 10 * 60 * 1000) {
            return badRequest(res, "That start time is in the past.");
        }

        const admin = await User.findById(req.adminUser._id).select("_id fullName").lean();
        const settings = body.settings || {};
        const code = await generateUniqueCode();

        const meeting = new Meeting({
            code,
            title,
            description: clean(body.description, 4000),
            startsAt,
            durationMinutes: parseDuration(body.durationMinutes),
            host: admin._id,
            hostName: clean(body.hostName, 80) || "BlockHub",
            createdBy: admin._id,
            settings: {
                waitingRoom: settings.waitingRoom !== false,
                allowScreenShare: Boolean(settings.allowScreenShare),
                muteOnJoin: settings.muteOnJoin !== false,
                notifyOnStart: settings.notifyOnStart !== false,
            },
        });

        const session = await LiveSession.create({
            code,
            roomName: `bh-${code}`,
            title,
            kind: "meeting",
            meeting: meeting._id,
            cohort: null,
            track: null,
            host: admin._id,
            status: "scheduled",
            settings: {
                waitingRoom: meeting.settings.waitingRoom,
                allowStudentScreenShare: meeting.settings.allowScreenShare,
                muteStudentsOnJoin: meeting.settings.muteOnJoin,
            },
        });

        meeting.liveSession = session._id;

        const people = parseEmails(body.invites).slice(0, MAX_INVITES_PER_REQUEST);
        people.forEach((person) =>
            meeting.invites.push({ email: person.email, name: person.name, invitedBy: admin._id })
        );

        await meeting.save();

        if (people.length) {
            meetingNotify.invite(meeting, people, {
                message: clean(body.inviteMessage, 2000),
                invitedBy: admin.fullName || "the BlockHub team",
            });
        }

        return res.status(201).json({
            success: true,
            message: people.length
                ? `Meeting created and ${people.length} invite${people.length === 1 ? "" : "s"} sent.`
                : "Meeting created. Share the link to let people book a spot.",
            data: detailDTO(meeting),
        });
    } catch (error) {
        console.error("create meeting error:", error);
        return res.status(500).json({ success: false, message: "Unable to create the meeting." });
    }
});

router.get("/admin/:id", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;
        return res.json({ success: true, data: detailDTO(meeting) });
    } catch (error) {
        console.error("meeting detail error:", error);
        return res.status(500).json({ success: false, message: "Unable to load this meeting." });
    }
});

/*
 * body: any of { title, description, startsAt, durationMinutes, hostName, settings, notify }
 * If the time, length or title changes, everyone booked gets an
 * updated calendar invite (unless notify: false).
 */
router.patch("/admin/:id", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        if (meeting.status === "cancelled") {
            return badRequest(res, "This meeting was cancelled. Create a new one instead.");
        }

        const body = req.body || {};
        const previousStartsAt = meeting.startsAt;
        let calendarChanged = false;

        if (body.title !== undefined) {
            const title = clean(body.title, 140);
            if (!title) return badRequest(res, "The title can't be empty.");
            if (title !== meeting.title) calendarChanged = true;
            meeting.title = title;
        }

        if (body.description !== undefined) {
            const description = clean(body.description, 4000);
            if (description !== meeting.description) calendarChanged = true;
            meeting.description = description;
        }

        if (body.startsAt !== undefined) {
            const startsAt = parseStart(body.startsAt);
            if (!startsAt) return badRequest(res, "Choose a valid start time.");
            if (startsAt.getTime() !== new Date(meeting.startsAt).getTime()) calendarChanged = true;
            meeting.startsAt = startsAt;
        }

        if (body.durationMinutes !== undefined) {
            const duration = parseDuration(body.durationMinutes, meeting.durationMinutes);
            if (duration !== meeting.durationMinutes) calendarChanged = true;
            meeting.durationMinutes = duration;
        }

        if (body.hostName !== undefined) {
            meeting.hostName = clean(body.hostName, 80) || "BlockHub";
        }

        if (body.settings && typeof body.settings === "object") {
            for (const key of ["waitingRoom", "allowScreenShare", "muteOnJoin", "notifyOnStart"]) {
                if (typeof body.settings[key] === "boolean") meeting.settings[key] = body.settings[key];
            }
        }

        if (calendarChanged) meeting.sequence = (meeting.sequence || 0) + 1;
        await meeting.save();
        await syncLiveSession(meeting);

        const timeMoved = new Date(previousStartsAt).getTime() !== new Date(meeting.startsAt).getTime();
        if (calendarChanged && body.notify !== false && meeting.status === "scheduled") {
            meetingNotify.updated(meeting, timeMoved ? previousStartsAt : null);
        }

        return res.json({
            success: true,
            message: calendarChanged && body.notify !== false && counts(meeting).going
                ? "Saved. Everyone booked will get the updated calendar invite."
                : "Saved.",
            data: detailDTO(meeting),
        });
    } catch (error) {
        console.error("update meeting error:", error);
        return res.status(500).json({ success: false, message: "Unable to save the meeting." });
    }
});

/* body: { emails: "a@b.com, Jane <jane@x.com>", message, resend } */
router.post("/admin/:id/invite", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        if (["cancelled", "ended"].includes(meeting.status)) {
            return badRequest(res, `You can't invite people to a ${meeting.status} meeting.`);
        }

        const people = parseEmails(req.body?.emails).slice(0, MAX_INVITES_PER_REQUEST);
        if (!people.length) return badRequest(res, "Add at least one valid email address.");

        const admin = await User.findById(req.adminUser._id).select("_id fullName").lean();
        const resend = Boolean(req.body?.resend);

        const existing = new Set(meeting.invites.map((i) => i.email));
        const toSend = resend ? people : people.filter((p) => !existing.has(p.email));

        toSend.forEach((person) => {
            if (!existing.has(person.email)) {
                meeting.invites.push({ email: person.email, name: person.name, invitedBy: admin._id });
            }
        });
        await meeting.save();

        if (toSend.length) {
            meetingNotify.invite(meeting, toSend, {
                message: clean(req.body?.message, 2000),
                invitedBy: admin.fullName || "the BlockHub team",
                resend,
            });
        }

        const skipped = people.length - toSend.length;
        return res.json({
            success: true,
            message:
                `${toSend.length} invite${toSend.length === 1 ? "" : "s"} sent.` +
                (skipped ? ` ${skipped} already invited (tick "send again" to resend).` : ""),
            data: detailDTO(meeting),
        });
    } catch (error) {
        console.error("meeting invite error:", error);
        return res.status(500).json({ success: false, message: "Unable to send invites." });
    }
});

/* body: { reason, notify } */
router.post("/admin/:id/cancel", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        if (meeting.status === "cancelled") {
            return res.json({ success: true, message: "Already cancelled.", data: detailDTO(meeting) });
        }

        meeting.status = "cancelled";
        meeting.cancelledAt = new Date();
        meeting.cancelReason = clean(req.body?.reason, 1000);
        meeting.sequence = (meeting.sequence || 0) + 1;
        await meeting.save();
        await closeLiveRoom(meeting);

        if (req.body?.notify !== false) meetingNotify.cancelled(meeting, meeting.cancelReason);

        return res.json({
            success: true,
            message: "Meeting cancelled. Everyone booked has been told and it's removed from their calendars.",
            data: detailDTO(meeting),
        });
    } catch (error) {
        console.error("cancel meeting error:", error);
        return res.status(500).json({ success: false, message: "Unable to cancel the meeting." });
    }
});

/* An ended meeting (e.g. ended by mistake / after a test) can be opened again */
router.post("/admin/:id/reopen", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        if (meeting.status !== "ended") {
            return badRequest(res, "Only ended meetings can be reopened.");
        }

        meeting.status = "scheduled";
        await meeting.save();
        await syncLiveSession(meeting, { status: "scheduled", startedAt: null, endedAt: null, lobby: [] });

        return res.json({ success: true, message: "Meeting reopened. You can start it again.", data: detailDTO(meeting) });
    } catch (error) {
        console.error("reopen meeting error:", error);
        return res.status(500).json({ success: false, message: "Unable to reopen the meeting." });
    }
});

router.delete("/admin/:id/rsvps/:rsvpId", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        const rsvp = meeting.rsvps.id(req.params.rsvpId);
        if (!rsvp) return res.status(404).json({ success: false, message: "That person isn't on the list." });

        const wasGoing = rsvp.status === "going";
        const snapshot = { ...rsvp.toObject() };
        rsvp.deleteOne();
        await meeting.save();

        // Take it off their calendar too
        if (wasGoing && meeting.status === "scheduled" && req.query.notify !== "false") {
            meetingNotify.rsvpDeclined(meeting, { ...snapshot, respondedAt: new Date() });
        }

        return res.json({ success: true, message: "Removed from the list.", data: detailDTO(meeting) });
    } catch (error) {
        console.error("remove rsvp error:", error);
        return res.status(500).json({ success: false, message: "Unable to remove that person." });
    }
});

router.delete("/admin/:id", async (req, res) => {
    try {
        const meeting = await loadById(req, res);
        if (!meeting) return;

        const upcomingWithPeople =
            ["scheduled", "live"].includes(meeting.status) && counts(meeting).going > 0;
        if (upcomingWithPeople) {
            return badRequest(res, "People are booked for this meeting. Cancel it first so they're told, then delete it.");
        }

        await closeLiveRoom(meeting);
        await LiveSession.deleteOne({ _id: meeting.liveSession });
        await meeting.deleteOne();

        return res.json({ success: true, message: "Meeting deleted." });
    } catch (error) {
        console.error("delete meeting error:", error);
        return res.status(500).json({ success: false, message: "Unable to delete the meeting." });
    }
});

module.exports = router;
