/*
 * ==================================================================
 * Google Meet service for BlockHub cohort classes
 * ==================================================================
 * One BlockHub Google account (e.g. classes@blockhubglobal.xyz) is
 * the HOST of every class. An admin connects it once from /admin.
 *
 * When a tutor creates a class, BlockHub creates a Google Calendar
 * event on that account with a Google Meet link, and invites the
 * tutor's email so they can get straight in.
 *
 * Plain HTTPS (axios) - no extra packages.
 *
 * Env vars (Render) - re-uses the YouTube Google keys if these are
 * not set, so nothing new is needed:
 *   GOOGLE_CLIENT_ID       (falls back to YOUTUBE_CLIENT_ID)
 *   GOOGLE_CLIENT_SECRET   (falls back to YOUTUBE_CLIENT_SECRET)
 *   GOOGLE_REDIRECT_URI    (falls back to YOUTUBE_REDIRECT_URI,
 *                           .../live_class/youtube/callback)
 *   COHORT_TIMEZONE        optional, default Africa/Lagos
 *
 * Google Cloud: turn on "Google Calendar API" for the project.
 * ==================================================================
 */

const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const LiveSetting = require("../models/LiveSetting");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

const SETTING_KEY = "google_meet";
const STATE_PURPOSE = "meet-connect";

const clientId = () => process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || process.env.YOUTUBE_REDIRECT_URI;
const timeZone = () => process.env.COHORT_TIMEZONE || "Africa/Lagos";

/* ------------------------------------------------------------
   Config + errors
------------------------------------------------------------ */

function isConfigured() {
    return Boolean(clientId() && clientSecret() && redirectUri());
}

function friendlyError(error, fallback = "Google request failed.") {
    const data = error?.response?.data;
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || data?.error;
    const message = data?.error?.message || data?.error_description;

    if (reason === "invalid_grant") {
        return "The Google Meet connection expired. An admin needs to reconnect Google Meet.";
    }
    if (reason === "accessNotConfigured" || /has not been used|is disabled/i.test(String(message))) {
        return "Google Calendar API is turned off. Turn it on in Google Cloud (APIs & Services → Library → Google Calendar API).";
    }
    if (reason === "insufficientPermissions" || reason === "PERMISSION_DENIED") {
        return "BlockHub doesn't have calendar permission. An admin needs to reconnect Google Meet and tick every box.";
    }
    if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason === "quotaExceeded") {
        return "Google is busy (rate limit). Try again in a minute.";
    }
    return message ? `Google: ${message}` : error?.message || fallback;
}

/* ------------------------------------------------------------
   Connect flow (admin, once)
------------------------------------------------------------ */

function buildAuthUrl(adminId) {
    const state = jwt.sign({ purpose: STATE_PURPOSE, uid: String(adminId) }, process.env.JWT_SECRET, {
        expiresIn: "15m",
    });

    const params = new URLSearchParams({
        client_id: clientId(),
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline", // refresh token
        prompt: "consent select_account", // let the admin pick the classes account
        state,
    });

    return `${AUTH_URL}?${params.toString()}`;
}

/** Is this OAuth "state" from a Google Meet connect? (used by the shared callback) */
function isMeetState(state) {
    try {
        return jwt.decode(String(state || ""))?.purpose === STATE_PURPOSE;
    } catch {
        return false;
    }
}

async function handleCallback(code, state) {
    if (!code) throw new Error("Google did not send a code.");

    let decoded;
    try {
        decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
        throw new Error("This connect link expired. Start again from the admin page.");
    }
    if (decoded?.purpose !== STATE_PURPOSE) throw new Error("Invalid connect request.");

    let tokens;
    try {
        const { data } = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                code,
                client_id: clientId(),
                client_secret: clientSecret(),
                redirect_uri: redirectUri(),
                grant_type: "authorization_code",
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        tokens = data;
    } catch (error) {
        throw new Error(friendlyError(error, "Could not finish connecting to Google."));
    }

    if (!tokens.refresh_token) {
        throw new Error(
            "Google didn't give a permanent connection. Remove BlockHub at myaccount.google.com/permissions, then connect again."
        );
    }

    const granted = String(tokens.scope || "");
    if (!granted.includes("calendar.events")) {
        throw new Error("Calendar permission wasn't given. Connect again and tick the calendar box.");
    }

    let email = null;
    try {
        const { data } = await axios.get(USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        email = data?.email || null;
    } catch {
        /* not fatal */
    }

    await LiveSetting.findOneAndUpdate(
        { key: SETTING_KEY },
        {
            value: {
                refreshToken: tokens.refresh_token,
                email,
                connectedAt: new Date(),
                connectedBy: decoded.uid,
            },
        },
        { upsert: true, new: true }
    );

    cached = { token: null, expiresAt: 0 };
    return { email };
}

async function getStored() {
    const row = await LiveSetting.findOne({ key: SETTING_KEY }).lean();
    return row?.value?.refreshToken ? row.value : null;
}

async function getStatus() {
    const stored = await getStored();
    return {
        configured: isConfigured(),
        connected: Boolean(stored),
        email: stored?.email || null,
        connectedAt: stored?.connectedAt || null,
    };
}

async function isConnected() {
    return isConfigured() && Boolean(await getStored());
}

async function disconnect() {
    const stored = await getStored();
    if (stored?.refreshToken) {
        await axios
            .post(REVOKE_URL, new URLSearchParams({ token: stored.refreshToken }).toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            })
            .catch(() => { });
    }
    await LiveSetting.deleteOne({ key: SETTING_KEY });
    cached = { token: null, expiresAt: 0 };
}

/* ------------------------------------------------------------
   Access token (refreshed automatically, cached in memory)
------------------------------------------------------------ */

let cached = { token: null, expiresAt: 0 };

async function getAccessToken() {
    if (cached.token && cached.expiresAt > Date.now() + 60 * 1000) return cached.token;

    const stored = await getStored();
    if (!stored) throw new Error("Google Meet isn't connected yet. An admin needs to connect it.");

    try {
        const { data } = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                client_id: clientId(),
                client_secret: clientSecret(),
                refresh_token: stored.refreshToken,
                grant_type: "refresh_token",
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        cached = {
            token: data.access_token,
            expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
        };
        return cached.token;
    } catch (error) {
        cached = { token: null, expiresAt: 0 };
        throw new Error(friendlyError(error, "Could not refresh the Google Meet connection."));
    }
}

async function calendar(method, path, { params, data } = {}) {
    const token = await getAccessToken();
    try {
        const res = await axios({
            method,
            url: `${CALENDAR}${path}`,
            params,
            data,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 20000,
        });
        return res.data;
    } catch (error) {
        const wrapped = new Error(friendlyError(error));
        wrapped.status = error?.response?.status || null;
        throw wrapped;
    }
}

/* ------------------------------------------------------------
   Meetings
------------------------------------------------------------ */

function meetLinkOf(event) {
    if (event?.hangoutLink) return event.hangoutLink;
    const entry = (event?.conferenceData?.entryPoints || []).find((e) => e.entryPointType === "video");
    return entry?.uri || null;
}

function eventBody({ title, description, startsAt, endsAt, tutorEmail, track }) {
    const lines = [
        description || null,
        track ? `Track: ${track}` : null,
        "BlockHub Cohort class. Join from your BlockHub dashboard.",
    ].filter(Boolean);

    return {
        summary: String(title || "BlockHub class").slice(0, 200),
        description: lines.join("\n\n"),
        start: { dateTime: new Date(startsAt).toISOString(), timeZone: timeZone() },
        end: { dateTime: new Date(endsAt).toISOString(), timeZone: timeZone() },
        attendees: tutorEmail ? [{ email: tutorEmail }] : [],
        guestsCanSeeOtherGuests: false,
        guestsCanInviteOthers: false,
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
    };
}

/**
 * Create the class meeting.
 * Returns { eventId, meetLink, htmlLink }
 */
async function createMeeting({ title, description, startsAt, endsAt, tutorEmail, track }) {
    if (!startsAt || !endsAt) throw new Error("The class needs a start and end time.");

    const body = {
        ...eventBody({ title, description, startsAt, endsAt, tutorEmail, track }),
        conferenceData: {
            createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
            },
        },
    };

    let event = await calendar("post", "", {
        params: { conferenceDataVersion: 1, sendUpdates: tutorEmail ? "all" : "none" },
        data: body,
    });

    // Google sometimes finishes making the Meet room a moment later.
    for (let i = 0; i < 3 && !meetLinkOf(event); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        event = await calendar("get", `/${encodeURIComponent(event.id)}`, {
            params: { conferenceDataVersion: 1 },
        });
    }

    const meetLink = meetLinkOf(event);
    if (!meetLink) {
        // don't leave an event without a link lying around
        await calendar("delete", `/${encodeURIComponent(event.id)}`, { params: { sendUpdates: "none" } }).catch(
            () => { }
        );
        throw new Error(
            "Google created the event but no Meet link. Check that Google Meet is turned on for this Google account."
        );
    }

    return { eventId: event.id, meetLink, htmlLink: event.htmlLink || null };
}

/** Change the title / time of an existing class meeting (same link). */
async function updateMeeting(eventId, { title, description, startsAt, endsAt, tutorEmail, track }) {
    if (!eventId) return null;
    const body = eventBody({ title, description, startsAt, endsAt, tutorEmail, track });
    const event = await calendar("patch", `/${encodeURIComponent(eventId)}`, {
        params: { conferenceDataVersion: 1, sendUpdates: tutorEmail ? "all" : "none" },
        data: body,
    });
    return { eventId: event.id, meetLink: meetLinkOf(event) };
}

/** Cancel a class meeting (the Meet link stops being on the calendar). */
async function cancelMeeting(eventId) {
    if (!eventId) return;
    try {
        await calendar("delete", `/${encodeURIComponent(eventId)}`, { params: { sendUpdates: "all" } });
    } catch (error) {
        // already gone is fine
        if (error.status === 404 || error.status === 410) return;
        throw error;
    }
}

module.exports = {
    isConfigured,
    buildAuthUrl,
    isMeetState,
    handleCallback,
    getStatus,
    isConnected,
    disconnect,
    createMeeting,
    updateMeeting,
    cancelMeeting,
};
