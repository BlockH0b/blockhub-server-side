/*
 * ============================================================
 * BlockHub push notifications (OneSignal)
 * ============================================================
 *
 * .env
 *   ONESIGNAL_APP_ID=e4482b39-...        (same App ID the website uses)
 *   ONESIGNAL_REST_API_KEY=os_v2_app_... (OneSignal > Settings > Keys & IDs)
 *   PUSH_ENABLED=false                   (optional: turn push off, email only)
 *
 * Each device in the app logs in to OneSignal with the user's _id
 * (external_id), so we send to people by their BlockHub user id.
 *
 *   sendPush({ userIds, title, message, url, kind, dedupeKey })
 *     -> push to those users (or { all: true } for everyone subscribed)
 *
 *   pushFirst(recipients, { push, email })
 *     -> push to everyone who has notifications on, and EMAIL ONLY
 *        the people who don't. Saves the daily email limit.
 * ============================================================
 */

const PushSubscriber = require("../../models/PushSubscriber");
const PushLog = require("../../models/PushLog");

const API_URL = "https://api.onesignal.com/notifications";
const MAX_PER_REQUEST = 20000; // OneSignal limit for include_aliases

function getPushConfig() {
    const off = ["false", "0", "off", "no"].includes(String(process.env.PUSH_ENABLED || "").trim().toLowerCase());
    return {
        appId: process.env.ONESIGNAL_APP_ID || "",
        apiKey: process.env.ONESIGNAL_REST_API_KEY || "",
        enabled: !off,
        frontendUrl: (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, ""),
    };
}

function isPushConfigured() {
    const c = getPushConfig();
    return Boolean(c.enabled && c.appId && c.apiKey);
}

function absoluteUrl(url) {
    const { frontendUrl } = getPushConfig();
    if (!url) return `${frontendUrl}/cohort/my-dashboard`;
    if (/^https?:\/\//i.test(url)) return url;
    return `${frontendUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

async function callOneSignal(body) {
    const { appId, apiKey } = getPushConfig();
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
        body: JSON.stringify({ app_id: appId, ...body }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const detail = data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`;
        throw new Error(`OneSignal: ${detail}`.slice(0, 400));
    }
    return data;
}

/** User ids OneSignal says it has no device for */
function unreachableFrom(data, sentIds) {
    const errors = data?.errors;
    if (!errors) return data?.id ? [] : sentIds;
    if (Array.isArray(errors)) {
        // e.g. ["All included players are not subscribed"]
        return data?.id ? [] : sentIds;
    }
    const ids = errors?.invalid_aliases?.external_id || errors?.invalid_external_user_ids || [];
    return Array.isArray(ids) ? ids.map(String) : [];
}

const clip = (text, max) => {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * Send one push notification.
 * @returns {Promise<{status: "sent"|"skipped"|"failed", reason?, targeted, unreachable: string[], logId?}>}
 */
async function sendPush({
    userIds = [],
    all = false,
    title,
    message,
    url,
    kind = "custom",
    audience = "",
    dedupeKey,
    sentBy = null,
}) {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];

    if (!isPushConfigured()) {
        return { status: "skipped", reason: "push is not set up (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY)", targeted: 0, unreachable: ids };
    }
    if (!all && !ids.length) {
        return { status: "skipped", reason: "nobody to send to", targeted: 0, unreachable: [] };
    }

    const heading = clip(title, 80);
    const body = clip(message, 300);

    let log;
    try {
        log = await PushLog.create({
            kind,
            title: heading,
            message: body,
            url: url || null,
            audience,
            targeted: ids.length,
            dedupeKey: dedupeKey || undefined,
            sentBy: sentBy || null,
        });
    } catch (error) {
        if (error?.code === 11000) return { status: "skipped", reason: "already sent", targeted: 0, unreachable: [] };
        throw error;
    }

    const base = {
        target_channel: "push",
        headings: { en: heading },
        contents: { en: body },
        web_url: absoluteUrl(url),
        chrome_web_icon: `${getPushConfig().frontendUrl}/android-chrome-192x192.png`,
    };

    try {
        let onesignalId = null;
        const unreachable = [];

        if (all) {
            const data = await callOneSignal({ ...base, included_segments: ["Subscribed Users"] });
            onesignalId = data?.id || null;
        } else {
            for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
                const chunk = ids.slice(i, i + MAX_PER_REQUEST);
                const data = await callOneSignal({ ...base, include_aliases: { external_id: chunk } });
                onesignalId = onesignalId || data?.id || null;
                unreachable.push(...unreachableFrom(data, chunk));
            }
        }

        // Their app was uninstalled / notifications turned off: email them next time
        if (unreachable.length) {
            await PushSubscriber.updateMany({ user: { $in: unreachable } }, { subscribed: false }).catch(() => null);
        }

        const status = onesignalId ? "sent" : "skipped";
        await PushLog.updateOne(
            { _id: log._id },
            {
                status,
                onesignalId,
                unreachable: unreachable.length,
                ...(status === "skipped" ? { error: "No devices to deliver to", $unset: { dedupeKey: 1 } } : {}),
            }
        );

        return {
            status,
            reason: status === "skipped" ? "no devices to deliver to" : undefined,
            targeted: all ? null : ids.length,
            unreachable,
            logId: String(log._id),
        };
    } catch (error) {
        console.error(`[push] ${kind} failed:`, error?.message);
        // Free the dedupe key so the next run can try again
        await PushLog.updateOne(
            { _id: log._id },
            { status: "failed", error: String(error?.message || error).slice(0, 400), $unset: { dedupeKey: 1 } }
        ).catch(() => null);
        return { status: "failed", reason: error?.message, targeted: ids.length, unreachable: ids, logId: String(log._id) };
    }
}

/** Which of these users have notifications turned on? */
async function subscribedUserIds(userIds) {
    const ids = (userIds || []).filter(Boolean).map(String);
    if (!ids.length) return [];
    const rows = await PushSubscriber.find({ user: { $in: ids }, subscribed: true }).select("user").lean();
    return rows.map((r) => String(r.user));
}

/**
 * Push to everyone who can get it, email the rest.
 *
 * recipients: [{ userId, email, name }]   (same shape queueBulk takes)
 * push:  { title, message, url, kind, dedupeKey, audience }
 * email: queueBulk options ({ template, data, category, dedupePrefix }) - or null for push only
 */
async function pushFirst(recipients, { push, email }) {
    const list = recipients || [];
    const pushed = new Set();

    if (push && isPushConfigured()) {
        const subs = await subscribedUserIds(list.map((r) => r.userId));
        if (subs.length) {
            const result = await sendPush({ ...push, userIds: subs });
            if (result.status === "sent" || result.reason === "already sent") {
                const missed = new Set(result.unreachable || []);
                subs.forEach((id) => {
                    if (!missed.has(id)) pushed.add(id);
                });
            }
        }
    }

    const rest = list.filter((r) => !pushed.has(String(r.userId)));
    if (rest.length && email) {
        // required lazily: services/email requires this file too
        require("../email").queueBulk(rest, email);
    }

    if (pushed.size) console.log(`[push] ${push?.kind || "push"}: ${pushed.size} by push, ${rest.length} by email`);
    return { pushed: pushed.size, emailed: email ? rest.length : 0 };
}

module.exports = {
    getPushConfig,
    isPushConfigured,
    sendPush,
    pushFirst,
    subscribedUserIds,
};
