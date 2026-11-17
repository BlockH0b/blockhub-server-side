/*
 * ============================================================
 * BlockHub email service
 * ============================================================
 *
 *   sendEmail({ to, template, data, category, user, dedupeKey })
 *     -> sends one email now (awaitable). Use for receipts, links.
 *
 *   queueEmail(sameOptions)
 *     -> puts it on the background queue and returns immediately.
 *        Use from routes so the API never waits for email.
 *
 *   queueBulk(recipients, { template, data, category, dedupePrefix })
 *     -> recipients = [{ email, name, userId }]
 *        Everyone gets their own personalised email.
 *
 * Categories (user can opt out of all except "essential"):
 *   essential | classUpdates | announcements | campaigns |
 *   learning | sales | referrals | digest
 * ============================================================
 */

const User = require("../../models/user");
const EmailLog = require("../../models/EmailLog");
const { deliver, resetTransporter, retryAfterMinutes } = require("./transport");
const { getConfig } = require("./config");
const { layout } = require("./layout");
const { templates } = require("./templates");
const { preferencesToken } = require("./tokens");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return typeof email === "string" && EMAIL_RE.test(email.trim());
}

/* ------------------------------------------------------------
   Preferences
------------------------------------------------------------ */

async function checkPreferences(userId, category) {
    if (!userId || category === "essential") return { allowed: true };

    const user = await User.findById(userId).select("unsubscribedAll emailPreferences").lean();
    if (!user) return { allowed: true };

    if (user.unsubscribedAll) return { allowed: false, reason: "unsubscribed from all" };
    if (user.emailPreferences && user.emailPreferences[category] === false) {
        return { allowed: false, reason: `unsubscribed from ${category}` };
    }
    return { allowed: true };
}

/* ------------------------------------------------------------
   Render
------------------------------------------------------------ */

function render(template, data, { userId, category }) {
    const builder = templates[template];
    if (!builder) throw new Error(`Unknown email template "${template}"`);

    const config = getConfig();
    const ctx = { frontendUrl: config.frontendUrl, communityLink: config.communityLink };
    const out = builder(data || {}, ctx);

    let preferencesUrl;
    let unsubscribeUrl;

    if (userId) {
        const token = preferencesToken(userId);
        preferencesUrl = `${config.frontendUrl}/email/preferences?token=${encodeURIComponent(token)}`;
        if (category && category !== "essential") {
            unsubscribeUrl = `${config.apiUrl}/email/unsubscribe?token=${encodeURIComponent(token)}&category=${encodeURIComponent(category)}`;
        }
    }

    return {
        subject: out.subject,
        text: out.text,
        html: layout(out.html, { preheader: out.preheader, preferencesUrl, unsubscribeUrl }),
        unsubscribeUrl,
    };
}

/* ------------------------------------------------------------
   Send one
------------------------------------------------------------ */

/**
 * @returns {Promise<{status: "sent"|"skipped"|"failed", reason?: string}>}
 */
async function sendEmail({
    to,
    template,
    data = {},
    category = "essential",
    user = null, // userId - enables preferences + unsubscribe link
    dedupeKey,
    attachments,
    icalEvent, // calendar invite (see services/meetings/calendar.js)
    _skipTestLimit = false,
    _retryLogId = null, // set by the retry job: re-use that log
}) {
    const email = String(to || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
        return { status: "skipped", reason: "no valid email" };
    }

    const prefs = await checkPreferences(user, category);
    const config = getConfig();

    let log;
    if (_retryLogId) {
        log = await EmailLog.findOneAndUpdate(
            { _id: _retryLogId, status: "retry" },
            { status: "queued" },
            { new: true }
        );
        if (!log) return { status: "skipped", reason: "retry already handled" };
    } else {
        // Already sent / waiting to retry? (dedupe)
        if (dedupeKey) {
            const exists = await EmailLog.exists({ dedupeKey, status: { $in: ["sent", "queued", "retry"] } });
            if (exists) return { status: "skipped", reason: "already sent" };
        }

        try {
            log = await EmailLog.create({
                template,
                category,
                user: user || null,
                to: email,
                status: "queued",
                testMode: config.testMode,
                dedupeKey: dedupeKey || undefined,
            });
        } catch (error) {
            if (error?.code === 11000) return { status: "skipped", reason: "already sent" };
            throw error;
        }
    }

    if (!prefs.allowed) {
        await EmailLog.updateOne({ _id: log._id }, { status: "skipped", skipReason: prefs.reason });
        return { status: "skipped", reason: prefs.reason };
    }

    if (_skipTestLimit) {
        await EmailLog.updateOne({ _id: log._id }, { status: "skipped", skipReason: "test mode batch limit" });
        return { status: "skipped", reason: "test mode batch limit" };
    }

    try {
        const rendered = render(template, data, { userId: user, category });

        const headers = rendered.unsubscribeUrl
            ? {
                "List-Unsubscribe": `<${rendered.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
            : undefined;

        const result = await deliver({
            to: email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            headers,
            attachments,
            icalEvent,
        });

        await EmailLog.updateOne(
            { _id: log._id },
            result.delivered
                ? { status: "sent", subject: rendered.subject, deliveredTo: result.recipients, sentAt: new Date() }
                : { status: "skipped", subject: rendered.subject, skipReason: result.reason }
        );

        return result.delivered ? { status: "sent" } : { status: "skipped", reason: result.reason };
    } catch (error) {
        const waitMinutes = retryAfterMinutes(error);
        const attempts = (log.attempts || 0) + 1;

        // Gmail said "later" -> keep it and try again automatically
        if (waitMinutes && attempts < 8) {
            const backoff = waitMinutes * Math.min(attempts, 4);
            console.warn(`[email] ${template} -> ${email} will retry in ${backoff} min: ${String(error?.message || "").split("\n")[0]}`);
            await EmailLog.updateOne(
                { _id: log._id },
                {
                    status: "retry",
                    attempts,
                    nextAttemptAt: new Date(Date.now() + backoff * 60000),
                    error: String(error?.message || error).slice(0, 500),
                    payload: { to: email, template, data, category, user: user || null, dedupeKey, attachments, icalEvent },
                }
            );
            return { status: "retry", reason: error?.message, pauseMinutes: waitMinutes };
        }

        console.error(`[email] ${template} -> ${email} failed:`, error?.message);
        // Free the dedupe key so a later send can try again
        await EmailLog.updateOne(
            { _id: log._id },
            { status: "failed", attempts, error: String(error?.message || error).slice(0, 500), $unset: { dedupeKey: 1, payload: 1 } }
        );
        return { status: "failed", reason: error?.message };
    }
}

/* ------------------------------------------------------------
   Background queue (in-process, throttled)
   Good up to a few thousand emails per send. For more, move this
   to BullMQ + Redis (already installed) - same API.
------------------------------------------------------------ */

const queue = [];
let running = false;
let pausedUntil = 0; // when Gmail pushes back, stop sending for a while

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Save everything still waiting in memory as "retry" so nothing is lost */
async function parkQueue(minutes) {
    const waiting = queue.splice(0, queue.length);
    const at = new Date(Date.now() + minutes * 60000);
    for (const job of waiting) {
        if (job._retryLogId) {
            await EmailLog.updateOne({ _id: job._retryLogId }, { nextAttemptAt: at }).catch(() => null);
            continue;
        }
        const email = String(job.to || "").trim().toLowerCase();
        if (!isValidEmail(email) || job._skipTestLimit) continue;
        try {
            if (job.dedupeKey && (await EmailLog.exists({ dedupeKey: job.dedupeKey, status: { $in: ["sent", "queued", "retry"] } }))) continue;
            await EmailLog.create({
                template: job.template,
                category: job.category || "essential",
                user: job.user || null,
                to: email,
                status: "retry",
                testMode: getConfig().testMode,
                dedupeKey: job.dedupeKey || undefined,
                nextAttemptAt: at,
                error: "Waiting: email provider asked us to slow down",
                payload: { ...job, to: email, _skipTestLimit: undefined, _retryLogId: undefined },
            });
        } catch (error) {
            if (error?.code !== 11000) console.error("[email] park error:", error?.message);
        }
    }
    if (waiting.length) console.warn(`[email] paused ${minutes} min - saved ${waiting.length} emails to retry`);
}

async function runQueue() {
    if (running) return;
    if (Date.now() < pausedUntil) return;
    running = true;
    try {
        while (queue.length) {
            const job = queue.shift();
            try {
                const result = await sendEmail(job);
                if (result?.status === "retry") {
                    // Stop hammering the provider: one failed login + 200 queued
                    // emails = 200 more logins, which is what locks Gmail.
                    const minutes = result.pauseMinutes || 15;
                    pausedUntil = Date.now() + minutes * 60000;
                    resetTransporter();
                    await parkQueue(minutes);
                    break;
                }
            } catch (error) {
                console.error("[email] queue job error:", error?.message);
            }
            const perMinute = getConfig().ratePerMinute;
            await sleep(Math.max(50, Math.floor(60000 / perMinute)));
        }
    } finally {
        running = false;
    }
}

/** Some emails are useless if they arrive late - don't send them */
function staleReason(payload) {
    const now = Date.now();
    const cls = payload?.data?.cls;
    const startsAt = cls?.startsAt ? new Date(cls.startsAt).getTime() : null;
    const endsAt = cls?.endsAt ? new Date(cls.endsAt).getTime() : null;
    if (["class_reminder", "tutor_link_missing"].includes(payload.template) && startsAt && startsAt < now) {
        return "class already started - reminder no longer useful";
    }
    if (["class_link_ready", "class_link_copy"].includes(payload.template) && (endsAt || startsAt) && (endsAt || startsAt) < now) {
        return "class already over";
    }
    if (/login_link|otp/i.test(payload.template)) {
        return "login link too old - the user can request a new one";
    }
    return null;
}

/**
 * Called by a job every 5 minutes: send the emails that are waiting
 * to be retried (oldest first, a batch at a time).
 */
async function retryDeferred({ limit = 60 } = {}) {
    if (Date.now() < pausedUntil) return { retried: 0, pausedUntil: new Date(pausedUntil) };
    const due = await EmailLog.find({ status: "retry", nextAttemptAt: { $lte: new Date() } })
        .sort({ nextAttemptAt: 1 })
        .limit(limit)
        .select("_id payload")
        .lean();
    for (const log of due) {
        if (!log.payload?.to || !log.payload?.template) {
            await EmailLog.updateOne({ _id: log._id }, { status: "failed", error: "nothing saved to retry" });
            continue;
        }
        const stale = staleReason(log.payload);
        if (stale) {
            await EmailLog.updateOne({ _id: log._id }, { status: "skipped", skipReason: stale, $unset: { payload: 1 } });
            continue;
        }
        queue.push({ ...log.payload, _retryLogId: log._id });
    }
    if (due.length) {
        console.log(`[email] retrying ${due.length} delayed emails`);
        setImmediate(runQueue);
    }
    return { retried: due.length };
}

/** For the admin page */
async function queueStatus() {
    const [retrying, failedToday] = await Promise.all([
        EmailLog.countDocuments({ status: "retry" }),
        EmailLog.countDocuments({ status: "failed", createdAt: { $gte: new Date(Date.now() - 86400000) } }),
    ]);
    return {
        inMemory: queue.length,
        retrying,
        failedToday,
        pausedUntil: Date.now() < pausedUntil ? new Date(pausedUntil) : null,
    };
}

function queueEmail(options) {
    queue.push(options);
    if (Date.now() < pausedUntil) {
        // paused: save it for the retry job instead of holding it in memory
        setImmediate(() => parkQueue(Math.ceil((pausedUntil - Date.now()) / 60000)));
        return;
    }
    setImmediate(runQueue);
}

/**
 * recipients: [{ email, name, userId, data? }]
 * common: { template, data, category, dedupePrefix }
 *   - data is merged with { name } and recipient.data
 *   - dedupePrefix + userId/email becomes the dedupe key
 */
function queueBulk(recipients, { template, data = {}, category = "essential", dedupePrefix, attachments }) {
    const config = getConfig();
    const seen = new Set();
    let count = 0;

    for (const r of recipients || []) {
        const email = String(r?.email || "").trim().toLowerCase();
        if (!isValidEmail(email) || seen.has(email)) continue;
        seen.add(email);

        count += 1;
        const overTestLimit = config.testMode && count > config.testMaxPerBatch;

        queueEmail({
            to: email,
            template,
            category,
            user: r.userId || null,
            data: { ...data, name: r.name, ...(r.data || {}) },
            dedupeKey: dedupePrefix ? `${dedupePrefix}:${r.userId || email}` : undefined,
            attachments,
            _skipTestLimit: overTestLimit,
        });
    }

    if (count) console.log(`[email] queued ${count} × ${template}${config.testMode ? " (TEST MODE)" : ""}`);
    return count;
}

/** Fire-and-forget helper for routes: never throws, never blocks the response */
function safely(promiseOrFn, label = "email") {
    Promise.resolve()
        .then(typeof promiseOrFn === "function" ? promiseOrFn : () => promiseOrFn)
        .catch((error) => console.error(`[${label}]`, error?.message || error));
}

module.exports = {
    sendEmail,
    queueEmail,
    queueBulk,
    retryDeferred,
    queueStatus,
    safely,
    isValidEmail,
    render,
};
