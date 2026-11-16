const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Admin = require("../models/admin");

/*
 * Old admin / project screens send their login token in different places
 * (request body, Authorization header, or the `token` cookie). These helpers
 * read it from any of them and actually check who the token belongs to.
 *
 * Before this, many of those routes only checked that *some* token was sent
 * (or nothing at all), so any logged-in user - or anyone - could call them.
 */
function readToken(req) {
    const header = req.headers?.authorization || "";
    if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
    return (
        req.body?.token ||
        req.headers?.["x-auth-token"] ||
        req.query?.token ||
        req.cookies?.token ||
        null
    );
}

function decode(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// Admin from the old admin login (admins collection) OR a user with admin: true
const requireStaff = async (req, res, next) => {
    try {
        const tokens = [readToken(req), req.cookies?.token].filter(Boolean);
        for (const t of tokens) {
            const decoded = decode(t);
            if (!decoded?.id || decoded.role === "project") continue;
            const admin = await Admin.findById(decoded.id).select("_id email").lean().catch(() => null);
            if (admin) {
                req.staff = { kind: "admin", id: String(admin._id) };
                return next();
            }
            const u = await User.findById(decoded.id).select("_id admin").lean().catch(() => null);
            if (u?.admin) {
                req.staff = { kind: "user_admin", id: String(u._id) };
                return next();
            }
        }
        return res.status(403).json({ message: "Admin access required." });
    } catch (err) {
        console.error("staffAuth error:", err);
        return res.status(500).json({ message: "Failed to verify admin access." });
    }
};

// Only check write requests; leave plain GET reads as they were.
const requireStaffForWrites = (req, res, next) =>
    req.method === "GET" ? next() : requireStaff(req, res, next);

// Project dashboard login token -> req.projectId
const requireProject = (req, res, next) => {
    const decoded = decode(readToken(req));
    const projectId = decoded?.role === "project" ? decoded.id : decoded?.projectId;
    if (!projectId) {
        return res.status(401).json({ message: "Please log in to your project dashboard again." });
    }
    req.projectId = String(projectId);
    next();
};

module.exports = { requireStaff, requireStaffForWrites, requireProject, readToken };
