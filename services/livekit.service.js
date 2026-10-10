/*
 * ============================================================
 * LiveKit service  (BlockHub Live)
 * ============================================================
 * Everything that talks to LiveKit lives here so the routes stay
 * readable and the API secret never leaves the server.
 *
 * Required env:
 *   LIVEKIT_URL=wss://your-project.livekit.cloud
 *   LIVEKIT_API_KEY=...
 *   LIVEKIT_API_SECRET=...
 *
 * Optional env:
 *   LIVE_CLASS_MAX_PARTICIPANTS=150
 *   LIVE_CLASS_TOKEN_TTL=3h
 * ============================================================
 */

const {
    AccessToken,
    RoomServiceClient,
    WebhookReceiver,
    TrackSource: SdkTrackSource,
} = require("livekit-server-sdk");

// Numeric values from LiveKit's protocol (used in API responses).
const TrackSource = SdkTrackSource || {
    UNKNOWN: 0,
    CAMERA: 1,
    MICROPHONE: 2,
    SCREEN_SHARE: 3,
    SCREEN_SHARE_AUDIO: 4,
};

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const API_KEY = process.env.LIVEKIT_API_KEY || "";
const API_SECRET = process.env.LIVEKIT_API_SECRET || "";

function isConfigured() {
    return Boolean(LIVEKIT_URL && API_KEY && API_SECRET);
}

/** RoomServiceClient needs the http(s) form of the URL. */
function httpUrl() {
    return LIVEKIT_URL.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

let roomService = null;
function getRoomService() {
    if (!isConfigured()) {
        throw new Error("LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.");
    }
    if (!roomService) {
        roomService = new RoomServiceClient(httpUrl(), API_KEY, API_SECRET);
    }
    return roomService;
}

let webhookReceiver = null;
function getWebhookReceiver() {
    if (!webhookReceiver) {
        webhookReceiver = new WebhookReceiver(API_KEY, API_SECRET);
    }
    return webhookReceiver;
}

/* ------------------------------------------------------------
   PUBLISH SOURCES
------------------------------------------------------------ */

// NOTE: livekit-server-sdk v2.19+ expects TrackSource enum values here
// (it converts them to "camera", "microphone"... inside the JWT).
function publishSources({ isHost, canShareScreen }) {
    const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    if (isHost || canShareScreen) {
        sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    }
    return sources;
}

/* ------------------------------------------------------------
   ACCESS TOKEN
------------------------------------------------------------ */

/**
 * Create a short-lived token that lets ONE person join ONE room.
 * Hosts (tutors/admins) get roomAdmin + screen share.
 */
async function createAccessToken({
    roomName,
    identity,
    name,
    avatar,
    role, // "host" | "student"
    canShareScreen = false,
}) {
    const isHost = role === "host";

    const token = new AccessToken(API_KEY, API_SECRET, {
        identity: String(identity),
        name: name || "Guest",
        ttl: process.env.LIVE_CLASS_TOKEN_TTL || "3h",
        metadata: JSON.stringify({
            role,
            avatar: avatar || null,
        }),
    });

    token.addGrant({
        room: roomName,
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: publishSources({ isHost, canShareScreen }),
        roomAdmin: isHost,
        // Students cannot rewrite their own metadata (role lives there).
        canUpdateOwnMetadata: false,
    });

    return token.toJwt();
}

/* ------------------------------------------------------------
   ROOMS
------------------------------------------------------------ */

async function ensureRoom(roomName) {
    try {
        await getRoomService().createRoom({
            name: roomName,
            // keep the room 10 min after the last person leaves
            emptyTimeout: 10 * 60,
            maxParticipants:
                Number(process.env.LIVE_CLASS_MAX_PARTICIPANTS) || 150,
        });
    } catch (error) {
        // Room may already exist - that's fine.
        if (process.env.NODE_ENV !== "production") {
            console.warn("[livekit] createRoom:", error?.message);
        }
    }
}

/** Disconnect everyone and close the room. */
async function closeRoom(roomName) {
    try {
        await getRoomService().deleteRoom(roomName);
    } catch (error) {
        // Room might already be gone
        console.warn("[livekit] deleteRoom:", error?.message);
    }
}

async function listParticipants(roomName) {
    try {
        return await getRoomService().listParticipants(roomName);
    } catch {
        return [];
    }
}

async function getParticipant(roomName, identity) {
    try {
        return await getRoomService().getParticipant(roomName, String(identity));
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------
   HOST ACTIONS
------------------------------------------------------------ */

function sourceNumber(source) {
    switch (source) {
        case "camera":
            return TrackSource.CAMERA;
        case "screen_share":
            return TrackSource.SCREEN_SHARE;
        case "microphone":
        default:
            return TrackSource.MICROPHONE;
    }
}

/** Mute one published track (mic / camera / screen) of a participant. */
async function muteParticipantSource(roomName, identity, source = "microphone") {
    const participant = await getParticipant(roomName, identity);
    if (!participant) return false;

    const wanted = sourceNumber(source);
    const tracks = (participant.tracks || []).filter(
        (track) => Number(track.source) === Number(wanted) && !track.muted
    );

    await Promise.all(
        tracks.map((track) =>
            getRoomService().mutePublishedTrack(roomName, String(identity), track.sid, true)
        )
    );

    return tracks.length > 0;
}

/** Mute every student's microphone (hosts are left alone). */
async function muteAllStudents(roomName) {
    const participants = await listParticipants(roomName);
    let muted = 0;

    for (const participant of participants) {
        let meta = {};
        try {
            meta = JSON.parse(participant.metadata || "{}");
        } catch {
            meta = {};
        }
        if (meta.role === "host") continue;

        const ok = await muteParticipantSource(roomName, participant.identity, "microphone").catch(() => false);
        if (ok) muted += 1;
    }

    return muted;
}

async function removeParticipant(roomName, identity) {
    try {
        await getRoomService().removeParticipant(roomName, String(identity));
        return true;
    } catch {
        return false;
    }
}

/**
 * Turn screen sharing on/off for a student who is already in the room.
 * If they are sharing and we turn it off, their share is muted too.
 */
async function setScreenSharePermission(roomName, identity, allowed) {
    const participant = await getParticipant(roomName, identity);
    if (!participant) return false;

    const sources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    if (allowed) {
        sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    }

    await getRoomService().updateParticipant(roomName, String(identity), {
        permission: {
            canSubscribe: true,
            canPublish: true,
            canPublishData: true,
            canPublishSources: sources,
        },
    });

    if (!allowed) {
        await muteParticipantSource(roomName, identity, "screen_share").catch(() => null);
    }

    return true;
}

module.exports = {
    LIVEKIT_URL,
    isConfigured,
    createAccessToken,
    ensureRoom,
    closeRoom,
    listParticipants,
    muteParticipantSource,
    muteAllStudents,
    removeParticipant,
    setScreenSharePermission,
    getWebhookReceiver,
};
