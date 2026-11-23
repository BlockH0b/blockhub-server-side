/*
 * ============================================================
 * /track_chat  -  one group chat per track (students + tutor)
 * ============================================================
 *   GET    /me                    my group(s) + a ticket for the live socket room
 *   GET    /messages?track=&before=   latest 50 (older with ?before=<iso date>)
 *   POST   /messages              { track, body, replyTo? }
 *   DELETE /messages/:id          own message (tutors can delete any in their track)
 *   POST   /messages/:id/pin      tutors: pin / unpin
 *
 * Who can use it:
 *   - students: BHCtoken cookie (cohort dashboard login) -> their track
 *   - tutors:   main "token" cookie + active CohortTutor  -> their track(s)
 *
 * Live updates: the client joins the socket room with the ticket from /me
 * ("trackchat:join"). New messages are pushed to members who are not in the
 * chat right now (at most one push per track every 10 min for students'
 * messages; every tutor message is pushed).
 * ============================================================
 */

const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const TrackChatMessage = require("../models/TrackChatMessage");
const CohortRegistration = require("../models/Cohort");
const CohortTutor = require("../models/CohortTutor");
const User = require("../models/user");
const { normalizeTrack } = require("../config/cohortTracks");

const router = express.Router();

const DEFAULT_COHORT = process.env.DEFAULT_COHORT || "cohort-1.0";
const roomFor = (cohort, track) => `trackchat:${cohort}:${track}`;
// One spelling per track, so students and tutors always land in the same group
const officialTrack = (t) => normalizeTrack(t) || String(t || "").trim();

/* ------------------------------------------------------------
   Who is this? (student via BHCtoken, else tutor via token)
------------------------------------------------------------ */
async function chatAuth(req, res, next) {
    try {
        // student
        const bhc = req.cookies?.BHCtoken;
        if (typeof bhc === "string") {
            try {
                const d = jwt.verify(bhc, process.env.JWT_SECRET);
                if (d.purpose === "cohort_dashboard" && d.registrationId) {
                    const reg = await CohortRegistration.findOne({ _id: d.registrationId, user: d.userId }).lean();
                    if (reg && reg.status !== "rejected") {
                        const user = await User.findById(d.userId).select("_id fullName profileImage").lean();
                        req.chat = {
                            userId: String(d.userId),
                            name: user?.fullName || reg.fullName || "Student",
                            avatar: user?.profileImage || null,
                            role: "student",
                            cohort: reg.cohort || DEFAULT_COHORT,
                            tracks: [officialTrack(reg.track)],
                        };
                        return next();
                    }
                }
            } catch {
                /* fall through to tutor */
            }
        }

        // tutor
        const token = req.cookies?.token || req.cookies?.accessToken || req.cookies?.jwt;
        if (typeof token === "string") {
            try {
                const d = jwt.verify(token, process.env.JWT_SECRET);
                const userId = d.id || d.userId || d._id;
                if (userId) {
                    const tutorships = await CohortTutor.find({ user: userId, status: "active" }).select("cohort track").lean();
                    if (tutorships.length) {
                        const user = await User.findById(userId).select("_id fullName profileImage").lean();
                        req.chat = {
                            userId: String(userId),
                            name: user?.fullName || "Tutor",
                            avatar: user?.profileImage || null,
                            role: "tutor",
                            cohort: tutorships[0].cohort || DEFAULT_COHORT,
                            tracks: [...new Set(tutorships.map((t) => officialTrack(t.track)))],
                        };
                        return next();
                    }
                }
            } catch {
                /* not logged in */
            }
        }

        return res.status(401).json({ success: false, message: "Please log in to your cohort dashboard to use the chat." });
    } catch (error) {
        console.error("[track_chat] auth", error);
        return res.status(500).json({ success: false, message: "Could not open the chat." });
    }
}

router.use(chatAuth);

/** The track this request is about (must be one of mine) */
function pickTrack(req) {
    const asked = String(req.query.track || req.body?.track || "").trim();
    if (asked && req.chat.tracks.includes(asked)) return asked;
    return req.chat.tracks[0];
}

function format(m) {
    return {
        id: String(m._id),
        body: m.deletedAt ? "" : m.body,
        deleted: Boolean(m.deletedAt),
        pinned: Boolean(m.pinned),
        createdAt: m.createdAt,
        sender: { id: String(m.sender), name: m.senderName, avatar: m.senderAvatar, role: m.senderRole },
        replyTo: m.replyTo?.id ? { id: String(m.replyTo.id), name: m.replyTo.name, body: m.replyTo.body } : null,
    };
}

function emit(cohort, track, event, payload) {
    try {
        require("../confiq/socket").getIO().to(roomFor(cohort, track)).emit(event, payload);
    } catch {
        /* socket not ready - clients will catch up by polling */
    }
}

/* ------------------------------------------------------------
   GET /me
------------------------------------------------------------ */
router.get("/me", async (req, res) => {
    try {
        const { cohort, tracks, role, userId, name, avatar } = req.chat;
        const track = pickTrack(req);

        const [members, tutors, last, pinned] = await Promise.all([
            CohortRegistration.countDocuments({ cohort, track, status: { $ne: "rejected" } }),
            CohortTutor.find({ cohort, track, status: "active" }).populate("user", "fullName profileImage").lean(),
            TrackChatMessage.findOne({ cohort, track, deletedAt: null }).sort({ createdAt: -1 }).select("createdAt").lean(),
            TrackChatMessage.find({ cohort, track, pinned: true, deletedAt: null }).sort({ updatedAt: -1 }).limit(3).lean(),
        ]);

        const ticket = jwt.sign({ purpose: "trackchat", cohort, track, userId, name }, process.env.JWT_SECRET, {
            expiresIn: "12h",
        });

        return res.json({
            success: true,
            data: {
                me: { id: userId, name, avatar, role },
                cohort,
                track,
                tracks,
                members: members + tutors.length,
                tutors: tutors.map((t) => ({ id: String(t.user?._id || ""), name: t.user?.fullName || "Tutor", avatar: t.user?.profileImage || null })),
                lastMessageAt: last?.createdAt || null,
                pinned: pinned.map(format),
                ticket,
            },
        });
    } catch (error) {
        console.error("[track_chat] me", error);
        return res.status(500).json({ success: false, message: "Could not open the chat." });
    }
});

/* ------------------------------------------------------------
   GET /messages?track=&before=
------------------------------------------------------------ */
router.get("/messages", async (req, res) => {
    try {
        const { cohort } = req.chat;
        const track = pickTrack(req);
        const filter = { cohort, track };
        const before = req.query.before ? new Date(String(req.query.before)) : null;
        if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
        const after = req.query.after ? new Date(String(req.query.after)) : null;
        if (after && !Number.isNaN(after.getTime())) filter.createdAt = { ...(filter.createdAt || {}), $gt: after };

        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const docs = await TrackChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

        return res.json({ success: true, data: { messages: docs.reverse().map(format), hasMore: docs.length === limit } });
    } catch (error) {
        console.error("[track_chat] list", error);
        return res.status(500).json({ success: false, message: "Could not load messages." });
    }
});

/* ------------------------------------------------------------
   POST /messages
------------------------------------------------------------ */
router.post("/messages", async (req, res) => {
    try {
        const { cohort, userId, name, avatar, role } = req.chat;
        const track = pickTrack(req);
        const body = String(req.body?.body || "").trim().slice(0, 2000);
        if (!body) return res.status(400).json({ success: false, message: "Type a message first." });

        let replyTo = undefined;
        if (req.body?.replyTo && mongoose.Types.ObjectId.isValid(req.body.replyTo)) {
            const original = await TrackChatMessage.findOne({ _id: req.body.replyTo, cohort, track }).lean();
            if (original && !original.deletedAt) {
                replyTo = { id: original._id, name: original.senderName, body: String(original.body).slice(0, 140) };
            }
        }

        const doc = await TrackChatMessage.create({
            cohort,
            track,
            sender: userId,
            senderName: name,
            senderAvatar: avatar,
            senderRole: role,
            body,
            replyTo,
        });
        const message = format(doc.toObject());
        emit(cohort, track, "trackchat:message", { track, message });

        res.status(201).json({ success: true, data: message });

        // push to members who aren't in the chat right now
        notifyMembers({ cohort, track, doc, senderId: userId, role }).catch((e) =>
            console.error("[track_chat] push", e?.message)
        );
    } catch (error) {
        console.error("[track_chat] send", error);
        return res.status(500).json({ success: false, message: "Could not send your message." });
    }
});

async function notifyMembers({ cohort, track, doc, senderId, role }) {
    const push = require("../services/push");
    if (!push.isPushConfigured()) return;

    const [regs, tutors] = await Promise.all([
        CohortRegistration.find({ cohort, track, status: { $ne: "rejected" } }).select("user").lean(),
        CohortTutor.find({ cohort, track, status: "active" }).select("user").lean(),
    ]);
    let ids = [...regs.map((r) => String(r.user)), ...tutors.map((t) => String(t.user))].filter((id) => id !== senderId);

    // skip people who have the chat open right now
    try {
        const sockets = await require("../confiq/socket").getIO().in(roomFor(cohort, track)).fetchSockets();
        const online = new Set(sockets.map((s) => s.data?.userId).filter(Boolean));
        ids = ids.filter((id) => !online.has(id));
    } catch {
        /* no socket info - push everyone */
    }

    const subscribed = await push.subscribedUserIds(ids);
    if (!subscribed.length) return;

    const isTutor = role === "tutor";
    const window = Math.floor(Date.now() / (10 * 60 * 1000));
    await push.sendPush({
        userIds: subscribed,
        kind: "track_chat",
        title: isTutor ? `💬 ${doc.senderName} (tutor) in ${track}` : `💬 New messages in ${track}`,
        message: `${doc.senderName.split(" ")[0]}: ${doc.body.replace(/\s+/g, " ").slice(0, 120)}`,
        url: "/cohort/chat",
        audience: track,
        // tutor messages always notify; students' at most once per 10 minutes per track
        dedupeKey: isTutor ? `chat:${doc._id}` : `chat:${cohort}:${track}:${window}`,
    });
}

/* ------------------------------------------------------------
   DELETE /messages/:id
------------------------------------------------------------ */
router.delete("/messages/:id", async (req, res) => {
    try {
        const { cohort, userId, role, tracks } = req.chat;
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: "Message not found." });
        const doc = await TrackChatMessage.findOne({ _id: req.params.id, cohort, track: { $in: tracks } });
        if (!doc) return res.status(404).json({ success: false, message: "Message not found." });
        if (String(doc.sender) !== userId && role !== "tutor") {
            return res.status(403).json({ success: false, message: "You can only delete your own messages." });
        }
        doc.deletedAt = new Date();
        doc.pinned = false;
        await doc.save();
        emit(cohort, doc.track, "trackchat:deleted", { track: doc.track, id: String(doc._id) });
        return res.json({ success: true, data: { id: String(doc._id) } });
    } catch (error) {
        console.error("[track_chat] delete", error);
        return res.status(500).json({ success: false, message: "Could not delete the message." });
    }
});

/* ------------------------------------------------------------
   POST /messages/:id/pin   (tutors)
------------------------------------------------------------ */
router.post("/messages/:id/pin", async (req, res) => {
    try {
        const { cohort, role, tracks } = req.chat;
        if (role !== "tutor") return res.status(403).json({ success: false, message: "Only tutors can pin messages." });
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: "Message not found." });
        const doc = await TrackChatMessage.findOne({ _id: req.params.id, cohort, track: { $in: tracks }, deletedAt: null });
        if (!doc) return res.status(404).json({ success: false, message: "Message not found." });
        doc.pinned = !doc.pinned;
        await doc.save();
        const message = format(doc.toObject());
        emit(cohort, doc.track, "trackchat:updated", { track: doc.track, message });
        return res.json({ success: true, data: message });
    } catch (error) {
        console.error("[track_chat] pin", error);
        return res.status(500).json({ success: false, message: "Could not pin the message." });
    }
});

module.exports = router;
module.exports.roomFor = roomFor;
