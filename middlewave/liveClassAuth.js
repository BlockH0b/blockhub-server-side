const jwt = require("jsonwebtoken");
const User = require("../models/user");
const CohortTutor = require("../models/CohortTutor");
const CohortRegistration = require("../models/Cohort");
const { COHORT_COOKIE_NAME } = require("./cohortAuth");

/*
 * liveClassAuth
 * ------------------------------------------------------------
 * Works out WHO is calling a live-class endpoint and attaches:
 *
 *   req.viewer = {
 *     userId, name, avatar,
 *     role: "host" | "student",
 *     kind: "tutor" | "admin" | "student",
 *     cohort, track           // null for admins (they can join any class)
 *   }
 *
 * Accepted sessions (first match wins):
 *   1. Main BlockHub login ("token" cookie)
 *        - cohort tutor  -> host for their track
 *        - admin         -> host for any track
 *        - registered cohort student -> student
 *   2. Cohort dashboard cookie ("BHCtoken") -> student
 */

function safeVerify(token) {
    if (!token || typeof token !== "string") return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

function buildStudent(user, registration) {
    return {
        userId: String(user._id),
        name: user.fullName || registration.fullName || "Student",
        avatar: user.profileImage || null,
        role: "student",
        kind: "student",
        cohort: registration.cohort,
        track: registration.track,
    };
}

async function resolveViewer(req) {
    /* ---------- 1. Main login cookie ---------- */
    const mainDecoded = safeVerify(req.cookies?.token);
    const mainUserId = mainDecoded?.id || mainDecoded?.userId || mainDecoded?._id;

    if (mainUserId) {
        const user = await User.findById(mainUserId)
            .select("_id fullName profileImage admin isCohortTutor cohortTutorProfile")
            .lean();

        if (user) {
            if (user.isCohortTutor) {
                const tutor =
                    (user.cohortTutorProfile &&
                        (await CohortTutor.findById(user.cohortTutorProfile).lean())) ||
                    (await CohortTutor.findOne({ user: user._id }).lean());

                if (tutor && tutor.status === "active") {
                    return {
                        userId: String(user._id),
                        name: user.fullName || "Tutor",
                        avatar: user.profileImage || null,
                        role: "host",
                        kind: "tutor",
                        cohort: tutor.cohort,
                        track: tutor.track,
                    };
                }
            }

            if (user.admin) {
                return {
                    userId: String(user._id),
                    name: user.fullName || "BlockHub Admin",
                    avatar: user.profileImage || null,
                    role: "host",
                    kind: "admin",
                    cohort: null,
                    track: null,
                };
            }

            const registration = await CohortRegistration.findOne({
                user: user._id,
                status: { $ne: "rejected" },
            })
                .sort({ createdAt: -1 })
                .lean();

            if (registration) {
                return buildStudent(user, registration);
            }
        }
    }

    /* ---------- 2. Cohort dashboard cookie ---------- */
    const cohortDecoded = safeVerify(req.cookies?.[COHORT_COOKIE_NAME]);

    if (
        cohortDecoded?.purpose === "cohort_dashboard" &&
        cohortDecoded.userId &&
        cohortDecoded.registrationId
    ) {
        const registration = await CohortRegistration.findOne({
            _id: cohortDecoded.registrationId,
            user: cohortDecoded.userId,
        }).lean();

        if (registration && registration.status !== "rejected") {
            const user = await User.findById(cohortDecoded.userId)
                .select("_id fullName profileImage")
                .lean();

            if (user) return buildStudent(user, registration);
        }
    }

    return null;
}

const liveClassAuth = async (req, res, next) => {
    try {
        const viewer = await resolveViewer(req);

        if (!viewer) {
            return res.status(401).json({
                success: false,
                code: "AUTH_REQUIRED",
                message: "Please sign in to your BlockHub cohort account to join this class.",
            });
        }

        req.viewer = viewer;
        next();
    } catch (error) {
        console.error("liveClassAuth error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify your account right now.",
        });
    }
};

const requireHost = (req, res, next) => {
    if (req.viewer?.role !== "host") {
        return res.status(403).json({
            success: false,
            message: "Only the class tutor can do this.",
        });
    }
    next();
};

module.exports = { liveClassAuth, requireHost, resolveViewer };
