
const jwt = require("jsonwebtoken");
const User = require("../models/user");

// =====================================================
// REQUIRE ADMIN
// =====================================================

const requireAdmin = async (req, res, next) => {
    try {
        // -------------------------------------------------
        // 1. Get token from cookies
        // -------------------------------------------------

        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        // -------------------------------------------------
        // 2. Verify token
        // -------------------------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // -------------------------------------------------
        // 3. Get user ID from token
        //
        // Assuming your JWT was created like:
        //
        // jwt.sign(
        //     { id: user._id },
        //     process.env.JWT_SECRET
        // )
        // -------------------------------------------------

        const userId = decoded.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        // -------------------------------------------------
        // 4. Find user
        // -------------------------------------------------

        const user = await User.findById(userId)
            .select("admin");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found.",
            });
        }

        // -------------------------------------------------
        // 5. Check admin
        // -------------------------------------------------

        if (!user.admin) {
            return res.status(403).json({
                success: false,
                message: "Admin access required.",
            });
        }

        // -------------------------------------------------
        // 6. User is authenticated + admin
        // -------------------------------------------------

        req.adminUser = user;

        next();

    } catch (error) {
        console.error(
            "❌ Admin authentication error:",
            error
        );

        // Invalid / expired JWT
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired authentication token.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to verify admin access.",
        });
    }
};

/*
 * isAdminRequest(req) -> Promise<boolean>
 * Soft check (never sends a response). Used by endpoints that are
 * public but should only reveal personal data to admins.
 */
const isAdminRequest = async (req) => {
    try {
        const token = req.cookies?.token;
        if (!token) return false;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.id) return false;
        const user = await User.findById(decoded.id).select("admin").lean();
        return Boolean(user?.admin);
    } catch {
        return false;
    }
};

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.isAdminRequest = isAdminRequest;
