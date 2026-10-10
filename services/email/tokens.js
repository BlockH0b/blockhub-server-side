const jwt = require("jsonwebtoken");

/*
 * Signed links used in emails (no login needed to click them).
 */

const secret = () => process.env.JWT_SECRET;

// Unsubscribe / manage preferences (long lived - links in old emails keep working)
function preferencesToken(userId) {
    return jwt.sign({ purpose: "email_prefs", userId: String(userId) }, secret(), { expiresIn: "365d" });
}

function readPreferencesToken(token) {
    const decoded = jwt.verify(token, secret());
    if (decoded.purpose !== "email_prefs" || !decoded.userId) throw new Error("Invalid token");
    return decoded.userId;
}

// Verify a new email address (24h)
function verifyEmailToken(userId, email) {
    return jwt.sign(
        { purpose: "verify_email", userId: String(userId), email: String(email).toLowerCase() },
        secret(),
        { expiresIn: "24h" }
    );
}

function readVerifyEmailToken(token) {
    const decoded = jwt.verify(token, secret());
    if (decoded.purpose !== "verify_email" || !decoded.userId || !decoded.email) throw new Error("Invalid token");
    return { userId: decoded.userId, email: decoded.email };
}

module.exports = {
    preferencesToken,
    readPreferencesToken,
    verifyEmailToken,
    readVerifyEmailToken,
};
