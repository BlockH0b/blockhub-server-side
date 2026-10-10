/*
 * ==================================================================
 * /email  -  verification, preferences, unsubscribe, admin tools
 * ==================================================================
 *  USER (logged in with the main "token" cookie)
 *    GET  /email/me                     my email + preferences
 *    PUT  /email/me/preferences         update my preferences
 *    POST /email/verify/request         { email } -> sends confirm link
 *
 *  LINKS INSIDE EMAILS (no login needed)
 *    GET  /email/verify?token=          confirm email -> redirects to site
 *    GET  /email/preferences?token=     read preferences
 *    PUT  /email/preferences?token=     update preferences
 *    GET|POST /email/unsubscribe?token=&category=
 *
 *  ADMIN
 *    GET  /email/status                 provider, test mode, last 24h counts
 *    GET  /email/logs                   recent emails (?status=&template=&to=)
 *    POST /email/test                   { to? } send a test email
 *    POST /email/jobs/:name/run         run a scheduled email job now
 * ==================================================================
 */

const express = require("express");
const router = express.Router();

const User = require("../models/user");
const EmailLog = require("../models/EmailLog");
const auth = require("../middlewave/auth");
const requireAdmin = require("../middlewave/adminAuth");

const { sendEmail, isValidEmail } = require("../services/email");
const notify = require("../services/email/notify");
const { getConfig } = require("../services/email/config");
const { readPreferencesToken, readVerifyEmailToken } = require("../services/email/tokens");
const { jobs } = require("../services/email/jobs");

const CATEGORIES = ["classUpdates", "announcements", "campaigns", "learning", "sales", "referrals", "digest"];

function preferencesPayload(user) {
    const prefs = {};
    for (const key of CATEGORIES) prefs[key] = user.emailPreferences?.[key] !== false;
    return {
        email: user.email || null,
        emailVerified: Boolean(user.emailVerified),
        unsubscribedAll: Boolean(user.unsubscribedAll),
        preferences: prefs,
    };
}

function applyPreferences(user, body = {}) {
    if (!user.emailPreferences) user.emailPreferences = {};
    for (const key of CATEGORIES) {
        if (typeof body.preferences?.[key] === "boolean") user.emailPreferences[key] = body.preferences[key];
    }
    if (typeof body.unsubscribedAll === "boolean") user.unsubscribedAll = body.unsubscribedAll;
    user.markModified("emailPreferences");
}

// small per-user limiter for verification emails
const verifyHits = new Map();
function tooManyVerifyRequests(userId) {
    const now = Date.now();
    const entry = verifyHits.get(userId) || { count: 0, reset: now + 60 * 60 * 1000 };
    if (entry.reset < now) {
        entry.count = 0;
        entry.reset = now + 60 * 60 * 1000;
    }
    entry.count += 1;
    verifyHits.set(userId, entry);
    return entry.count > 5;
}

/* ==================================================================
   LOGGED-IN USER
================================================================== */

router.get("/me", auth, async (req, res) => {
    return res.json({ success: true, data: preferencesPayload(req.user) });
});

router.put("/me/preferences", auth, async (req, res) => {
    try {
        applyPreferences(req.user, req.body);
        await req.user.save();
        return res.json({ success: true, message: "Email preferences saved.", data: preferencesPayload(req.user) });
    } catch (error) {
        console.error("update preferences error:", error);
        return res.status(500).json({ success: false, message: "Couldn't save your preferences." });
    }
});

router.post("/verify/request", auth, async (req, res) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        if (tooManyVerifyRequests(String(req.user._id))) {
            return res.status(429).json({ success: false, message: "Too many requests. Please try again in an hour." });
        }

        const taken = await User.exists({ email, _id: { $ne: req.user._id } });
        if (taken) {
            return res.status(409).json({
                success: false,
                message: "This email is already linked to another BlockHub account.",
            });
        }

        if (req.user.email === email && req.user.emailVerified) {
            return res.json({ success: true, message: "This email is already confirmed." });
        }

        const result = await notify.sendVerification(req.user, email);

        if (result.status === "failed") {
            return res.status(502).json({ success: false, message: "We couldn't send the email. Please try again." });
        }

        return res.json({
            success: true,
            message: `We sent a confirmation link to ${email}. Check your inbox (and spam).`,
        });
    } catch (error) {
        console.error("verify request error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong." });
    }
});

/* ==================================================================
   LINKS INSIDE EMAILS
================================================================== */

router.get("/verify", async (req, res) => {
    const { frontendUrl } = getConfig();
    const go = (status) => res.redirect(`${frontendUrl}/email/verified?status=${status}`);

    try {
        const { userId, email } = readVerifyEmailToken(String(req.query.token || ""));

        const taken = await User.exists({ email, _id: { $ne: userId } });
        if (taken) return go("taken");

        const user = await User.findById(userId);
        if (!user) return go("invalid");

        user.email = email;
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();

        const firstTime = !user.welcomeEmailSentAt;
        if (firstTime) user.welcomeEmailSentAt = new Date();
        await user.save();

        if (firstTime) notify.welcome(user);

        return go("ok");
    } catch (error) {
        return go(error?.name === "TokenExpiredError" ? "expired" : "invalid");
    }
});

async function userFromPrefsToken(req, res) {
    try {
        const userId = readPreferencesToken(String(req.query.token || req.body?.token || ""));
        const user = await User.findById(userId);
        if (!user) throw new Error("not found");
        return user;
    } catch {
        res.status(401).json({ success: false, message: "This link is invalid or has expired." });
        return null;
    }
}

router.get("/preferences", async (req, res) => {
    const user = await userFromPrefsToken(req, res);
    if (!user) return;
    return res.json({ success: true, data: { ...preferencesPayload(user), name: user.fullName } });
});

router.put("/preferences", async (req, res) => {
    const user = await userFromPrefsToken(req, res);
    if (!user) return;
    applyPreferences(user, req.body);
    await user.save();
    return res.json({ success: true, message: "Email preferences saved.", data: preferencesPayload(user) });
});

async function unsubscribe(req, res, { redirect }) {
    const user = await userFromPrefsToken(req, res);
    if (!user) return;

    const category = String(req.query.category || "");
    if (CATEGORIES.includes(category)) {
        if (!user.emailPreferences) user.emailPreferences = {};
        user.emailPreferences[category] = false;
        user.markModified("emailPreferences");
    } else {
        user.unsubscribedAll = true;
    }
    await user.save();

    if (!redirect) return res.status(200).send("Unsubscribed");

    const { frontendUrl } = getConfig();
    return res.redirect(
        `${frontendUrl}/email/preferences?token=${encodeURIComponent(String(req.query.token))}&unsubscribed=${encodeURIComponent(category || "all")}`
    );
}

router.get("/unsubscribe", (req, res) => unsubscribe(req, res, { redirect: true }));
// One-click unsubscribe from Gmail / Outlook (RFC 8058)
router.post("/unsubscribe", express.urlencoded({ extended: false }), (req, res) => unsubscribe(req, res, { redirect: false }));

/* ==================================================================
   ADMIN
================================================================== */

router.get("/status", requireAdmin, async (req, res) => {
    const config = getConfig();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const counts = await EmailLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.json({
        success: true,
        data: {
            provider: config.smtp ? `SMTP (${config.smtp.host})` : "Gmail (MAIL_USER)",
            from: config.from,
            testMode: config.testMode,
            testRecipients: config.testRecipients,
            testMaxPerBatch: config.testMaxPerBatch,
            disabled: config.disabled,
            jobsEnabled: config.jobsEnabled,
            last24h: Object.fromEntries(counts.map((c) => [c._id, c.count])),
        },
    });
});

router.get("/logs", requireAdmin, async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.template) filter.template = String(req.query.template);
    if (req.query.to) filter.to = String(req.query.to).toLowerCase();

    const logs = await EmailLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 500)).lean();
    return res.json({ success: true, data: logs });
});

router.post("/test", requireAdmin, async (req, res) => {
    const admin = await User.findById(req.adminUser._id).select("fullName email").lean();
    const to = String(req.body?.to || admin?.email || "").trim();

    if (!isValidEmail(to)) {
        return res.status(400).json({ success: false, message: "Give a 'to' email (your admin account has none)." });
    }

    const result = await sendEmail({
        to,
        template: "test_email",
        data: { sentBy: admin?.fullName },
        category: "essential",
    });

    const config = getConfig();
    return res.json({
        success: result.status === "sent",
        message:
            result.status === "sent"
                ? config.testMode
                    ? `Test mode is ON - delivered to ${config.testRecipients.join(", ")}`
                    : `Sent to ${to}`
                : `Not sent: ${result.reason}`,
        data: result,
    });
});

router.post("/jobs/:name/run", requireAdmin, async (req, res) => {
    const job = jobs[req.params.name];
    if (!job) {
        return res.status(404).json({ success: false, message: `Unknown job. Use one of: ${Object.keys(jobs).join(", ")}` });
    }
    try {
        await job();
        return res.json({ success: true, message: `${req.params.name} ran. Check /email/logs.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error?.message });
    }
});

module.exports = router;
