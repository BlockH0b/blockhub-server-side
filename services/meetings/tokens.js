const jwt = require("jsonwebtoken");

/*
 * Signed tokens for BlockHub Meetings (no login needed).
 *
 *   access token  - "this person RSVP'd to this meeting".
 *                   Stored in a cookie (bhm_<code>) and put in the
 *                   personal "Join" link in emails, so it also works
 *                   on another device.
 *   invite token  - in the "You're invited" email; pre-fills and
 *                   trusts the invited email on the RSVP form.
 */

const secret = () => process.env.JWT_SECRET;

function meetingAccessToken(meeting, rsvpId) {
    return jwt.sign(
        { purpose: "meeting_rsvp", meetingId: String(meeting._id), code: meeting.code, rsvpId: String(rsvpId) },
        secret(),
        { expiresIn: "120d" }
    );
}

function readMeetingAccessToken(token) {
    if (!token || typeof token !== "string") return null;
    try {
        const decoded = jwt.verify(token, secret());
        if (decoded.purpose !== "meeting_rsvp" || !decoded.meetingId || !decoded.rsvpId) return null;
        return decoded;
    } catch {
        return null;
    }
}

function meetingInviteToken(meeting, email, name = "") {
    return jwt.sign(
        { purpose: "meeting_invite", meetingId: String(meeting._id), email: String(email).toLowerCase(), name },
        secret(),
        { expiresIn: "90d" }
    );
}

function readMeetingInviteToken(token) {
    if (!token || typeof token !== "string") return null;
    try {
        const decoded = jwt.verify(token, secret());
        if (decoded.purpose !== "meeting_invite" || !decoded.meetingId || !decoded.email) return null;
        return decoded;
    } catch {
        return null;
    }
}

/** One cookie per meeting: bhm_kqmtzwapxd */
function meetingCookieName(code) {
    return `bhm_${String(code || "").replace(/[^a-z]/g, "")}`;
}

function meetingCookieOptions() {
    const production = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: production,
        sameSite: production ? "none" : "lax",
        maxAge: 120 * 24 * 60 * 60 * 1000,
    };
}

module.exports = {
    meetingAccessToken,
    readMeetingAccessToken,
    meetingInviteToken,
    readMeetingInviteToken,
    meetingCookieName,
    meetingCookieOptions,
};
