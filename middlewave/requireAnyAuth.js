const jwt = require("jsonwebtoken");

/*
 * requireAnyAuth
 * ------------------------------------------------------------
 * Used for shared endpoints (file upload / delete) that are
 * called from several parts of the app: user dashboard, tutor
 * course builder, seller product builder and project campaigns.
 *
 * Accepts ANY valid BlockHub session:
 *   - "token" cookie        (main user / admin login)  -> JWT_SECRET
 *   - "tutorToken" cookie   (academy tutor login)      -> TUTOR_ACCESS_SECRET_KEY
 *   - Authorization: Bearer (project accounts)         -> JWT_SECRET
 *
 * It only proves the caller is signed in. It does not check roles.
 */

const TUTOR_ACCESS_SECRET =
    process.env.TUTOR_ACCESS_SECRET_KEY || "tutoraccesskey";

function tryVerify(token, secret) {
    if (!token || typeof token !== "string") return null;
    try {
        return jwt.verify(token, secret);
    } catch {
        return null;
    }
}

const requireAnyAuth = (req, res, next) => {
    const cookieToken = req.cookies?.token;
    const tutorToken = req.cookies?.tutorToken;

    const authHeader = req.headers?.authorization || "";
    const bearer = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    const decoded =
        tryVerify(cookieToken, process.env.JWT_SECRET) ||
        tryVerify(tutorToken, TUTOR_ACCESS_SECRET) ||
        tryVerify(bearer, process.env.JWT_SECRET);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: "Please sign in to continue.",
        });
    }

    req.authPayload = decoded;
    next();
};

module.exports = requireAnyAuth;
