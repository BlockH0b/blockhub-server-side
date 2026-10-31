/*
 * ==================================================================
 * BlockHub Live  -  /live_class
 * ==================================================================
 * Google-Meet-style video classes for cohort tutors and students.
 * Video/audio/screen-share run on LiveKit (or, when a class's provider is
 * "youtube", on YouTube Live with BlockHub questions beside it);
 * everything about WHO can join WHICH class lives here.
 *
 *  TUTOR (host)
 *    POST   /sessions                          create / reuse a class call
 *    GET    /sessions                          my track's recent calls
 *    PATCH  /sessions/:code/settings           waiting room, screen share...
 *    POST   /sessions/:code/end                end call for everyone
 *    GET    /sessions/:code/lobby              people waiting to be admitted
 *    POST   /sessions/:code/lobby/admit-all
 *    POST   /sessions/:code/lobby/:userId/admit
 *    POST   /sessions/:code/lobby/:userId/deny
 *    POST   /sessions/:code/mute-all
 *    POST   /sessions/:code/participants/:identity/mute
 *    POST   /sessions/:code/participants/:identity/remove
 *    POST   /sessions/:code/participants/:identity/screen-share
 *    GET    /sessions/:code/attendance
 *
 *  EVERYONE (tutor or student)
 *    GET    /sessions/active                   live/scheduled calls for my track
 *    GET    /sessions/:code                    class info for the join screen
 *    POST   /sessions/:code/token              get a LiveKit token to join
 *    DELETE /sessions/:code/lobby/me           stop waiting
 *
 *  LIVEKIT
 *    POST   /webhook                           attendance from LiveKit events
 *
 *  BLOCKHUB MEETINGS
 *    Meetings (route_meetings/) use these same endpoints for the call
 *    itself. Their LiveSession has kind "meeting": no track, admins
 *    host, and anyone who RSVP'd (or is signed in) can join.
 * ==================================================================
 */

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const LiveSession = require("../models/LiveSession");
const LiveAttendance = require("../models/LiveAttendance");
const CohortClass = require("../models/CohortClass");
const CohortRegistration = require("../models/Cohort");
const User = require("../models/user");

const livekit = require("../services/livekit.service");
const {
    generateUniqueCode,
    normaliseCode,
    joinUrlFor,
    markJoined,
    markTokenIssued,
    markLeft,
    closeAllVisits,
} = require("../services/liveClass.helpers");
const { getClassStartsAt, getClassEndsAt } = require("../utils/classTime");
const { liveClassAuth, requireHost } = require("../middlewave/liveClassAuth");
const notify = require("../services/email/notify");
const Meeting = require("../models/Meeting");
const meetingNotify = require("../services/meetings/notify");
const youtube = require("../services/youtube.service");
const LiveQuestion = require("../models/LiveQuestion");
const LiveSetting = require("../models/LiveSetting");
const { getIO } = require("../confiq/socket");

/* ==================================================================
   WEBHOOK  (must be registered before JSON-only handlers)
   LiveKit sends Content-Type: application/webhook+json, which the
   global express.json() ignores - so we can read the raw body here
   and verify the signature.
================================================================== */

router.post(
    "/webhook",
    express.raw({ type: ["application/webhook+json", "application/json"] }),
    async (req, res) => {
        if (!livekit.isConfigured()) return res.status(200).end();

        let event;
        try {
            const raw = Buffer.isBuffer(req.body)
                ? req.body.toString("utf8")
                : JSON.stringify(req.body || {});
            event = await livekit
                .getWebhookReceiver()
                .receive(raw, req.get("Authorization"));
        } catch (error) {
            console.warn("[live_class] webhook rejected:", error?.message);
            return res.status(401).end();
        }

        try {
            const roomName = event?.room?.name;
            if (!roomName) return res.status(200).end();

            const session = await LiveSession.findOne({ roomName });
            if (!session) return res.status(200).end();

            const participant = event.participant;
            const userId = participant?.identity;
            const validUser = userId && mongoose.Types.ObjectId.isValid(userId);

            let meta = {};
            try {
                meta = JSON.parse(participant?.metadata || "{}");
            } catch {
                meta = {};
            }

            switch (event.event) {
                case "participant_joined": {
                    if (!validUser) break;
                    await markJoined({
                        sessionId: session._id,
                        userId,
                        role: meta.role === "host" ? "host" : "student",
                        name: participant.name,
                    });

                    const inCall = await LiveAttendance.countDocuments({
                        session: session._id,
                        "visits.leftAt": null,
                        "visits.0": { $exists: true },
                    });
                    if (inCall > (session.peakParticipants || 0)) {
                        await LiveSession.updateOne(
                            { _id: session._id },
                            { $max: { peakParticipants: inCall } }
                        );
                    }
                    break;
                }

                case "participant_left": {
                    if (!validUser) break;
                    await markLeft({ sessionId: session._id, userId });
                    break;
                }

                case "room_finished": {
                    await closeAllVisits(session._id);
                    break;
                }

                default:
                    break;
            }
        } catch (error) {
            console.error("[live_class] webhook handling error:", error);
        }

        return res.status(200).end();
    }
);

/* ==================================================================
   YOUTUBE HELPERS  (function declarations, so they can be used above)
================================================================== */

const QUESTION_MAX = 300;

/** Sends a socket event to everyone watching this class */
function emitToSession(code, event, payload) {
    try {
        getIO().to(`yt:${code}`).emit(event, payload);
    } catch {
        /* socket server not ready - clients will catch up on refresh */
    }
}

/** The video system new classes use (admin setting). Defaults to LiveKit. */
async function getDefaultProvider() {
    const row = await LiveSetting.findOne({ key: "liveProvider" }).lean();
    return row?.value?.defaultProvider === "youtube" ? "youtube" : "livekit";
}

/**
 * Works out the YouTube details for a new class:
 *  - a pasted link wins (manual)
 *  - else, if the channel is connected, create the live event (auto)
 *  - else leave it empty with a friendly message; the tutor can paste a link later
 * Never throws - a YouTube problem must not stop the class being created.
 */
async function prepareYoutube({ title, classItem, videoUrl }) {
    const result = {
        videoId: null,
        broadcastId: null,
        streamId: null,
        ingestUrl: null,
        streamKey: null,
        source: null,
        error: null,
    };

    if (videoUrl) {
        const id = youtube.parseVideoId(videoUrl);
        if (!id) {
            result.error = "That doesn't look like a YouTube link.";
            return result;
        }
        result.videoId = id;
        result.source = "manual";
        return result;
    }

    if (!(await youtube.isConnected())) {
        result.error =
            "YouTube isn't connected yet. Paste your YouTube live link below, or ask an admin to connect YouTube.";
        return result;
    }

    try {
        const live = await youtube.createLiveEvent({
            title,
            startsAt: classItem ? getClassStartsAt(classItem) : null,
        });
        Object.assign(result, live, { source: "auto" });
    } catch (error) {
        console.error("[live_class] youtube create event failed:", error.message);
        result.error = error.message;
    }

    return result;
}

/* ==================================================================
   HELPERS
================================================================== */

// Tiny in-memory rate limit for code lookups (stops code guessing).
const lookupHits = new Map();
function tooManyLookups(key, limit = 40, windowMs = 60 * 1000) {
    const now = Date.now();
    const entry = lookupHits.get(key);
    if (!entry || entry.reset < now) {
        lookupHits.set(key, { count: 1, reset: now + windowMs });
        return false;
    }
    entry.count += 1;
    if (lookupHits.size > 5000) {
        for (const [k, v] of lookupHits) if (v.reset < now) lookupHits.delete(k);
    }
    return entry.count > limit;
}

const STALE_AFTER_MS = 10 * 60 * 60 * 1000; // live for 10h+ => treat as ended

const isMeeting = (session) => session?.kind === "meeting";

/** Words used in messages: "class"/"tutor" vs "meeting"/"host" */
function words(session) {
    return isMeeting(session)
        ? { noun: "meeting", host: "host", people: "everyone" }
        : { noun: "class", host: "tutor", people: "students" };
}

function hostCanManage(viewer, session) {
    // Meetings: any BlockHub admin can run them (even if they're also a tutor)
    if (isMeeting(session)) return Boolean(viewer.isAdmin);
    if (viewer.role !== "host") return false;
    if (viewer.kind === "admin") return true;
    return viewer.cohort === session.cohort && viewer.track === session.track;
}

function viewerCanAccess(viewer, session) {
    if (isMeeting(session)) {
        // Guests only get into the one meeting they RSVP'd to
        if (viewer.kind === "guest") return String(viewer.meetingId) === String(session.meeting);
        return true;
    }
    if (viewer.kind === "admin") return true;
    return viewer.cohort === session.cohort && viewer.track === session.track;
}

/** Keep the Meeting's status in step with its call */
async function syncMeetingStatus(session, status) {
    if (!isMeeting(session) || !session.meeting) return;
    await Meeting.updateOne(
        { _id: session.meeting, status: { $ne: "cancelled" } },
        { $set: { status } }
    ).catch((error) => console.error("[live_class] meeting status sync:", error?.message));
}

async function endSession(session) {
    session.status = "ended";
    session.endedAt = new Date();
    session.lobby.forEach((entry) => {
        if (entry.status === "waiting") entry.status = "denied";
    });
    await session.save();

    if (session.cohortClass) {
        await CohortClass.updateOne(
            { _id: session.cohortClass, status: { $in: ["scheduled", "ongoing"] } },
            { $set: { status: "completed" } }
        );
    }

    if (session.provider === "youtube") {
        // Stop the YouTube broadcast (best effort) and tell everyone watching
        youtube.completeBroadcast(session.youtube?.broadcastId).catch(() => { });
        emitToSession(session.code, "yt:session", { status: "ended" });
    } else if (livekit.isConfigured()) {
        await livekit.closeRoom(session.roomName);
    }
    await closeAllVisits(session._id);

    if (isMeeting(session)) {
        await syncMeetingStatus(session, "ended");
        return;
    }

    // Nudge students who didn't show up (scheduled classes only)
    notify.missedClass(session);
}

async function toSessionDTO(session, viewer) {
    let classInfo = null;

    if (session.cohortClass) {
        const classItem = await CohortClass.findById(session.cohortClass).lean();
        if (classItem) {
            classInfo = {
                id: String(classItem._id),
                title: classItem.title,
                classNumber: classItem.classNumber || null,
                startsAt: getClassStartsAt(classItem),
                endsAt: getClassEndsAt(classItem),
            };
        }
    }

    let meetingInfo = null;
    if (isMeeting(session) && session.meeting) {
        const meeting = await Meeting.findById(session.meeting)
            .select("title description startsAt durationMinutes hostName status")
            .lean();
        if (meeting) {
            meetingInfo = {
                id: String(meeting._id),
                description: meeting.description || "",
                startsAt: meeting.startsAt,
                durationMinutes: meeting.durationMinutes,
                hostName: meeting.hostName,
                status: meeting.status,
            };
        }
    }

    const host = await User.findById(session.host).select("fullName profileImage").lean();

    const dto = {
        id: String(session._id),
        code: session.code,
        kind: isMeeting(session) ? "meeting" : "class",
        title: session.title,
        cohort: session.cohort,
        track: session.track,
        status: session.status,
        provider: session.provider || "livekit",
        settings: {
            waitingRoom: Boolean(session.settings?.waitingRoom),
            allowStudentScreenShare: Boolean(session.settings?.allowStudentScreenShare),
            muteStudentsOnJoin: session.settings?.muteStudentsOnJoin !== false,
        },
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        joinUrl: isMeeting(session) ? meetingUrlFor(session.code) : joinUrlFor(session.code),
        class: classInfo,
        meeting: meetingInfo,
        host: {
            name: meetingInfo?.hostName || host?.fullName || (isMeeting(session) ? "Host" : "Tutor"),
            avatar: host?.profileImage || null,
        },
    };

    if (session.provider === "youtube") {
        dto.youtube = {
            videoId: session.youtube?.videoId || null,
            source: session.youtube?.source || null,
        };
    }

    if (viewer) {
        dto.viewer = {
            userId: viewer.userId,
            name: viewer.name,
            avatar: viewer.avatar,
            role: hostCanManage(viewer, session) ? "host" : "student",
        };

        if (dto.viewer.role === "host") {
            dto.waitingCount = (session.lobby || []).filter((e) => e.status === "waiting").length;
            if (dto.youtube) dto.youtube.error = session.youtube?.error || null;
        }
    }

    return dto;
}

/**
 * Loads the session for :code and checks the viewer may see it.
 * Sends the error response itself and returns null on failure.
 */
async function loadSession(req, res, { mustManage = false } = {}) {
    const code = normaliseCode(req.params.code);

    if (!code) {
        res.status(400).json({
            success: false,
            code: "BAD_CODE",
            message: "That class code doesn't look right. Codes look like abc-defg-hij.",
        });
        return null;
    }

    const limiterKey = `${req.ip}:${req.viewer?.userId || "anon"}`;
    if (tooManyLookups(limiterKey)) {
        res.status(429).json({
            success: false,
            message: "Too many attempts. Please wait a minute and try again.",
        });
        return null;
    }

    const session = await LiveSession.findOne({ code });

    if (!session) {
        res.status(404).json({
            success: false,
            code: "NOT_FOUND",
            message: "We couldn't find a class with that code.",
        });
        return null;
    }

    // Auto-close calls that were left running
    if (
        session.status === "live" &&
        session.startedAt &&
        Date.now() - new Date(session.startedAt).getTime() > STALE_AFTER_MS
    ) {
        await endSession(session);
    }

    if (!viewerCanAccess(req.viewer, session)) {
        if (isMeeting(session)) {
            res.status(401).json({
                success: false,
                code: "MEETING_RSVP_REQUIRED",
                meetingCode: session.code,
                message: "Tell us your name and email to join this meeting.",
            });
            return null;
        }

        res.status(403).json(
            req.viewer.kind === "member" || req.viewer.kind === "guest"
                ? {
                    success: false,
                    code: "NOT_IN_COHORT",
                    message: "This class is only for BlockHub Cohort students. Sign in with your cohort account to join.",
                }
                : {
                    success: false,
                    code: "WRONG_TRACK",
                    message: `This class is for the ${session.track} track. You can only join classes for your own track.`,
                }
        );
        return null;
    }

    if (mustManage && !hostCanManage(req.viewer, session)) {
        res.status(403).json({
            success: false,
            message: `Only the ${words(session).host} can do this.`,
        });
        return null;
    }

    return session;
}

function meetingUrlFor(code) {
    const base = (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, "");
    return `${base}/meet/${code}`;
}

function requireLiveKit(req, res, next) {
    if (!livekit.isConfigured()) {
        return res.status(503).json({
            success: false,
            code: "NOT_CONFIGURED",
            message: "Live classes are not set up on the server yet (missing LiveKit keys).",
        });
    }
    next();
}

function validIdentity(identity) {
    return typeof identity === "string" && mongoose.Types.ObjectId.isValid(identity);
}

/* ==================================================================
   ALL ROUTES BELOW NEED A SIGNED-IN TUTOR, ADMIN OR STUDENT
================================================================== */

/* ------------------------------------------------------------------
   YOUTUBE CONNECT CALLBACK        GET /youtube/callback
   Google sends the admin's browser back here. No login needed: the
   signed "state" proves the admin started it.
------------------------------------------------------------------ */

router.get("/youtube/callback", async (req, res) => {
    const front = (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, "");
    try {
        if (req.query.error) throw new Error(`Google said: ${String(req.query.error)}`);
        await youtube.handleCallback(String(req.query.code || ""), String(req.query.state || ""));
        return res.redirect(`${front}/admin?youtube=connected`);
    } catch (error) {
        console.error("[live_class] youtube callback:", error.message);
        return res.redirect(
            `${front}/admin?youtube=error&reason=${encodeURIComponent(String(error.message).slice(0, 160))}`
        );
    }
});

router.use(liveClassAuth);

/* ------------------------------------------------------------------
   CREATE (or reuse) A CLASS CALL           POST /sessions
   body: { classId?, title?, track?, cohort?, settings? }
------------------------------------------------------------------ */

router.post("/sessions", requireHost, async (req, res) => {
    try {
        const viewer = req.viewer;
        const { classId, title, settings = {} } = req.body || {};

        let cohort = viewer.cohort;
        let track = viewer.track;

        // Admins choose the track they are opening a call for
        if (viewer.kind === "admin") {
            cohort = req.body?.cohort || "cohort-1.0";
            track = req.body?.track;
        }

        let classItem = null;

        if (classId) {
            if (!mongoose.Types.ObjectId.isValid(classId)) {
                return res.status(400).json({ success: false, message: "Invalid class ID." });
            }

            classItem = await CohortClass.findById(classId);

            if (!classItem) {
                return res.status(404).json({ success: false, message: "Class not found." });
            }

            if (viewer.kind === "admin") {
                cohort = classItem.cohort;
                track = classItem.track;
            } else if (classItem.cohort !== cohort || classItem.track !== track) {
                return res.status(403).json({
                    success: false,
                    message: "You can only start live classes for your own track.",
                });
            }

            if (classItem.status === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "This class was cancelled. Restore it before going live.",
                });
            }

            // Reuse the existing call for this class if it hasn't ended
            const existing = await LiveSession.findOne({
                cohortClass: classItem._id,
                status: { $ne: "ended" },
            });

            if (existing) {
                return res.status(200).json({
                    success: true,
                    message: "This class already has a live room.",
                    data: await toSessionDTO(existing, viewer),
                });
            }
        }

        if (!track) {
            return res.status(400).json({
                success: false,
                message: "Choose which track this class is for.",
            });
        }

        // Which video system? An explicit choice wins, else the admin default.
        const provider = ["livekit", "youtube"].includes(req.body?.provider)
            ? req.body.provider
            : await getDefaultProvider();

        const finalTitle =
            (typeof title === "string" && title.trim().slice(0, 140)) ||
            classItem?.title ||
            `${track} live class`;

        const yt =
            provider === "youtube"
                ? await prepareYoutube({ title: finalTitle, classItem, videoUrl: req.body?.youtubeUrl })
                : null;

        const code = await generateUniqueCode();

        const session = await LiveSession.create({
            code,
            roomName: `bh-${code}`,
            provider,
            ...(yt ? { youtube: yt } : {}),
            title:
                (typeof title === "string" && title.trim().slice(0, 140)) ||
                classItem?.title ||
                `${track} live class`,
            cohort,
            track,
            cohortClass: classItem?._id || null,
            host: viewer.userId,
            status: "scheduled",
            settings: {
                waitingRoom: Boolean(settings.waitingRoom),
                allowStudentScreenShare: Boolean(settings.allowStudentScreenShare),
                muteStudentsOnJoin: settings.muteStudentsOnJoin !== false,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Live class created.",
            data: await toSessionDTO(session, viewer),
        });
    } catch (error) {
        console.error("create live session error:", error);
        return res.status(500).json({ success: false, message: "Unable to create the live class." });
    }
});

/* ------------------------------------------------------------------
   MY TRACK'S RECENT CALLS (tutor)         GET /sessions
------------------------------------------------------------------ */

router.get("/sessions", requireHost, async (req, res) => {
    try {
        const filter =
            req.viewer.kind === "admin"
                ? { kind: { $ne: "meeting" } }
                : { cohort: req.viewer.cohort, track: req.viewer.track, kind: { $ne: "meeting" } };

        const sessions = await LiveSession.find(filter)
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const data = sessions.map((s) => ({
            id: String(s._id),
            code: s.code,
            title: s.title,
            track: s.track,
            status: s.status,
            classId: s.cohortClass ? String(s.cohortClass) : null,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            createdAt: s.createdAt,
            peakParticipants: s.peakParticipants || 0,
            joinUrl: joinUrlFor(s.code),
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error("list live sessions error:", error);
        return res.status(500).json({ success: false, message: "Unable to load live classes." });
    }
});

/* ------------------------------------------------------------------
   LIVE / UPCOMING CALLS FOR MY TRACK       GET /sessions/active
------------------------------------------------------------------ */

router.get("/sessions/active", async (req, res) => {
    try {
        const filter = { status: { $in: ["live", "scheduled"] }, kind: { $ne: "meeting" } };

        if (!req.viewer.cohort && req.viewer.kind !== "admin") {
            return res.json({ success: true, data: [] });
        }

        if (req.viewer.kind !== "admin") {
            filter.cohort = req.viewer.cohort;
            filter.track = req.viewer.track;
        }

        const sessions = await LiveSession.find(filter)
            .sort({ status: 1, createdAt: -1 }) // "live" sorts before "scheduled"
            .limit(10)
            .lean();

        const data = sessions.map((s) => ({
            id: String(s._id),
            code: s.code,
            title: s.title,
            track: s.track,
            status: s.status,
            classId: s.cohortClass ? String(s.cohortClass) : null,
            startedAt: s.startedAt,
            joinUrl: joinUrlFor(s.code),
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error("active live sessions error:", error);
        return res.status(500).json({ success: false, message: "Unable to load live classes." });
    }
});

/* ------------------------------------------------------------------
   CLASS INFO FOR THE JOIN SCREEN          GET /sessions/:code
------------------------------------------------------------------ */

router.get("/sessions/:code", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;

        const data = await toSessionDTO(session, req.viewer);

        if (data.viewer.role === "student") {
            const entry = (session.lobby || []).find(
                (e) => String(e.user) === req.viewer.userId
            );
            data.viewer.lobbyStatus = entry?.status || null;
            data.viewer.removed = (session.blocked || []).some(
                (id) => String(id) === req.viewer.userId
            );
        }

        return res.json({
            success: true,
            data,
            liveKitReady: livekit.isConfigured(),
        });
    } catch (error) {
        console.error("get live session error:", error);
        return res.status(500).json({ success: false, message: "Unable to load this class." });
    }
});

/* ------------------------------------------------------------------
   GET A TOKEN TO JOIN                    POST /sessions/:code/token
   200 -> { token, serverUrl, ... }
   202 -> { waiting: true }   (waiting room - poll again)
   409 -> NOT_STARTED         (tutor hasn't started - poll again)
   410 -> ENDED
------------------------------------------------------------------ */

router.post("/sessions/:code/token", requireLiveKit, async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;

        if (session.provider === "youtube") {
            return res.status(409).json({
                success: false,
                code: "WRONG_PROVIDER",
                message: "This class is on YouTube. Open it from the class page.",
            });
        }

        const viewer = req.viewer;
        const isHost = hostCanManage(viewer, session);

        const w = words(session);

        if (session.status === "ended") {
            return res.status(410).json({
                success: false,
                code: "ENDED",
                message: `This ${w.noun} has ended.`,
            });
        }

        if (isHost) {
            if (session.status !== "live") {
                session.status = "live";
                session.startedAt = session.startedAt || new Date();
                await session.save();

                if (isMeeting(session)) {
                    await syncMeetingStatus(session, "live");
                    const meeting = await Meeting.findById(session.meeting);
                    // "We're live" email to people who RSVP'd
                    if (meeting) meetingNotify.live(meeting, session);
                } else if (req.body?.notifyStudents === true) {
                    // "Your class is live" email to the track - ONLY when the
                    // tutor ticks "Email students" on the start screen
                    notify.classLive(session, viewer.name);
                }

                if (session.cohortClass) {
                    await CohortClass.updateOne(
                        { _id: session.cohortClass, status: "scheduled" },
                        { $set: { status: "ongoing" } }
                    );
                }
            }
            await livekit.ensureRoom(session.roomName);
        } else {
            const isBlocked = (session.blocked || []).some(
                (id) => String(id) === viewer.userId
            );

            if (isBlocked) {
                return res.status(403).json({
                    success: false,
                    code: "REMOVED",
                    message: `You were removed from this ${w.noun} by the ${w.host}.`,
                });
            }

            if (session.status !== "live") {
                return res.status(409).json({
                    success: false,
                    code: "NOT_STARTED",
                    message: isMeeting(session)
                        ? "The host hasn't started the meeting yet. You'll be let in automatically once it starts."
                        : "Your tutor hasn't started the class yet. You'll be let in automatically once it starts.",
                });
            }

            if (session.settings?.waitingRoom) {
                const entry = (session.lobby || []).find(
                    (e) => String(e.user) === viewer.userId
                );

                if (!entry) {
                    await LiveSession.updateOne(
                        { _id: session._id, "lobby.user": { $ne: viewer.userId } },
                        {
                            $push: {
                                lobby: {
                                    user: viewer.userId,
                                    name: viewer.name,
                                    avatar: viewer.avatar,
                                    status: "waiting",
                                    requestedAt: new Date(),
                                },
                            },
                        }
                    );
                    return res.status(202).json({
                        success: true,
                        waiting: true,
                        message: `Asking to join... the ${w.host} will let you in soon.`,
                    });
                }

                if (entry.status === "waiting") {
                    return res.status(202).json({
                        success: true,
                        waiting: true,
                        message: `Waiting for the ${w.host} to let you in.`,
                    });
                }

                if (entry.status === "denied") {
                    return res.status(403).json({
                        success: false,
                        code: "DENIED",
                        message: `The ${w.host} didn't let you into this ${w.noun}.`,
                    });
                }
            }
        }

        const canShareScreen =
            isHost ||
            Boolean(session.settings?.allowStudentScreenShare) ||
            (session.screenShareAllowed || []).some((id) => String(id) === viewer.userId);

        const token = await livekit.createAccessToken({
            roomName: session.roomName,
            identity: viewer.userId,
            name: viewer.name,
            avatar: viewer.avatar,
            role: isHost ? "host" : "student",
            canShareScreen,
        });

        await markTokenIssued({
            sessionId: session._id,
            userId: viewer.userId,
            role: isHost ? "host" : "student",
            name: viewer.name,
        });

        if (isMeeting(session) && !isHost) {
            await markMeetingJoin(session, viewer);
        }

        return res.json({
            success: true,
            data: {
                token,
                serverUrl: livekit.LIVEKIT_URL,
                identity: viewer.userId,
                role: isHost ? "host" : "student",
                canShareScreen,
                session: await toSessionDTO(session, viewer),
            },
        });
    } catch (error) {
        console.error("live token error:", error);
        return res.status(500).json({ success: false, message: "Unable to join right now. Please try again." });
    }
});

/** Meetings: note when someone who RSVP'd first joins (and link their account) */
async function markMeetingJoin(session, viewer) {
    try {
        const now = new Date();
        if (viewer.kind === "guest") {
            await Meeting.updateOne(
                { _id: session.meeting, "rsvps._id": viewer.userId, "rsvps.firstJoinedAt": null },
                { $set: { "rsvps.$.firstJoinedAt": now } }
            );
            return;
        }

        const email = String(viewer.email || "").toLowerCase();
        const meeting = await Meeting.findById(session.meeting);
        if (!meeting) return;

        let rsvp = meeting.rsvps.find(
            (r) => (r.user && String(r.user) === viewer.userId) || (email && r.email === email)
        );

        if (!rsvp && email) {
            // Signed-in member who joined without RSVP - add them so the host sees them
            meeting.rsvps.push({
                name: viewer.name,
                email,
                user: viewer.userId,
                status: "going",
                source: "account",
                respondedAt: now,
            });
            rsvp = meeting.rsvps[meeting.rsvps.length - 1];
        }

        if (rsvp) {
            if (!rsvp.user) rsvp.user = viewer.userId;
            if (!rsvp.firstJoinedAt) rsvp.firstJoinedAt = now;
            await meeting.save();
        }
    } catch (error) {
        console.error("[live_class] meeting join mark:", error?.message);
    }
}

/* ------------------------------------------------------------------
   STOP WAITING                         DELETE /sessions/:code/lobby/me
------------------------------------------------------------------ */

router.delete("/sessions/:code/lobby/me", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;

        await LiveSession.updateOne(
            { _id: session._id },
            { $pull: { lobby: { user: req.viewer.userId, status: "waiting" } } }
        );

        return res.json({ success: true });
    } catch (error) {
        console.error("leave lobby error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong." });
    }
});

/* ==================================================================
   HOST-ONLY ROUTES
================================================================== */

/* ------------------------------------------------------------------
   SETTINGS                            PATCH /sessions/:code/settings
------------------------------------------------------------------ */

router.patch("/sessions/:code/settings", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        const { waitingRoom, allowStudentScreenShare, muteStudentsOnJoin, title } = req.body || {};
        const wasScreenShareAllowed = Boolean(session.settings?.allowStudentScreenShare);

        if (typeof waitingRoom === "boolean") {
            session.settings.waitingRoom = waitingRoom;

            // Turning the waiting room off lets everyone waiting in
            if (!waitingRoom) {
                session.lobby.forEach((entry) => {
                    if (entry.status === "waiting") {
                        entry.status = "admitted";
                        entry.decidedAt = new Date();
                    }
                });
            }
        }

        if (typeof allowStudentScreenShare === "boolean") {
            session.settings.allowStudentScreenShare = allowStudentScreenShare;
        }

        if (typeof muteStudentsOnJoin === "boolean") {
            session.settings.muteStudentsOnJoin = muteStudentsOnJoin;
        }

        if (typeof title === "string" && title.trim()) {
            session.title = title.trim().slice(0, 140);
        }

        await session.save();

        // Meetings: keep the meeting's own settings in step
        if (isMeeting(session)) {
            await Meeting.updateOne(
                { _id: session.meeting },
                {
                    $set: {
                        "settings.waitingRoom": Boolean(session.settings.waitingRoom),
                        "settings.allowScreenShare": Boolean(session.settings.allowStudentScreenShare),
                        "settings.muteOnJoin": session.settings.muteStudentsOnJoin !== false,
                        ...(typeof title === "string" && title.trim() ? { title: session.title } : {}),
                    },
                }
            ).catch(() => null);
        }

        // Apply screen-share change to students already in the call
        if (
            typeof allowStudentScreenShare === "boolean" &&
            allowStudentScreenShare !== wasScreenShareAllowed &&
            session.status === "live" &&
            livekit.isConfigured()
        ) {
            const participants = await livekit.listParticipants(session.roomName);
            const individuallyAllowed = new Set((session.screenShareAllowed || []).map(String));

            await Promise.all(
                participants
                    .filter((p) => {
                        try {
                            return JSON.parse(p.metadata || "{}").role !== "host";
                        } catch {
                            return true;
                        }
                    })
                    .map((p) =>
                        livekit
                            .setScreenSharePermission(
                                session.roomName,
                                p.identity,
                                allowStudentScreenShare || individuallyAllowed.has(p.identity)
                            )
                            .catch(() => null)
                    )
            );
        }

        return res.json({
            success: true,
            message: "Settings updated.",
            data: await toSessionDTO(session, req.viewer),
        });
    } catch (error) {
        console.error("live settings error:", error);
        return res.status(500).json({ success: false, message: "Unable to update settings." });
    }
});

/* ------------------------------------------------------------------
   END FOR EVERYONE                       POST /sessions/:code/end
------------------------------------------------------------------ */

router.post("/sessions/:code/end", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        if (session.status !== "ended") await endSession(session);

        return res.json({ success: true, message: `${isMeeting(session) ? "Meeting" : "Class"} ended for everyone.` });
    } catch (error) {
        console.error("end live session error:", error);
        return res.status(500).json({ success: false, message: "Unable to end the class." });
    }
});

/* ------------------------------------------------------------------
   WAITING ROOM
------------------------------------------------------------------ */

router.get("/sessions/:code/lobby", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        const waiting = (session.lobby || [])
            .filter((entry) => entry.status === "waiting")
            .map((entry) => ({
                userId: String(entry.user),
                name: entry.name,
                avatar: entry.avatar,
                requestedAt: entry.requestedAt,
            }));

        return res.json({ success: true, data: waiting });
    } catch (error) {
        console.error("lobby list error:", error);
        return res.status(500).json({ success: false, message: "Unable to load the waiting room." });
    }
});

router.post("/sessions/:code/lobby/admit-all", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        let admitted = 0;
        session.lobby.forEach((entry) => {
            if (entry.status === "waiting") {
                entry.status = "admitted";
                entry.decidedAt = new Date();
                admitted += 1;
            }
        });
        await session.save();

        return res.json({ success: true, admitted });
    } catch (error) {
        console.error("admit all error:", error);
        return res.status(500).json({ success: false, message: "Unable to admit everyone." });
    }
});

router.post("/sessions/:code/lobby/:userId/:decision", requireHost, async (req, res) => {
    try {
        const { userId, decision } = req.params;

        if (!["admit", "deny"].includes(decision) || !validIdentity(userId)) {
            return res.status(400).json({ success: false, message: "Invalid request." });
        }

        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        const entry = session.lobby.find((e) => String(e.user) === userId);
        if (!entry) {
            return res.status(404).json({ success: false, message: "That person is no longer waiting." });
        }

        entry.status = decision === "admit" ? "admitted" : "denied";
        entry.decidedAt = new Date();
        await session.save();

        return res.json({ success: true, status: entry.status });
    } catch (error) {
        console.error("lobby decision error:", error);
        return res.status(500).json({ success: false, message: "Unable to update the waiting room." });
    }
});

/* ------------------------------------------------------------------
   PARTICIPANT CONTROLS
------------------------------------------------------------------ */

router.post("/sessions/:code/mute-all", requireHost, requireLiveKit, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        const muted = await livekit.muteAllStudents(session.roomName);
        return res.json({ success: true, muted, message: `Muted ${muted} student${muted === 1 ? "" : "s"}.` });
    } catch (error) {
        console.error("mute all error:", error);
        return res.status(500).json({ success: false, message: "Unable to mute everyone." });
    }
});

router.post(
    "/sessions/:code/participants/:identity/:action",
    requireHost,
    requireLiveKit,
    async (req, res) => {
        try {
            const { identity, action } = req.params;

            if (!validIdentity(identity)) {
                return res.status(400).json({ success: false, message: "Invalid participant." });
            }

            const session = await loadSession(req, res, { mustManage: true });
            if (!session) return;

            if (identity === req.viewer.userId && action === "remove") {
                return res.status(400).json({ success: false, message: "You can't remove yourself." });
            }

            switch (action) {
                case "mute": {
                    const source = ["microphone", "camera", "screen_share"].includes(req.body?.source)
                        ? req.body.source
                        : "microphone";
                    await livekit.muteParticipantSource(session.roomName, identity, source);
                    return res.json({ success: true });
                }

                case "remove": {
                    await LiveSession.updateOne(
                        { _id: session._id },
                        {
                            $addToSet: { blocked: identity },
                            $pull: { screenShareAllowed: identity },
                        }
                    );
                    await livekit.removeParticipant(session.roomName, identity);
                    await markLeft({ sessionId: session._id, userId: identity });
                    return res.json({ success: true, message: "Removed from class." });
                }

                case "screen-share": {
                    const allowed = Boolean(req.body?.allowed);
                    await LiveSession.updateOne(
                        { _id: session._id },
                        allowed
                            ? { $addToSet: { screenShareAllowed: identity } }
                            : { $pull: { screenShareAllowed: identity } }
                    );
                    await livekit.setScreenSharePermission(
                        session.roomName,
                        identity,
                        allowed || Boolean(session.settings?.allowStudentScreenShare)
                    );
                    return res.json({ success: true, allowed });
                }

                default:
                    return res.status(400).json({ success: false, message: "Unknown action." });
            }
        } catch (error) {
            console.error("participant action error:", error);
            return res.status(500).json({ success: false, message: "That action failed. Please try again." });
        }
    }
);

/* ------------------------------------------------------------------
   ATTENDANCE                           GET /sessions/:code/attendance
------------------------------------------------------------------ */

router.get("/sessions/:code/attendance", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;

        let meetingDoc = null;
        if (isMeeting(session)) {
            meetingDoc = await Meeting.findById(session.meeting).select("rsvps").lean();
        }

        const [rows, registrations] = await Promise.all([
            LiveAttendance.find({ session: session._id })
                .populate("user", "fullName email profileImage")
                .lean(),
            isMeeting(session)
                // "Expected" for a meeting = everyone who RSVP'd yes
                ? Promise.resolve(
                    (meetingDoc?.rsvps || [])
                        .filter((r) => r.status === "going")
                        .map((r) => ({ user: r.user || r._id, rsvpId: r._id, fullName: r.name, email: r.email }))
                )
                : CohortRegistration.find({
                    cohort: session.cohort,
                    track: session.track,
                    status: { $ne: "rejected" },
                })
                    .select("user fullName email")
                    .lean(),
        ]);

        // Guests aren't BlockHub users: look up their email from the RSVP
        const rsvpById = new Map(
            (meetingDoc?.rsvps || []).map((r) => [String(r._id), r])
        );

        const now = Date.now();

        const present = rows
            .filter((row) => row.role !== "host")
            .map((row) => {
                const openVisit = (row.visits || []).find((v) => !v.leftAt);
                const liveSeconds = openVisit
                    ? Math.round((now - new Date(openVisit.joinedAt).getTime()) / 1000)
                    : 0;
                const rsvp = rsvpById.get(String(row.user?._id || row.user));
                return {
                    userId: String(row.user?._id || row.user),
                    name: row.user?.fullName || row.name,
                    email: row.user?.email || rsvp?.email || null,
                    avatar: row.user?.profileImage || null,
                    firstJoinedAt: row.firstJoinedAt,
                    lastLeftAt: row.lastLeftAt,
                    inCallNow: Boolean(openVisit),
                    minutes: Math.round(((row.totalSeconds || 0) + liveSeconds) / 60),
                };
            })
            .sort((a, b) => new Date(a.firstJoinedAt) - new Date(b.firstJoinedAt));

        const presentIds = new Set(present.map((p) => p.userId));

        const absent = registrations
            .filter((reg) => !presentIds.has(String(reg.user)) && !(reg.rsvpId && presentIds.has(String(reg.rsvpId))))
            .map((reg) => ({
                userId: String(reg.user),
                name: reg.fullName,
                email: reg.email,
            }));

        return res.json({
            success: true,
            data: {
                session: {
                    code: session.code,
                    title: session.title,
                    status: session.status,
                    startedAt: session.startedAt,
                    endedAt: session.endedAt,
                    peakParticipants: session.peakParticipants || 0,
                },
                totals: {
                    enrolled: registrations.length,
                    present: present.length,
                    absent: absent.length,
                },
                present,
                absent,
            },
        });
    } catch (error) {
        console.error("attendance error:", error);
        return res.status(500).json({ success: false, message: "Unable to load attendance." });
    }
});

/* ==================================================================
   YOUTUBE CLASSES  (provider: "youtube")
   ------------------------------------------------------------------
   One-way YouTube Live video, with BlockHub questions beside it.

   ADMIN
     GET    /provider-settings            default provider + YouTube status
     PATCH  /provider-settings            { defaultProvider }
     GET    /youtube/connect-url          start connecting the channel
     POST   /youtube/disconnect
   TUTOR (host)
     POST   /sessions/:code/youtube/start     mark the class live
     PATCH  /sessions/:code/youtube/video     paste / replace the YouTube link
     POST   /sessions/:code/youtube/retry     try creating the YouTube event again
     PATCH  /sessions/:code/questions/:id     pin / mark answered
   EVERYONE
     POST   /sessions/:code/youtube/join      open the class (attendance + socket ticket)
     POST   /sessions/:code/youtube/leave
     GET    /sessions/:code/questions
     POST   /sessions/:code/questions
     POST   /sessions/:code/questions/:id/upvote
     DELETE /sessions/:code/questions/:id     host, or the person who asked
================================================================== */

function requireAdmin(req, res, next) {
    // isAdmin (not kind): an admin who is also a cohort tutor resolves as kind "tutor"
    if (!req.viewer?.isAdmin) {
        return res.status(403).json({ success: false, message: "Only admins can do this." });
    }
    next();
}

const isYoutube = (session) => session?.provider === "youtube";

function requireYoutubeSession(session, res) {
    if (isYoutube(session)) return true;
    res.status(400).json({
        success: false,
        code: "WRONG_PROVIDER",
        message: "This class doesn't use YouTube.",
    });
    return false;
}

function applyYoutube(session, y) {
    session.youtube.videoId = y.videoId || null;
    session.youtube.broadcastId = y.broadcastId || null;
    session.youtube.streamId = y.streamId || null;
    session.youtube.ingestUrl = y.ingestUrl || null;
    session.youtube.streamKey = y.streamKey || null;
    session.youtube.source = y.source || null;
    session.youtube.error = y.error || null;
}

function questionDTO(q, viewerId) {
    const dto = {
        id: String(q._id),
        text: q.text,
        name: q.name || "Student",
        avatar: q.avatar || null,
        upvoteCount: (q.upvoters || []).length,
        answered: Boolean(q.answered),
        pinned: Boolean(q.pinned),
        createdAt: q.createdAt,
    };
    // Only included when we know WHO is asking (broadcasts must not carry it)
    if (viewerId) {
        dto.iUpvoted = (q.upvoters || []).some((id) => String(id) === String(viewerId));
        dto.mine = String(q.user) === String(viewerId);
    }
    return dto;
}

async function findQuestion(session, id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return LiveQuestion.findOne({ _id: id, session: session._id });
}

/* ------------------------------ ADMIN ------------------------------ */

router.get("/provider-settings", requireAdmin, async (req, res) => {
    try {
        return res.json({
            success: true,
            data: {
                defaultProvider: await getDefaultProvider(),
                youtube: await youtube.getStatus(),
            },
        });
    } catch (error) {
        console.error("provider settings error:", error);
        return res.status(500).json({ success: false, message: "Unable to load video settings." });
    }
});

router.patch("/provider-settings", requireAdmin, async (req, res) => {
    try {
        const next = req.body?.defaultProvider;
        if (next !== "livekit" && next !== "youtube") {
            return res.status(400).json({ success: false, message: "Choose livekit or youtube." });
        }

        await LiveSetting.findOneAndUpdate(
            { key: "liveProvider" },
            { value: { defaultProvider: next } },
            { upsert: true }
        );

        return res.json({
            success: true,
            message: next === "youtube" ? "New classes will use YouTube." : "New classes will use BlockHub Live (LiveKit).",
            data: { defaultProvider: next },
        });
    } catch (error) {
        console.error("provider settings update error:", error);
        return res.status(500).json({ success: false, message: "Unable to save the setting." });
    }
});

router.get("/youtube/connect-url", requireAdmin, async (req, res) => {
    if (!youtube.isConfigured()) {
        return res.status(503).json({
            success: false,
            code: "NOT_CONFIGURED",
            message:
                "YouTube keys are missing on the server. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REDIRECT_URI.",
        });
    }
    return res.json({ success: true, data: { url: youtube.buildAuthUrl(req.viewer.userId) } });
});

router.post("/youtube/disconnect", requireAdmin, async (req, res) => {
    try {
        await youtube.disconnect();
        return res.json({ success: true, message: "YouTube disconnected." });
    } catch (error) {
        console.error("youtube disconnect error:", error);
        return res.status(500).json({ success: false, message: "Unable to disconnect YouTube." });
    }
});

/* ---------------------------- JOIN / LEAVE ---------------------------- */

router.post("/sessions/:code/youtube/join", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const viewer = req.viewer;
        const isHost = hostCanManage(viewer, session);

        if (!isHost && (session.blocked || []).some((id) => String(id) === viewer.userId)) {
            return res.status(403).json({
                success: false,
                code: "REMOVED",
                message: "You were removed from this class by the tutor.",
            });
        }

        // Attendance: counts once the class is live. Safe to call repeatedly.
        if (session.status === "live") {
            await markJoined({
                sessionId: session._id,
                userId: viewer.userId,
                role: isHost ? "host" : "student",
                name: viewer.name,
            });
        }

        const data = {
            session: await toSessionDTO(session, viewer),
            ticket: youtube.signTicket({ code: session.code, userId: viewer.userId }),
        };

        if (isHost) {
            const full = await LiveSession.findById(session._id)
                .select("+youtube.streamKey")
                .lean();
            data.stream = {
                ingestUrl: full?.youtube?.ingestUrl || null,
                streamKey: full?.youtube?.streamKey || null,
            };
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error("youtube join error:", error);
        return res.status(500).json({ success: false, message: "Unable to open the class right now." });
    }
});

router.post("/sessions/:code/youtube/leave", async (req, res) => {
    try {
        const code = normaliseCode(req.params.code);
        const session = code ? await LiveSession.findOne({ code }).select("_id") : null;
        if (session) await markLeft({ sessionId: session._id, userId: req.viewer.userId });
        return res.json({ success: true });
    } catch (error) {
        return res.json({ success: true });
    }
});

/* ------------------------------ TUTOR ------------------------------ */

router.post("/sessions/:code/youtube/start", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        if (session.status === "ended") {
            return res.status(410).json({ success: false, code: "ENDED", message: "This class has ended." });
        }

        if (session.status !== "live") {
            session.status = "live";
            session.startedAt = session.startedAt || new Date();
            await session.save();

            if (req.body?.notifyStudents === true) {
                notify.classLive(session, req.viewer.name);
            }

            if (session.cohortClass) {
                await CohortClass.updateOne(
                    { _id: session.cohortClass, status: "scheduled" },
                    { $set: { status: "ongoing" } }
                );
            }
        }

        await markJoined({
            sessionId: session._id,
            userId: req.viewer.userId,
            role: "host",
            name: req.viewer.name,
        });

        emitToSession(session.code, "yt:session", { status: "live" });

        return res.json({ success: true, data: await toSessionDTO(session, req.viewer) });
    } catch (error) {
        console.error("youtube start error:", error);
        return res.status(500).json({ success: false, message: "Unable to start the class." });
    }
});

router.patch("/sessions/:code/youtube/video", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const videoId = youtube.parseVideoId(req.body?.videoUrl);
        if (!videoId) {
            return res.status(400).json({
                success: false,
                message: "That doesn't look like a YouTube link. Paste the link of your live stream.",
            });
        }

        if (session.youtube.broadcastId && session.youtube.broadcastId !== videoId) {
            session.youtube.broadcastId = null; // no longer the video we created
        }
        session.youtube.videoId = videoId;
        session.youtube.source = session.youtube.broadcastId ? "auto" : "manual";
        session.youtube.error = null;
        await session.save();

        emitToSession(session.code, "yt:session", { videoId });

        return res.json({ success: true, message: "Video updated.", data: await toSessionDTO(session, req.viewer) });
    } catch (error) {
        console.error("youtube video error:", error);
        return res.status(500).json({ success: false, message: "Unable to save the video." });
    }
});

router.post("/sessions/:code/youtube/retry", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        if (session.status === "ended") {
            return res.status(410).json({ success: false, code: "ENDED", message: "This class has ended." });
        }
        if (session.youtube.broadcastId) {
            return res.status(400).json({ success: false, message: "The YouTube event already exists." });
        }

        const classItem = session.cohortClass ? await CohortClass.findById(session.cohortClass).lean() : null;
        const prepared = await prepareYoutube({ title: session.title, classItem });

        applyYoutube(session, prepared);
        await session.save();

        if (prepared.error) {
            return res.status(502).json({ success: false, message: prepared.error });
        }

        emitToSession(session.code, "yt:session", { videoId: prepared.videoId });

        return res.json({
            success: true,
            message: "YouTube event created.",
            data: {
                session: await toSessionDTO(session, req.viewer),
                stream: { ingestUrl: prepared.ingestUrl, streamKey: prepared.streamKey },
            },
        });
    } catch (error) {
        console.error("youtube retry error:", error);
        return res.status(500).json({ success: false, message: "Unable to create the YouTube event." });
    }
});

/* ---------------------------- QUESTIONS ---------------------------- */

router.get("/sessions/:code/questions", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const rows = await LiveQuestion.find({ session: session._id })
            .sort({ createdAt: -1 })
            .limit(300);

        return res.json({
            success: true,
            data: rows.map((q) => questionDTO(q, req.viewer.userId)),
        });
    } catch (error) {
        console.error("list questions error:", error);
        return res.status(500).json({ success: false, message: "Unable to load questions." });
    }
});

router.post("/sessions/:code/questions", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const text = String(req.body?.text || "").trim().slice(0, QUESTION_MAX);
        if (!text) {
            return res.status(400).json({ success: false, message: "Type your question first." });
        }

        if (session.status === "ended") {
            return res.status(410).json({ success: false, code: "ENDED", message: "This class has ended." });
        }

        const viewer = req.viewer;

        const recent = await LiveQuestion.findOne({
            session: session._id,
            user: viewer.userId,
            createdAt: { $gt: new Date(Date.now() - 4000) },
        }).select("_id");
        if (recent) {
            return res.status(429).json({ success: false, message: "Slow down a little, then ask again." });
        }

        const asked = await LiveQuestion.countDocuments({ session: session._id, user: viewer.userId });
        if (asked >= 40) {
            return res.status(429).json({ success: false, message: "You've asked a lot of questions in this class. Let others ask too." });
        }

        const question = await LiveQuestion.create({
            session: session._id,
            user: viewer.userId,
            name: viewer.name,
            avatar: viewer.avatar || null,
            text,
        });

        emitToSession(session.code, "yt:q:new", questionDTO(question));

        return res.status(201).json({ success: true, data: questionDTO(question, viewer.userId) });
    } catch (error) {
        console.error("ask question error:", error);
        return res.status(500).json({ success: false, message: "Unable to send your question." });
    }
});

router.post("/sessions/:code/questions/:id/upvote", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const question = await findQuestion(session, req.params.id);
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found." });
        }

        const userId = req.viewer.userId;
        const already = question.upvoters.some((id) => String(id) === userId);

        await LiveQuestion.updateOne(
            { _id: question._id },
            already ? { $pull: { upvoters: userId } } : { $addToSet: { upvoters: userId } }
        );

        const fresh = await LiveQuestion.findById(question._id);
        emitToSession(session.code, "yt:q:update", questionDTO(fresh));

        return res.json({ success: true, data: questionDTO(fresh, userId) });
    } catch (error) {
        console.error("upvote error:", error);
        return res.status(500).json({ success: false, message: "Unable to upvote." });
    }
});

router.patch("/sessions/:code/questions/:id", requireHost, async (req, res) => {
    try {
        const session = await loadSession(req, res, { mustManage: true });
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const question = await findQuestion(session, req.params.id);
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found." });
        }

        if (typeof req.body?.answered === "boolean") question.answered = req.body.answered;
        if (typeof req.body?.pinned === "boolean") question.pinned = req.body.pinned;
        await question.save();

        emitToSession(session.code, "yt:q:update", questionDTO(question));

        return res.json({ success: true, data: questionDTO(question, req.viewer.userId) });
    } catch (error) {
        console.error("update question error:", error);
        return res.status(500).json({ success: false, message: "Unable to update the question." });
    }
});

router.delete("/sessions/:code/questions/:id", async (req, res) => {
    try {
        const session = await loadSession(req, res);
        if (!session) return;
        if (!requireYoutubeSession(session, res)) return;

        const question = await findQuestion(session, req.params.id);
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found." });
        }

        const isAuthor = String(question.user) === req.viewer.userId;
        if (!isAuthor && !hostCanManage(req.viewer, session)) {
            return res.status(403).json({ success: false, message: "You can only remove your own questions." });
        }

        await LiveQuestion.deleteOne({ _id: question._id });
        emitToSession(session.code, "yt:q:remove", { id: String(question._id) });

        return res.json({ success: true });
    } catch (error) {
        console.error("delete question error:", error);
        return res.status(500).json({ success: false, message: "Unable to remove the question." });
    }
});

module.exports = router;
