
const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const User = require("../models/user");
const CohortClass = require("../models/CohortClass");
const CohortRegistration = require("../models/Cohort");
const CohortAccessToken = require("../models/CohortAccessToken");

const {
    cohortAuth,
    COHORT_COOKIE_NAME,
} = require("../middlewave/cohortAuth");

const createCohortToken = require("../utils/cohortToken");


// ==========================================
// Helpers
// ==========================================


const formatDuration = (minutes) => {
    if (!minutes) return null;

    if (minutes < 60) {
        return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? "s" : ""}`;
    }

    return `${hours}h ${remainingMinutes}m`;
};

const mapClassStatus = (status, startDate) => {
    if (status === "completed") {
        return "completed";
    }

    if (status === "cancelled") {
        return "cancelled";
    }

    if (status === "ongoing") {
        return "live";
    }

    if (status === "scheduled") {
        const now = new Date();

        if (new Date(startDate) > now) {
            return "upcoming";
        }

        return "upcoming";
    }

    return "upcoming";
};

const getCohortStatus = (startDate, endDate) => {
    const now = new Date();

    if (endDate && now > new Date(endDate)) {
        return "completed";
    }

    if (startDate && now >= new Date(startDate)) {
        return "active";
    }

    return "upcoming";
};

router.get("/check-auth", async (req, res) => {
    try {
        const token = req.cookies?.BHCtoken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // Optional but recommended:
        // Verify the token here
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);

        return res.status(200).json({
            success: true,
            message: "Authenticated",
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication",
        });
    }
});

// ==========================================
// GET USER COHORT DASHBOARD
// ==========================================
//
// GET /api/user_cohort/dashboard
//
// Authentication:
// HttpOnly cookie:
// blockhub_cohort_token
//
// ==========================================

router.get(
    "/dashboard",
    cohortAuth,
    async (req, res) => {
        try {
            // ==========================================
            // User information comes from verified cookie
            // ==========================================

            const {
                userId,
                registrationId,
                cohort,
                registration,
            } = req.cohortUser;

            // ==========================================
            // Find user
            // ==========================================

            const user = await User.findById(userId)
                .select("_id fullName email profileImage")
                .lean();

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User account not found.",
                });
            }

            // ==========================================
            // Get classes for user's track
            // ==========================================

            const classes = await CohortClass.find({
                cohort,
                track: registration.track,
            })
                .sort({
                    startDate: 1,
                })
                .lean();

            // ==========================================
            // Find next class
            // ==========================================

            const now = new Date();

            const upcomingClass =
                classes.find((classItem) => {
                    if (
                        classItem.status === "completed" ||
                        classItem.status === "cancelled"
                    ) {
                        return false;
                    }

                    return (
                        new Date(classItem.startDate) >= now ||
                        classItem.status === "ongoing"
                    );
                }) || null;

            // ==========================================
            // Format classes for frontend
            // ==========================================

            const formattedClasses = classes.map(
                (classItem) => ({
                    id: classItem._id.toString(),

                    title: classItem.title,

                    description:
                        classItem.description || null,

                    classNumber:
                        classItem.classNumber || 0,

                    date: classItem.startDate,

                    startTime:
                        classItem.startTime,

                    endTime:
                        classItem.endTime || null,

                    duration: formatDuration(
                        classItem.durationMinutes
                    ),

                    meetingLink:
                        classItem.meetingStatus ===
                            "available"
                            ? classItem.meetingLink
                            : null,

                    status: mapClassStatus(
                        classItem.status,
                        classItem.startDate
                    ),
                })
            );

            // ==========================================
            // Upcoming classes
            // ==========================================

            const upcomingClasses =
                formattedClasses
                    .filter(
                        (item) =>
                            item.status === "upcoming" ||
                            item.status === "live"
                    )
                    .slice(0, 5);

            // ==========================================
            // Next class
            // ==========================================

            const nextClass = upcomingClass
                ? {
                    id: upcomingClass._id.toString(),

                    title:
                        upcomingClass.title,

                    description:
                        upcomingClass.description ||
                        null,

                    classNumber:
                        upcomingClass.classNumber ||
                        0,

                    date:
                        upcomingClass.startDate,

                    startTime:
                        upcomingClass.startTime,

                    endTime:
                        upcomingClass.endTime ||
                        null,

                    duration:
                        formatDuration(
                            upcomingClass.durationMinutes
                        ),

                    meetingLink:
                        upcomingClass.meetingStatus ===
                            "available"
                            ? upcomingClass.meetingLink
                            : null,

                    status:
                        mapClassStatus(
                            upcomingClass.status,
                            upcomingClass.startDate
                        ),
                }
                : null;

            // ==========================================
            // Total classes
            // ==========================================

            const totalClasses =
                classes.filter(
                    (item) =>
                        item.status !== "cancelled"
                ).length;

            // ==========================================
            // Progress
            // ==========================================
            //
            // We currently don't have a per-user
            // class completion model.
            //
            // Progress starts at 0.
            //
            // Later we can connect this to:
            // CohortProgress / Attendance model.
            // ==========================================

            const completedClasses = 0;

            const progress =
                totalClasses > 0
                    ? Math.round(
                        (completedClasses /
                            totalClasses) *
                        100
                    )
                    : 0;

            // ==========================================
            // Cohort information
            // ==========================================
            //
            // Official Cohort 1.0 dates.
            //
            // These can later be moved entirely
            // into environment variables or a
            // dedicated Cohort model.
            // ==========================================

            const cohortStartDate =
                process.env.COHORT_1_START_DATE ||
                "2026-10-27T18:00:00.000Z";

            const cohortEndDate =
                process.env.COHORT_1_END_DATE ||
                "2026-12-18T18:00:00.000Z";

            const cohortStatus =
                getCohortStatus(
                    cohortStartDate,
                    cohortEndDate
                );

            // ==========================================
            // Journey
            // ==========================================
            //
            // Registration
            //      ↓
            // Acceptance
            //      ↓
            // Classes Begin
            //      ↓
            // Learning
            //      ↓
            // Completion
            //
            // IMPORTANT:
            // "Classes Begin" is NOT current simply
            // because the cohort is upcoming.
            //
            // If registration is still waiting for
            // acceptance:
            //
            // Registration = completed
            // Acceptance = current
            // Classes Begin = pending
            //
            // Once accepted:
            //
            // Registration = completed
            // Acceptance = completed
            // Classes Begin = current
            //
            // Once cohort starts:
            //
            // Registration = completed
            // Acceptance = completed
            // Classes Begin = completed
            // Learning = current
            // ==========================================

            const isAccepted =
                registration.status === "accepted" ||
                registration.status === "completed";

            const isRegistrationCompleted =
                registration.status === "completed";

            let journey;

            if (cohortStatus === "completed") {
                journey = [
                    {
                        label: "Registration",
                        status: "completed",
                    },

                    {
                        label: "Acceptance",
                        status: isAccepted
                            ? "completed"
                            : "current",
                    },

                    {
                        label: "Classes Begin",
                        status: isAccepted
                            ? "completed"
                            : "pending",
                    },

                    {
                        label: "Learning",
                        status: isAccepted
                            ? "completed"
                            : "pending",
                    },

                    {
                        label: "Completion",
                        status: isRegistrationCompleted
                            ? "completed"
                            : "current",
                    },
                ];
            } else if (cohortStatus === "active") {
                journey = [
                    {
                        label: "Registration",
                        status: "completed",
                    },

                    {
                        label: "Acceptance",
                        status: isAccepted
                            ? "completed"
                            : "current",
                    },

                    {
                        label: "Classes Begin",
                        status: isAccepted
                            ? "completed"
                            : "pending",
                    },

                    {
                        label: "Learning",
                        status: isAccepted
                            ? "current"
                            : "pending",
                    },

                    {
                        label: "Completion",
                        status: "pending",
                    },
                ];
            } else {
                // ======================================
                // COHORT UPCOMING
                // ======================================

                journey = [
                    {
                        label: "Registration",
                        status: "completed",
                    },

                    {
                        label: "Acceptance",
                        status: isAccepted
                            ? "completed"
                            : "current",
                    },

                    {
                        label: "Classes Begin",
                        status: isAccepted
                            ? "current"
                            : "pending",
                    },

                    {
                        label: "Learning",
                        status: "pending",
                    },

                    {
                        label: "Completion",
                        status: "pending",
                    },
                ];
            }

            // ==========================================
            // User name
            // ==========================================

            const nameParts =
                user.fullName?.trim().split(" ") || [];

            const firstName =
                nameParts[0] || "";

            const lastName =
                nameParts
                    .slice(1)
                    .join(" ") || "";

            // ==========================================
            // FINAL DASHBOARD RESPONSE
            // ==========================================

            return res.status(200).json({
                success: true,

                data: {
                    user: {
                        id: user._id.toString(),

                        firstName,

                        lastName,

                        name: user.fullName,

                        email: user.email,

                        profileImage:
                            user.profileImage || null,
                    },

                    cohort: {
                        id: cohort,

                        name:
                            "BlockHub Cohort 1.0",

                        status:
                            cohortStatus,

                        startDate:
                            cohortStartDate,

                        endDate:
                            cohortEndDate,
                    },

                    track: {
                        name:
                            registration.track,

                        description:
                            `Your ${registration.track} learning track.`,

                        progress,

                        completedClasses,

                        totalClasses,
                    },

                    nextClass,

                    upcomingClasses,

                    announcements: [],

                    journey,

                    communityLink:
                        process.env.COHORT_COMMUNITY_LINK ||
                        null,

                    curriculumLink:
                        process.env.COHORT_CURRICULUM_LINK ||
                        null,

                    scheduleLink:
                        process.env.COHORT_SCHEDULE_LINK ||
                        null,

                    registrationDate:
                        registration.registeredAt ||
                        registration.createdAt ||
                        null,
                },
            });
        } catch (error) {
            console.error(
                "Cohort dashboard error:",
                error
            );

            return res.status(500).json({
                success: false,

                message:
                    "Unable to load your cohort dashboard.",
            });
        }
    }
);

router.get("/access/:token", async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).send(
                "Invalid cohort access link."
            );
        }

        // 1. Verify the temporary email token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // 2. Make sure this token is specifically for
        //    cohort email dashboard access
        if (
            decoded.purpose !==
            "cohort_email_access"
        ) {
            return res.status(401).send(
                "Invalid cohort access link."
            );
        }

        if (
            !decoded.userId ||
            !decoded.registrationId ||
            !decoded.cohort ||
            !decoded.jti
        ) {
            return res.status(401).send(
                "Invalid cohort access link."
            );
        }

        // 3. Find the temporary access-token record
        const accessRecord =
            await CohortAccessToken.findOne({
                tokenId: decoded.jti,
                user: decoded.userId,
                registration: decoded.registrationId,
                cohort: decoded.cohort,
            });

        if (!accessRecord) {
            return res.status(401).send(
                "This cohort access link is invalid or no longer available."
            );
        }

        // 4. Prevent reuse
        if (accessRecord.used) {
            return res.status(401).send(
                "This cohort access link has already been used. Please request a new one."
            );
        }

        // 5. Check expiration
        if (
            accessRecord.expiresAt.getTime() <
            Date.now()
        ) {
            return res.status(401).send(
                "This cohort access link has expired. Please request a new one."
            );
        }

        // 6. Confirm user still exists
        const user = await User.findById(
            decoded.userId
        );

        if (!user) {
            return res.status(404).send(
                "User account not found."
            );
        }

        // 7. Confirm registration still exists
        const registration =
            await CohortRegistration.findOne({
                _id: decoded.registrationId,
                user: decoded.userId,
                cohort: decoded.cohort,
            });

        if (!registration) {
            return res.status(404).send(
                "Cohort registration not found."
            );
        }

        // 8. Block rejected users
        if (registration.status === "rejected") {
            return res.status(403).send(
                "Your cohort registration has been rejected."
            );
        }

        // 9. Mark temporary access token as used
        accessRecord.used = true;
        await accessRecord.save();

        // 10. Create the REAL 1-year dashboard token
        const cohortToken = createCohortToken({
            userId: user._id,
            registrationId: registration._id,
            cohort: decoded.cohort,
        });

        // 11. Save the 1-year token in HttpOnly cookie
        res.cookie(
            COHORT_COOKIE_NAME,
            cohortToken,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV ===
                    "production",

                sameSite:
                    process.env.NODE_ENV ===
                        "production"
                        ? "none"
                        : "lax",

                maxAge:
                    365 *
                    24 *
                    60 *
                    60 *
                    1000,

                path: "/",
            }
        );

        // 12. Send user to dashboard
        return res.redirect(
            `${process.env.FRONTEND_URL}/cohort/my-dashboard`
        );
    } catch (error) {
        console.error(
            "Cohort email access error:",
            error
        );

        if (
            error.name ===
            "TokenExpiredError"
        ) {
            return res.status(401).send(
                "This cohort access link has expired. Please request a new one."
            );
        }

        if (
            error.name ===
            "JsonWebTokenError"
        ) {
            return res.status(401).send(
                "Invalid cohort access link."
            );
        }

        return res.status(500).send(
            "Something went wrong while accessing your cohort dashboard."
        );
    }
});


module.exports = router;
