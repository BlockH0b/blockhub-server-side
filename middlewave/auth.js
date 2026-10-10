const jwt = require("jsonwebtoken");
const User = require("../models/user")

const auth = async (req, res, next) => {
    try {
        const token = req.cookies?.token; // ✅ COOKIE ONLY

        // console.log("COOKIE:", req.cookies);
        // console.log("TOKEN:", req.cookies?.token);
        // console.log(token)
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }


        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        // console.log("DECODED:", decoded);

        if (!user) {
            return res.status(401)
                .json({
                    success: false,
                    message: "User not found",
                });
        }
        req.user = user;
        next();

    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = auth;