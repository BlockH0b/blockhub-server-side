const crypto = require("crypto");
const LiveSession = require("../models/LiveSession");
const LiveAttendance = require("../models/LiveAttendance");

/* ------------------------------------------------------------
   JOIN CODES  ->  "kqm-tzwa-pxd"
   Random letters only, no look-alikes (i, l, o) so codes are easy
   to read out loud or type from a phone.
------------------------------------------------------------ */

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz";

function randomLetters(length) {
    const bytes = crypto.randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    return out;
}

function generateCode() {
    return `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;
}

async function generateUniqueCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generateCode();
        // eslint-disable-next-line no-await-in-loop
        const exists = await LiveSession.exists({ code });
        if (!exists) return code;
    }
    throw new Error("Could not generate a unique class code");
}

/**
 * Accepts what people actually type: "KQM TZWA PXD", "kqmtzwapxd",
 * or a full link "https://.../class/kqm-tzwa-pxd".
 */
function normaliseCode(input) {
    if (!input || typeof input !== "string") return null;
    let value = input.trim().toLowerCase();

    const fromLink = value.match(/\/class\/([a-z-]+)/);
    if (fromLink) value = fromLink[1];

    const letters = value.replace(/[^a-z]/g, "");
    if (letters.length !== 10) return null;

    return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
}

function joinUrlFor(code) {
    const base = (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, "");
    return `${base}/class/${code}`;
}

/* ------------------------------------------------------------
   LIVE SESSION LOOKUP FOR CLASS LISTS
------------------------------------------------------------ */

/** Map of classId -> { code, status, joinUrl } for the most recent session of each class. */
async function getLiveSessionMap(classIds = []) {
    if (!classIds.length) return {};

    const sessions = await LiveSession.find({ cohortClass: { $in: classIds } })
        .select("code status cohortClass createdAt")
        .sort({ createdAt: -1 })
        .lean();

    const map = {};
    for (const session of sessions) {
        const key = String(session.cohortClass);
        if (map[key]) continue; // keep the newest only
        map[key] = {
            code: session.code,
            status: session.status,
            joinUrl: joinUrlFor(session.code),
        };
    }
    return map;
}

/* ------------------------------------------------------------
   ATTENDANCE
------------------------------------------------------------ */

async function markJoined({ sessionId, userId, role, name, at = new Date() }) {
    let row = await LiveAttendance.findOne({ session: sessionId, user: userId });

    if (!row) {
        row = new LiveAttendance({
            session: sessionId,
            user: userId,
            role,
            name,
        });
    }

    const last = row.visits[row.visits.length - 1];
    if (!last || last.leftAt) {
        row.visits.push({ joinedAt: at });
    }

    if (!row.firstJoinedAt) row.firstJoinedAt = at;
    if (name) row.name = name;
    if (role) row.role = role;

    try {
        await row.save();
    } catch (error) {
        // Two webhooks racing on the unique index - safe to ignore
        if (error?.code !== 11000) throw error;
    }
}

/** Fallback used when a join token is issued (works without webhooks). */
async function markTokenIssued({ sessionId, userId, role, name }) {
    await LiveAttendance.updateOne(
        { session: sessionId, user: userId },
        {
            $setOnInsert: {
                role,
                name,
                firstJoinedAt: new Date(),
            },
        },
        { upsert: true }
    ).catch((error) => {
        if (error?.code !== 11000) console.error("markTokenIssued:", error);
    });
}

function closeVisit(row, at) {
    const last = row.visits[row.visits.length - 1];
    if (last && !last.leftAt) {
        last.leftAt = at;
        const seconds = Math.max(0, Math.round((at - last.joinedAt) / 1000));
        row.totalSeconds = (row.totalSeconds || 0) + seconds;
        row.lastLeftAt = at;
        return true;
    }
    return false;
}

async function markLeft({ sessionId, userId, at = new Date() }) {
    const row = await LiveAttendance.findOne({ session: sessionId, user: userId });
    if (!row) return;
    if (closeVisit(row, at)) await row.save();
}

async function closeAllVisits(sessionId, at = new Date()) {
    const rows = await LiveAttendance.find({ session: sessionId, "visits.leftAt": null });
    await Promise.all(
        rows.map(async (row) => {
            if (closeVisit(row, at)) await row.save();
        })
    );
}

module.exports = {
    generateUniqueCode,
    normaliseCode,
    joinUrlFor,
    getLiveSessionMap,
    markJoined,
    markTokenIssued,
    markLeft,
    closeAllVisits,
};
