/*
 * Push notifications - for the app (students and tutors)
 *
 *   GET  /push/me             -> { userId, subscribed, configured }
 *                                the app logs this userId in to OneSignal
 *   POST /push/subscription   body: { subscribed, subscriptionId, platform, standalone }
 *                                the app reports when notifications are turned on/off
 *
 * Works with the student cookie (BHCtoken) or the normal login cookie (tutors).
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const PushSubscriber = require("../models/PushSubscriber");
const { isPushConfigured } = require("../services/push");

const router = express.Router();

function verify(token) {
    if (!token || typeof token !== "string") return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

/** Who is calling? Student cohort cookie first, then the normal login cookie. */
function identify(req) {
    const cohort = verify(req.cookies?.BHCtoken);
    if (cohort?.purpose === "cohort_dashboard" && cohort.userId) return String(cohort.userId);

    const main = verify(req.cookies?.token || req.cookies?.accessToken || req.cookies?.jwt);
    const id = main?.id || main?.userId || main?._id;
    return id ? String(id) : null;
}

function requireUser(req, res, next) {
    const userId = identify(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({ success: false, message: "Please log in." });
    }
    req.pushUserId = userId;
    next();
}

const PLATFORMS = ["ios", "android", "desktop", "other"];

router.get("/me", requireUser, async (req, res) => {
    try {
        const row = await PushSubscriber.findOne({ user: req.pushUserId }).select("subscribed").lean();
        return res.json({
            success: true,
            data: { userId: req.pushUserId, subscribed: Boolean(row?.subscribed), configured: isPushConfigured() },
        });
    } catch (error) {
        console.error("[push] me", error?.message);
        return res.status(500).json({ success: false, message: "Could not check notifications." });
    }
});

router.post("/subscription", requireUser, async (req, res) => {
    try {
        const body = req.body || {};
        const platform = PLATFORMS.includes(body.platform) ? body.platform : "other";
        const subscriptionId =
            typeof body.subscriptionId === "string" && body.subscriptionId.length <= 100 ? body.subscriptionId : null;

        await PushSubscriber.updateOne(
            { user: req.pushUserId },
            {
                $set: {
                    subscribed: body.subscribed === true,
                    subscriptionId,
                    platform,
                    standalone: body.standalone === true,
                    lastSeenAt: new Date(),
                },
            },
            { upsert: true }
        );
        return res.json({ success: true });
    } catch (error) {
        console.error("[push] subscription", error?.message);
        return res.status(500).json({ success: false, message: "Could not save notification settings." });
    }
});

module.exports = router;
