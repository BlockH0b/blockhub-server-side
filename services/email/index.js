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
const { deliver } = require("./transport");
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
    _skipTestLimit = false,
}) {
    const email = String(to || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
        return { status: "skipped", reason: "no valid email" };
    }

    // Already sent? (dedupe)
    if (dedupeKey) {
        const exists = await EmailLog.exists({ dedupeKey, status: { $in: ["sent", "queued"] } });
        if (exists) return { status: "skipped", reason: "already sent" };
    }

    const prefs = await checkPreferences(user, category);
    const config = getConfig();

    let log;
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
        });

        await EmailLog.updateOne(
            { _id: log._id },
            result.delivered
                ? { status: "sent", subject: rendered.subject, deliveredTo: result.recipients, sentAt: new Date() }
                : { status: "skipped", subject: rendered.subject, skipReason: result.reason }
        );

        return result.delivered ? { status: "sent" } : { status: "skipped", reason: result.reason };
    } catch (error) {
        console.error(`[email] ${template} -> ${email} failed:`, error?.message);
        // Free the dedupe key so a later retry can send it
        await EmailLog.updateOne(
            { _id: log._id },
            { status: "failed", error: String(error?.message || error).slice(0, 500), $unset: { dedupeKey: 1 } }
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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQueue() {
    if (running) return;
    running = true;
    try {
        while (queue.length) {
            const job = queue.shift();
            try {
                await sendEmail(job);
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

function queueEmail(options) {
    queue.push(options);
    setImmediate(runQueue);
}

/**
 * recipients: [{ email, name, userId, data? }]
 * common: { template, data, category, dedupePrefix }
 *   - data is merged with { name } and recipient.data
 *   - dedupePrefix + userId/email becomes the dedupe key
 */
function queueBulk(recipients, { template, data = {}, category = "essential", dedupePrefix }) {
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
    safely,
    isValidEmail,
    render,
};
