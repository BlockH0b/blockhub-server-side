/*
 * Push notifications - admin
 *
 *   GET  /admin_push/status    is push set up? who has notifications on (per track)?
 *   POST /admin_push/test      body: { email? }  -> test push to that person (default: you)
 *   POST /admin_push/send      body: { audience: "all"|"tracks"|"person", tracks?, email?, title, message, url? }
 *   GET  /admin_push/history   last pushes sent
 */
const express = require("express");

const requireAdmin = require("../middlewave/adminAuth");
const User = require("../models/user");
const CohortRegistration = require("../models/Cohort");
const PushSubscriber = require("../models/PushSubscriber");
const PushLog = require("../models/PushLog");
const { normalizeTrack, COHORT_TRACKS } = require("../config/cohortTracks");
const { getPushConfig, isPushConfigured, sendPush, subscribedUserIds } = require("../services/push");

const router = express.Router();
router.use(requireAdmin);

const DEFAULT_COHORT = process.env.DEFAULT_COHORT || "cohort-1.0";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findUserByEmail(email) {
    const clean = String(email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return null;
    const user = await User.findOne({ email: clean }).select("_id fullName email").lean();
    if (user) return user;
    const reg = await CohortRegistration.findOne({ email: clean }).select("user fullName email").lean();
    return reg?.user ? { _id: reg.user, fullName: reg.fullName, email: reg.email } : null;
}

function cleanUrl(url) {
    const value = String(url || "").trim();
    if (!value) return null;
    if (/^https:\/\//i.test(value) || value.startsWith("/")) return value.slice(0, 500);
    return null;
}

/* ---------- status ---------- */
router.get("/status", async (req, res) => {
    try {
        const config = getPushConfig();
        const [regs, subs, totalSubscribed, recent] = await Promise.all([
            CohortRegistration.find({ cohort: DEFAULT_COHORT, status: { $ne: "rejected" } }).select("user track").lean(),
            PushSubscriber.find({ subscribed: true }).select("user platform").lean(),
            PushSubscriber.countDocuments({ subscribed: true }),
            PushLog.find().sort({ createdAt: -1 }).limit(25).lean(),
        ]);

        const on = new Set(subs.map((s) => String(s.user)));
        const byTrackMap = new Map();
        for (const r of regs) {
            const track = normalizeTrack(r.track) || r.track || "Other";
            const row = byTrackMap.get(track) || { track, students: 0, subscribed: 0 };
            row.students += 1;
            if (on.has(String(r.user))) row.subscribed += 1;
            byTrackMap.set(track, row);
        }
        const byTrack = [...byTrackMap.values()].sort((a, b) => b.students - a.students);

        const platforms = subs.reduce((acc, s) => {
            acc[s.platform || "other"] = (acc[s.platform || "other"] || 0) + 1;
            return acc;
        }, {});

        return res.json({
            success: true,
            data: {
                configured: isPushConfigured(),
                appIdSet: Boolean(config.appId),
                apiKeySet: Boolean(config.apiKey),
                enabled: config.enabled,
                totalSubscribed,
                platforms,
                byTrack,
                tracks: COHORT_TRACKS,
                recent,
            },
        });
    } catch (error) {
        console.error("[admin_push] status", error);
        return res.status(500).json({ success: false, message: "Could not load push status." });
    }
});

/* ---------- test ---------- */
router.post("/test", async (req, res) => {
    try {
        const admin = await User.findById(req.adminUser._id).select("_id fullName email").lean();
        const target = req.body?.email ? await findUserByEmail(req.body.email) : admin;
        if (!target) {
            return res.status(404).json({ success: false, message: "No BlockHub account with that email." });
        }

        const [isOn] = await subscribedUserIds([target._id]);
        if (!isOn) {
            return res.status(400).json({
                success: false,
                message: `${target.email || "This account"} hasn't turned on notifications yet. Open the BlockHub app on the phone, log in and tap "Turn on notifications".`,
            });
        }

        const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
        const result = await sendPush({
            userIds: [target._id],
            title: "Test notification ✅",
            message: `Push is working. Sent by ${admin?.fullName || "BlockHub admin"} at ${time}.`,
            url: "/cohort/my-dashboard",
            kind: "test",
            audience: target.email || String(target._id),
            sentBy: admin?._id,
        });

        const ok = result.status === "sent" && !result.unreachable?.length;
        return res.status(ok ? 200 : 400).json({
            success: ok,
            message: ok
                ? `Test push sent to ${target.email || "the device"}.`
                : result.unreachable?.length
                    ? "OneSignal has no device for this account. Open the app on the phone and turn notifications on again."
                    : `Not sent: ${result.reason}`,
            data: result,
        });
    } catch (error) {
        console.error("[admin_push] test", error);
        return res.status(500).json({ success: false, message: "Could not send the test push." });
    }
});

/* ---------- send ---------- */
router.post("/send", async (req, res) => {
    try {
        const body = req.body || {};
        const title = String(body.title || "").trim();
        const message = String(body.message || "").trim();
        const url = cleanUrl(body.url);

        if (!title || title.length > 80) return res.status(400).json({ success: false, message: "Add a title (up to 80 characters)." });
        if (!message || message.length > 300) return res.status(400).json({ success: false, message: "Add a message (up to 300 characters)." });
        if (body.url && !url) return res.status(400).json({ success: false, message: "The link must start with https:// or /" });
        if (!isPushConfigured()) return res.status(400).json({ success: false, message: "Push isn't set up on the server yet (OneSignal keys missing)." });

        let userIds = [];
        let audience = "";
        let notReached = 0;

        if (body.audience === "all") {
            userIds = (await PushSubscriber.find({ subscribed: true }).select("user").lean()).map((s) => String(s.user));
            audience = "Everyone with notifications on";
        } else if (body.audience === "tracks") {
            const tracks = (Array.isArray(body.tracks) ? body.tracks : []).map(normalizeTrack).filter(Boolean);
            if (!tracks.length) return res.status(400).json({ success: false, message: "Pick at least one track." });
            const regs = await CohortRegistration.find({ cohort: DEFAULT_COHORT, track: { $in: tracks }, status: { $ne: "rejected" } })
                .select("user")
                .lean();
            const all = [...new Set(regs.map((r) => String(r.user)))];
            userIds = await subscribedUserIds(all);
            notReached = all.length - userIds.length;
            audience = tracks.join(", ");
        } else if (body.audience === "person") {
            const user = await findUserByEmail(body.email);
            if (!user) return res.status(404).json({ success: false, message: "No BlockHub account with that email." });
            userIds = await subscribedUserIds([user._id]);
            if (!userIds.length) return res.status(400).json({ success: false, message: "That person hasn't turned on notifications yet." });
            audience = user.email;
        } else {
            return res.status(400).json({ success: false, message: "Choose who to send to." });
        }

        if (!userIds.length) {
            return res.status(400).json({ success: false, message: "Nobody in that group has turned on notifications yet." });
        }

        const result = await sendPush({
            userIds,
            title,
            message,
            url,
            kind: "broadcast",
            audience,
            sentBy: req.adminUser._id,
        });

        const delivered = userIds.length - (result.unreachable?.length || 0);
        return res.status(result.status === "sent" ? 200 : 400).json({
            success: result.status === "sent",
            message:
                result.status === "sent"
                    ? `Sent to ${delivered} ${delivered === 1 ? "person" : "people"}.${notReached ? ` ${notReached} in these tracks don't have notifications on yet.` : ""}`
                    : `Not sent: ${result.reason}`,
            data: { ...result, delivered, notReached },
        });
    } catch (error) {
        console.error("[admin_push] send", error);
        return res.status(500).json({ success: false, message: "Could not send the notification." });
    }
});

/* ---------- history ---------- */
router.get("/history", async (req, res) => {
    try {
        const items = await PushLog.find().sort({ createdAt: -1 }).limit(50).lean();
        return res.json({ success: true, data: items });
    } catch (error) {
        console.error("[admin_push] history", error);
        return res.status(500).json({ success: false, message: "Could not load history." });
    }
});

module.exports = router;
