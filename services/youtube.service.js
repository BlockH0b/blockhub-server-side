/*
 * ==================================================================
 * YouTube service for BlockHub Live
 * ==================================================================
 * Talks to the YouTube Data API with plain HTTPS (axios) - no extra
 * packages needed.
 *
 *  - connect the BlockHub channel once (OAuth, refresh token saved)
 *  - create a live event + stream key for a class
 *  - end the broadcast when the class ends
 *
 * Env vars (Render):
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REDIRECT_URI   e.g. https://api2.blockhubglobal.xyz/live_class/youtube/callback
 *   YOUTUBE_LATENCY        optional: normal | low | ultraLow   (default low)
 * ==================================================================
 */

const axios = require("axios");
const jwt = require("jsonwebtoken");
const LiveSetting = require("../models/LiveSetting");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/youtube/v3";
const SCOPE = "https://www.googleapis.com/auth/youtube";

const SETTING_KEY = "youtube";

/* ------------------------------------------------------------
   Config
------------------------------------------------------------ */

function isConfigured() {
    return Boolean(
        process.env.YOUTUBE_CLIENT_ID &&
        process.env.YOUTUBE_CLIENT_SECRET &&
        process.env.YOUTUBE_REDIRECT_URI
    );
}

function friendlyError(error, fallback = "YouTube request failed.") {
    const data = error?.response?.data;
    const reason = data?.error?.errors?.[0]?.reason || data?.error;
    const message = data?.error?.message || data?.error_description;

    if (reason === "liveStreamingNotEnabled") {
        return "Live streaming isn't enabled on the BlockHub YouTube channel yet. Enable it in YouTube Studio (can take up to 24 hours).";
    }
    if (reason === "invalid_grant") {
        return "The YouTube connection expired. An admin needs to reconnect YouTube.";
    }
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        return "YouTube's daily limit was reached. Try again tomorrow, or paste a YouTube link manually.";
    }
    return message ? `YouTube: ${message}` : error?.message || fallback;
}

/* ------------------------------------------------------------
   Connect flow
------------------------------------------------------------ */

function buildAuthUrl(adminId) {
    const state = jwt.sign({ purpose: "yt-connect", uid: String(adminId) }, process.env.JWT_SECRET, {
        expiresIn: "15m",
    });

    const params = new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID,
        redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline", // gives us a refresh token
        prompt: "consent", // forces Google to send the refresh token again
        include_granted_scopes: "true",
        state,
    });

    return `${AUTH_URL}?${params.toString()}`;
}

async function handleCallback(code, state) {
    if (!code) throw new Error("Google did not send a code.");

    let decoded;
    try {
        decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch {
        throw new Error("This connect link expired. Start again from the admin page.");
    }
    if (decoded?.purpose !== "yt-connect") throw new Error("Invalid connect request.");

    let tokens;
    try {
        const { data } = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                code,
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
                redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
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
            "Google didn't give a permanent connection. Remove BlockHub Live at myaccount.google.com/permissions, then connect again."
        );
    }

    // Which channel did the admin pick?
    let channelId = null;
    let channelTitle = null;
    try {
        const { data } = await axios.get(`${API}/channels`, {
            params: { part: "snippet", mine: true },
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        channelId = data?.items?.[0]?.id || null;
        channelTitle = data?.items?.[0]?.snippet?.title || null;
    } catch {
        /* not fatal */
    }

    await LiveSetting.findOneAndUpdate(
        { key: SETTING_KEY },
        {
            value: {
                refreshToken: tokens.refresh_token,
                channelId,
                channelTitle,
                connectedAt: new Date(),
                connectedBy: decoded.uid,
            },
        },
        { upsert: true, new: true }
    );

    cached = { token: null, expiresAt: 0 };
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
        channelTitle: stored?.channelTitle || null,
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
    if (!stored) throw new Error("YouTube isn't connected yet. An admin needs to connect it.");

    try {
        const { data } = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
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
        throw new Error(friendlyError(error, "Could not refresh the YouTube connection."));
    }
}

async function yt(method, path, { params, data } = {}) {
    const token = await getAccessToken();
    try {
        const response = await axios({
            method,
            url: `${API}${path}`,
            params,
            data,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 20000,
        });
        return response.data;
    } catch (error) {
        throw new Error(friendlyError(error));
    }
}

/* ------------------------------------------------------------
   Live events
------------------------------------------------------------ */

/**
 * Creates a live broadcast + stream on the BlockHub channel and links them.
 * Returns { videoId, broadcastId, streamId, ingestUrl, streamKey }.
 */
async function createLiveEvent({ title, startsAt }) {
    const latency = ["normal", "low", "ultraLow"].includes(process.env.YOUTUBE_LATENCY)
        ? process.env.YOUTUBE_LATENCY
        : "low";

    // YouTube wants a start time that is not in the past
    const minStart = Date.now() + 2 * 60 * 1000;
    const start = new Date(Math.max(minStart, startsAt ? new Date(startsAt).getTime() : 0));

    const cleanTitle = String(title || "BlockHub live class").slice(0, 100);

    // 1. the broadcast - the event students watch
    const broadcast = await yt("post", "/liveBroadcasts", {
        params: { part: "snippet,status,contentDetails" },
        data: {
            snippet: {
                title: cleanTitle,
                description: "BlockHub Cohort live class.",
                scheduledStartTime: start.toISOString(),
            },
            status: {
                privacyStatus: "unlisted",
                selfDeclaredMadeForKids: false,
            },
            contentDetails: {
                enableAutoStart: true, // goes live when video starts arriving
                enableAutoStop: true, // ends when the tutor stops streaming
                enableEmbed: true,
                recordFromStart: true,
                enableDvr: latency !== "ultraLow",
                latencyPreference: latency,
            },
        },
    });

    // 2. the stream - where the tutor sends video
    const stream = await yt("post", "/liveStreams", {
        params: { part: "snippet,cdn,contentDetails" },
        data: {
            snippet: { title: cleanTitle },
            cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
            contentDetails: { isReusable: false },
        },
    });

    // 3. connect them
    await yt("post", "/liveBroadcasts/bind", {
        params: { id: broadcast.id, part: "id,contentDetails", streamId: stream.id },
    });

    return {
        videoId: broadcast.id, // a broadcast ID is also its video ID
        broadcastId: broadcast.id,
        streamId: stream.id,
        ingestUrl: stream.cdn?.ingestionInfo?.ingestionAddress || "rtmp://a.rtmp.youtube.com/live2",
        streamKey: stream.cdn?.ingestionInfo?.streamName || null,
    };
}

/** Best-effort: ends the broadcast so it stops showing as live. */
async function completeBroadcast(broadcastId) {
    if (!broadcastId || !(await isConnected())) return;
    try {
        await yt("post", "/liveBroadcasts/transition", {
            params: { broadcastStatus: "complete", id: broadcastId, part: "status" },
        });
    } catch (error) {
        // Already complete / never went live - nothing to do
        console.warn("[youtube] complete broadcast:", error.message);
    }
}

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

/** Accepts a YouTube link or a bare 11-character ID. */
function parseVideoId(input) {
    const text = String(input || "").trim();
    if (!text) return null;
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;

    try {
        const url = new URL(text.startsWith("http") ? text : `https://${text}`);
        const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0];
            return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
        }

        if (host.endsWith("youtube.com")) {
            const v = url.searchParams.get("v");
            if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

            const parts = url.pathname.split("/").filter(Boolean);
            if (["live", "embed", "shorts", "v"].includes(parts[0]) && /^[A-Za-z0-9_-]{11}$/.test(parts[1] || "")) {
                return parts[1];
            }
        }
    } catch {
        return null;
    }
    return null;
}

/* Short-lived ticket so a socket can prove it may join a class room */
function signTicket({ code, userId }) {
    return jwt.sign({ purpose: "yt-room", code, uid: String(userId) }, process.env.JWT_SECRET, {
        expiresIn: "8h",
    });
}

function verifyTicket(ticket) {
    try {
        const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
        return decoded?.purpose === "yt-room" ? decoded : null;
    } catch {
        return null;
    }
}

module.exports = {
    isConfigured,
    isConnected,
    getStatus,
    buildAuthUrl,
    handleCallback,
    disconnect,
    createLiveEvent,
    completeBroadcast,
    parseVideoId,
    signTicket,
    verifyTicket,
};
