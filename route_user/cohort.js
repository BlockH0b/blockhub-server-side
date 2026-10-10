const express = require("express");
const router = express.Router();

const User = require("../models/user");

// Change this to wherever your auth middleware lives
const CohortRegistration = require("../models/Cohort");
const Referral = require("../models/Referral");
const createCohortToken = require("../utils/cohortToken");
const { COHORT_COOKIE_NAME, cohortAuth } = require("../middlewave/cohortAuth");
const requireAdmin = require("../middlewave/adminAuth");
const { isAdminRequest } = require("../middlewave/adminAuth");
const CohortTutor = require("../models/CohortTutor");
const CohortClass = require("../models/CohortClass");
const { sendCohortWelcomeEmail } = require("../utils/nodemailer");
const { COHORT_TRACKS, normalizeTrack } = require("../config/cohortTracks");
const notify = require("../services/email/notify");
const sendCohortLoginLink = require("../utils/cohortLoginLink");


// =====================================================
// GET COHORT STATISTICS
// GET /user_cohort/stats





// Supported query params:
// ?page=1
// ?limit=10
// ?search=john
// ?track=Backend Development
// =====================================================

router.get("/stats", async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search = "",
            track = "",
        } = req.query;

        page = Math.max(parseInt(page) || 1, 1);
        limit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

        const skip = (page - 1) * limit;

        // -------------------------------------------------
        // Base filter
        // -------------------------------------------------

        const filter = {};

        // -------------------------------------------------
        // Search
        // Searches:
        // - Full name
        // - Email
        // - Telegram username
        // - Country
        // - Track
        // -------------------------------------------------

        if (search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");

            filter.$or = [
                { fullName: searchRegex },
                { email: searchRegex },
                { telegramUsername: searchRegex },
                { country: searchRegex },
                { track: searchRegex },
            ];
        }

        // -------------------------------------------------
        // Track filter
        // -------------------------------------------------

        if (track.trim()) {
            filter.track = track.trim();
        }

        // -------------------------------------------------
        // Total registrations
        // -------------------------------------------------

        const total = await CohortRegistration.countDocuments({});

        // -------------------------------------------------
        // Today's registrations
        // -------------------------------------------------

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const today = await CohortRegistration.countDocuments({
            createdAt: {
                $gte: startOfToday,
                $lte: endOfToday,
            },
        });

        // -------------------------------------------------
        // Track/course statistics
        // -------------------------------------------------

        const trackStats = await CohortRegistration.aggregate([
            {
                $match: {
                    track: {
                        $exists: true,
                        $nin: ["", null],
                    },
                },
            },
            {
                $group: {
                    _id: "$track",
                    count: {
                        $sum: 1,
                    },
                },
            },
            {
                $sort: {
                    count: -1,
                },
            },
        ]);

        const tracks = trackStats.map((item) => ({
            name: item._id,
            count: item.count,
            percentage:
                total > 0
                    ? Number(((item.count / total) * 100).toFixed(1))
                    : 0,
        }));

        // -------------------------------------------------
        // Registered users
        // -------------------------------------------------

        // Personal details (names, emails, telegram) are only
        // returned to signed-in admins. Everyone else sees totals.
        const canSeePeople = await isAdminRequest(req);

        const registrations = canSeePeople
            ? await CohortRegistration.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
            : [];

        // -------------------------------------------------
        // Total search results
        // -------------------------------------------------

        const filteredTotal =
            await CohortRegistration.countDocuments(filter);

        const totalPages = Math.ceil(filteredTotal / limit);

        // -------------------------------------------------
        // Most popular course
        // -------------------------------------------------

        const mostPopularTrack =
            tracks.length > 0
                ? tracks[0]
                : null;

        // -------------------------------------------------
        // Response
        // -------------------------------------------------

        return res.status(200).json({
            success: true,

            data: {
                overview: {
                    total,
                    today,
                    totalTracks: tracks.length,
                    mostPopularTrack,
                },

                tracks,

                registrations,

                canSeeRegistrations: canSeePeople,

                pagination: {
                    page,
                    limit,
                    total: filteredTotal,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                },
            },
        });
    } catch (error) {
        console.error("❌ Cohort stats error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cohort statistics",
            error: error.message,
        });
    }
});

// =====================================================
// SWITCH TRACK
// PATCH /user_cohort/switch-track
//
// Lets an authenticated student change their track for
// their current cohort registration.
// =====================================================
router.patch("/switch-track", cohortAuth, async (req, res) => {
    try {
        const { userId, cohort } = req.cohortUser;

        const { track } = req.body;

        if (!track) {
            return res.status(400).json({
                success: false,
                message: "Please select a track.",
            });
        }

        // req.cohortUser.registration (from the middleware) is a
        // .lean() object — can't call .save() on it. Fetch the real
        // document here instead.
        const registration = await CohortRegistration.findOne({
            user: userId,
            cohort,
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Cohort registration not found.",
            });
        }

        if (registration.status === "completed") {
            return res.status(403).json({
                success: false,
                message: "You can't switch tracks after completing the cohort.",
            });
        }

        const officialTrack = normalizeTrack(track);

        if (!officialTrack) {
            return res.status(400).json({
                success: false,
                message: "That track isn't available.",
            });
        }

        if (officialTrack === registration.track) {
            return res.status(200).json({
                success: true,
                message: "You're already in this track.",
                registration,
            });
        }

        registration.track = officialTrack;
        await registration.save();

        notify.trackSwitched(registration);

        return res.status(200).json({
            success: true,
            message: "Track updated successfully.",
            registration,
        });
    } catch (error) {
        console.error("❌ Switch track error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to switch track.",
        });
    }
});

router.post("/admin/fix-3d-track", requireAdmin, async (req, res) => {
    try {
        // Find all registrations whose track starts with "3D"
        const oldTracks = await CohortRegistration.find({
            track: {
                $regex: /^3D/i,
            },
        }).select("_id track");

        if (oldTracks.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No old 3D tracks found. Database is already clean.",
                matched: 0,
                modified: 0,
            });
        }


        // Update every matching registration
        const result = await CohortRegistration.updateMany(
            {
                track: {
                    $regex: /^3D/i,
                },
            },
            [
                {
                    $set: {
                        track: {
                            $replaceOne: {
                                input: "$track",
                                find: "3D",
                                replacement: "2D",
                            },
                        },
                        updatedAt: new Date(),
                    },
                },
            ]
        );

        return res.status(200).json({
            success: true,
            message: "All old 3D tracks have been changed to 2D.",
            matched: result.matchedCount,
            modified: result.modifiedCount,
            oldTracks,
        });

    } catch (error) {
        console.error("❌ Track migration error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to migrate old 3D tracks",
            error: error.message,
        });
    }
});


router.post("/login", async (req, res) => {
    try {
        // The "password" here is just the first 7 letters of the email,
        // so anyone who knows a student's email can log in as them.
        // Set COHORT_PASSWORD_LOGIN=false once students use the email link.
        if (process.env.COHORT_PASSWORD_LOGIN === "false") {
            return res.status(410).json({
                success: false,
                code: "USE_EMAIL_LINK",
                message: "Password login is turned off. Enter your email and we'll send you a login link.",
            });
        }

        const { email, password } = req.body;

        // ---------------------------------------------
        // Validate input
        // ---------------------------------------------
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email and password.",
            });
        }

        // ---------------------------------------------
        // Normalize email
        // ---------------------------------------------
        const normalizedEmail = email.trim().toLowerCase();

        const cleanPassword = password.trim().toUpperCase();

        // ---------------------------------------------
        // Find BlockHub user
        // ---------------------------------------------
        const user = await User.findOne({
            email: normalizedEmail,
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "No BlockHub account was found with this email.",
            });
        }

        // ---------------------------------------------
        // Find Cohort 1.0 registration
        // ---------------------------------------------
        const registration =
            await CohortRegistration.findOne({
                user: user._id,
                cohort: "cohort-1.0",
            });

        if (!registration) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not registered for BlockHub Cohort 1.0.",
            });
        }

        // ---------------------------------------------
        // Check registration status
        // ---------------------------------------------
        if (
            registration.status === "rejected"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Your Cohort 1.0 registration has been rejected.",
            });
        }

        // ---------------------------------------------
        // Generate expected temporary password
        //
        // Take the part before @
        //
        // daniel.success@gmail.com
        //       ↓
        // daniel.success
        //       ↓
        // DANIELS
        // ---------------------------------------------
        const emailUsername =
            normalizedEmail.split("@")[0];

        const expectedPassword = emailUsername
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 7)
            .toUpperCase();

        // ---------------------------------------------
        // Validate password
        // ---------------------------------------------
        if (cleanPassword !== expectedPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
        }

        // ---------------------------------------------
        // Create Cohort Dashboard Token
        // ---------------------------------------------
        const cohortToken = createCohortToken({
            userId: user._id,
            registrationId: registration._id,
            cohort: "cohort-1.0",
        });

        // ---------------------------------------------
        // Store dashboard token in HttpOnly cookie
        // ---------------------------------------------
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

        // ---------------------------------------------
        // Login successful
        // ---------------------------------------------
        return res.status(200).json({
            success: true,
            message:
                "Login successful. Redirecting to your Cohort dashboard.",

            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
            },

            registration: {
                id: registration._id,
                cohort: registration.cohort,
                track: registration.track,
                status: registration.status,
            },
        });
    } catch (error) {
        console.error(
            "❌ Cohort login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Something went wrong during login.",
        });
    }
});


// =====================================================
// GET ALL COHORT TRACKS
// GET /user_cohort/tracks
//
// Useful for the frontend filter dropdown.
// =====================================================
router.get("/tracks", async (req, res) => {
    try {
        // Official tracks first, plus any old names still in the DB
        // (so the stats filter can find them until fixTrackNames.js runs)
        const dbTracks = (await CohortRegistration.distinct("track"))
            .filter(Boolean)
            .filter((track) => track.trim() !== "");

        const cleanTracks = [
            ...COHORT_TRACKS,
            ...dbTracks.filter((track) => !COHORT_TRACKS.includes(track)).sort(),
        ];

        return res.status(200).json({
            success: true,
            data: cleanTracks,
        });
    } catch (error) {
        console.error("❌ Cohort tracks error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cohort tracks",
            error: error.message,
        });
    }
});


router.post("/register", async (req, res) => {
    try {
        const {
            fullName,
            email,
            telegramUsername,
            country,
            track,
            about,
            source,
            referralCode,
            group,
        } = req.body;

        // --------------------------------
        // Validate required fields
        // --------------------------------

        if (
            !fullName ||
            !email ||
            !country ||
            !track ||
            !about ||
            !source
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const officialTrack = normalizeTrack(track);

        if (!officialTrack) {
            return res.status(400).json({
                success: false,
                message: "Please choose one of the available tracks.",
            });
        }

        // --------------------------------
        // Find existing BlockHub user
        // --------------------------------

        let user = await User.findOne({
            email: normalizedEmail,
        });

        // --------------------------------
        // Create user if they don't exist
        // --------------------------------

        if (!user) {
            user = await User.create({
                fullName: fullName.trim(),
                email: normalizedEmail,
                source: "cohort",
            });
        }

        // --------------------------------
        // Check if already registered
        // --------------------------------

        const existingRegistration =
            await CohortRegistration.findOne({
                user: user._id,
                cohort: "cohort-1.0",
            });

        if (existingRegistration) {
            // ==========================================
            // Already registered.
            //
            // SECURITY: we used to log the person straight in here,
            // which meant anyone who typed someone else's email got
            // into their dashboard. Now we email the owner a login link.
            // ==========================================

            let emailed = false;
            if (existingRegistration.status !== "rejected") {
                const result = await sendCohortLoginLink(user, existingRegistration).catch(() => null);
                emailed = result?.status === "sent";
            }

            return res.status(200).json({
                success: true,
                alreadyRegistered: true,
                emailed,
                message:
                    "You're already registered for Cohort 1.0. We've emailed you a link to open your dashboard.",
            });
        }

        // --------------------------------
        // Create cohort registration
        // --------------------------------

        const registration =
            await CohortRegistration.create({
                user: user._id,

                cohort: "cohort-1.0",

                fullName: user.fullName,

                email: user.email,

                telegramUsername:
                    telegramUsername?.trim() || null,

                country: country.trim(),

                track: officialTrack,

                about,

                source,
            });

        // =====================================================
        // REFERRAL SYSTEM
        // =====================================================


        // Don't make the student wait for the email
        sendCohortWelcomeEmail(
            user.email,
            user.fullName,
            officialTrack
        ).catch((error) => console.error("Cohort welcome email:", error?.message));


        if (referralCode) {
            try {
                // --------------------------------
                // Normalize referral code
                // --------------------------------

                const normalizedReferralCode =
                    referralCode.trim().toUpperCase();

                // --------------------------------
                // Find the person who owns the code
                // --------------------------------

                const referrer = await User.findOne({
                    referralCode: normalizedReferralCode,
                });

                // --------------------------------
                // Only continue if referral code is valid
                // --------------------------------

                if (referrer) {
                    // --------------------------------
                    // Prevent self-referral
                    // --------------------------------

                    if (
                        referrer._id.toString() !==
                        user._id.toString()
                    ) {
                        // --------------------------------
                        // Check if this user already has
                        // a referral
                        // --------------------------------

                        const existingReferral =
                            await Referral.findOne({
                                referredUser: user._id,
                            });

                        // --------------------------------
                        // Create referral if one doesn't exist
                        // --------------------------------

                        if (!existingReferral) {
                            await Referral.create({
                                referrer: referrer._id,

                                referredUser: user._id,

                                referralCode:
                                    normalizedReferralCode,

                                cohortRegistration:
                                    registration._id,

                                cohort: "cohort-1.0",

                                status: "registered",

                                paymentReference: null,

                                paymentAmount: 0,

                                paidAt: null,

                                rewardAmount: 0,

                                rewardStatus: "pending",

                                rewardPaidAt: null,
                            });

                            notify.referralUsed(referrer._id, user);
                        } else {
                            console.log(
                                "ℹ️ User already has a referral."
                            );
                        }
                    } else {
                        console.log(
                            "⚠️ Self-referral attempt blocked."
                        );
                    }
                } else {
                    console.log(
                        `⚠️ Invalid referral code: ${normalizedReferralCode}`
                    );
                }
            } catch (referralError) {
                // --------------------------------
                // Referral failure should NOT cancel
                // the user's cohort registration
                // --------------------------------

                console.error(
                    "❌ Referral creation error:",
                    referralError
                );
            }
        }

        // =====================================================
        // CREATE COHORT DASHBOARD TOKEN
        // =====================================================

        const cohortToken = createCohortToken({
            userId: user._id,
            registrationId: registration._id,
            cohort: "cohort-1.0",
        });

        // =====================================================
        // STORE TOKEN IN HTTPONLY COOKIE
        // =====================================================

        res.cookie(
            COHORT_COOKIE_NAME,
            cohortToken,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV === "production",

                sameSite:
                    process.env.NODE_ENV === "production"
                        ? "none"
                        : "lax",

                maxAge:
                    30 *
                    24 *
                    60 *
                    60 *
                    1000,

                path: "/",
            }
        );

        // --------------------------------
        // Registration successful
        // --------------------------------

        return res.status(201).json({
            success: true,

            message:
                "Successfully registered for Cohort 1.0.",

            user: {
                id: user._id,

                fullName: user.fullName,

                email: user.email,
            },

            registration,
        });

    } catch (error) {
        console.error(
            "Cohort registration error:",
            error
        );

        // --------------------------------
        // Handle duplicate registration
        // --------------------------------

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,

                message:
                    "This email is already registered for Cohort 1.0.",
            });
        }

        return res.status(500).json({
            success: false,

            message:
                "Something went wrong during registration.",
        });
    }
});

/**
//  * GET /cohort/registrations
//  *
//  * Get all Cohort 1.0 registrations
//  */
router.get("/registrations", requireAdmin, async (req, res) => {
    try {
        const registrations = await CohortRegistration.find({
            cohort: "cohort-1.0",
        })
            .populate(
                "user",
                "fullName email twitterHandle twitterId profileImage"
            )
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: registrations.length,
            registrations,
        });

    } catch (error) {
        console.error(
            "Get cohort registrations error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cohort registrations.",
        });
    }
});


// =====================================================
// MAKE USER A COHORT TUTOR
// =====================================================
router.post("/cohort-tutors", requireAdmin, async (req, res) => {
    try {
        const {
            email,
            userId,
            cohort = "cohort-1.0",
            track,
            bio = "",
            skills = [],
        } = req.body;

        // -------------------------------------------------
        // 1. Validate input
        // -------------------------------------------------

        if (!email && !userId) {
            return res.status(400).json({
                success: false,
                message: "Provide either userId or email.",
            });
        }

        const officialTrack = normalizeTrack(track);

        if (!officialTrack) {
            return res.status(400).json({
                success: false,
                message: "Please choose one of the official tracks.",
            });
        }

        // -------------------------------------------------
        // 2. Find existing user
        // -------------------------------------------------

        const user = userId
            ? await User.findById(userId)
            : await User.findOne({
                email: email.toLowerCase().trim(),
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        // -------------------------------------------------
        // 3. Check if already a cohort tutor
        // -------------------------------------------------

        const existingTutor = await CohortTutor.findOne({
            user: user._id,
            cohort,
        });

        if (existingTutor) {
            return res.status(409).json({
                success: false,
                message: "This user is already a cohort tutor for this cohort.",
                data: {
                    tutor: existingTutor,
                },
            });
        }

        // -------------------------------------------------
        // 4. Create tutor code
        // -------------------------------------------------

        const tutorCode = `BHT-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

        // -------------------------------------------------
        // 5. Create CohortTutor profile
        // -------------------------------------------------

        const cohortTutor = await CohortTutor.create({
            user: user._id,
            cohort,
            track: officialTrack,
            bio,
            skills: Array.isArray(skills) ? skills : [],
            tutorCode,
            status: "active",
            createdBy: req.adminUser._id,
        });

        // -------------------------------------------------
        // 6. Update User
        // -------------------------------------------------

        user.isCohortTutor = true;
        user.cohortTutorProfile = cohortTutor._id;

        await user.save();

        notify.tutorAssigned(user, cohortTutor);

        // -------------------------------------------------
        // 7. Return result
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            message: "User successfully made a cohort tutor.",
            data: {
                tutor: cohortTutor,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    isCohortTutor: user.isCohortTutor,
                    cohortTutorProfile: user.cohortTutorProfile,
                },
            },
        });
    } catch (error) {
        console.error("❌ Make cohort tutor error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to make user a cohort tutor.",
        });
    }
});


// ============================================================
// GET ALL COHORT TUTORS
// GET /admin/cohort-tutors
// ============================================================
router.get("/cohort-tutors", requireAdmin, async (req, res) => {
    try {
        const {
            cohort = "cohort-1.0",
            status = "",
            track = "",
            search = "",
        } = req.query;

        // --------------------------------------------------------
        // Build tutor query
        // --------------------------------------------------------
        const tutorQuery = {
            cohort: cohort.trim(),
        };

        if (status) {
            tutorQuery.status = status.trim();
        }

        if (track) {
            tutorQuery.track = track.trim();
        }

        // --------------------------------------------------------
        // Get tutors and populate their existing User account
        // --------------------------------------------------------
        let tutors = await CohortTutor.find(tutorQuery)
            .populate("user", "_id fullName email profileImage")
            .sort({ createdAt: -1 })
            .lean();

        // --------------------------------------------------------
        // Search
        // --------------------------------------------------------
        if (search && search.trim()) {
            const searchText = search.trim().toLowerCase();

            tutors = tutors.filter((tutor) => {
                const fullName = tutor.user?.fullName || "";
                const email = tutor.user?.email || "";
                const tutorCode = tutor.tutorCode || "";
                const tutorTrack = tutor.track || "";
                const tutorCohort = tutor.cohort || "";
                const tutorLevel = tutor.tutorLevel || "";

                const searchableText = `
          ${fullName}
          ${email}
          ${tutorCode}
          ${tutorTrack}
          ${tutorCohort}
          ${tutorLevel}
        `.toLowerCase();

                return searchableText.includes(searchText);
            });
        }

        // --------------------------------------------------------
        // Get ALL tutors for overall statistics
        // --------------------------------------------------------
        const allTutors = await CohortTutor.find({
            cohort: cohort.trim(),
        }).lean();

        const totalTutors = allTutors.length;

        const activeTutors = allTutors.filter(
            (tutor) => tutor.status === "active"
        ).length;

        const inactiveTutors = allTutors.filter(
            (tutor) => tutor.status === "inactive"
        ).length;

        const suspendedTutors = allTutors.filter(
            (tutor) => tutor.status === "suspended"
        ).length;

        // --------------------------------------------------------
        // Get total students in this cohort
        // --------------------------------------------------------
        const totalStudents = await CohortRegistration.countDocuments({
            cohort: cohort.trim(),
        });

        // --------------------------------------------------------
        // Get total classes in this cohort
        // --------------------------------------------------------
        const totalClasses = await CohortClass.countDocuments({
            cohort: cohort.trim(),
            status: { $ne: "cancelled" },
        });

        // --------------------------------------------------------
        // Get upcoming classes
        // --------------------------------------------------------
        const now = new Date();

        const upcomingClasses = await CohortClass.countDocuments({
            cohort: cohort.trim(),
            status: { $in: ["scheduled", "ongoing"] },
            startDate: { $gte: now },
        });

        // --------------------------------------------------------
        // Add statistics to each tutor
        // --------------------------------------------------------
        const tutorsWithStats = await Promise.all(
            tutors.map(async (tutor) => {
                const userId = tutor.user?._id || tutor.user;

                // No user attached
                if (!userId) {
                    return {
                        ...tutor,
                        stats: {
                            totalStudents: 0,
                            totalClasses: 0,
                            upcomingClasses: 0,
                            completedClasses: 0,
                        },
                    };
                }

                // ----------------------------------------------------
                // Students
                //
                // Students are currently linked to a track through
                // CohortRegistration, not directly to a tutor.
                // ----------------------------------------------------
                const tutorStudents = await CohortRegistration.countDocuments({
                    cohort: tutor.cohort,
                    track: tutor.track,
                });

                // ----------------------------------------------------
                // Total classes assigned to this tutor
                // ----------------------------------------------------
                const tutorTotalClasses = await CohortClass.countDocuments({
                    cohort: tutor.cohort,
                    tutor: userId,
                    status: { $ne: "cancelled" },
                });

                // ----------------------------------------------------
                // Upcoming classes assigned to this tutor
                // ----------------------------------------------------
                const tutorUpcomingClasses = await CohortClass.countDocuments({
                    cohort: tutor.cohort,
                    tutor: userId,
                    status: { $in: ["scheduled", "ongoing"] },
                    startDate: { $gte: now },
                });

                // ----------------------------------------------------
                // Completed classes
                // ----------------------------------------------------
                const tutorCompletedClasses = await CohortClass.countDocuments({
                    cohort: tutor.cohort,
                    tutor: userId,
                    status: "completed",
                });

                return {
                    ...tutor,

                    stats: {
                        totalStudents: tutorStudents,
                        totalClasses: tutorTotalClasses,
                        upcomingClasses: tutorUpcomingClasses,
                        completedClasses: tutorCompletedClasses,
                    },
                };
            })
        );

        // --------------------------------------------------------
        // Response
        // --------------------------------------------------------
        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalTutors,
                    activeTutors,
                    inactiveTutors,
                    suspendedTutors,
                    totalStudents,
                    totalClasses,
                    upcomingClasses,
                },

                tutors: tutorsWithStats,
            },
        });
    } catch (error) {
        console.error("❌ Get cohort tutors error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch cohort tutors.",
        });
    }
});


// =====================================================
// EMAIL ME A LOGIN LINK  (secure cohort login)
// POST /user_cohort/login-link   { email }
//
// Always answers the same way so nobody can use it to check
// who is registered.
// =====================================================
const loginLinkHits = new Map();

router.post("/login-link", async (req, res) => {
    const generic = {
        success: true,
        message: "If that email is registered for the cohort, a login link is on its way. Check your inbox (and spam).",
    };

    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
            return res.status(400).json({ success: false, message: "Please enter your email address." });
        }

        // max 5 links per email per hour
        const now = Date.now();
        const hit = loginLinkHits.get(email) || { count: 0, reset: now + 60 * 60 * 1000 };
        if (hit.reset < now) {
            hit.count = 0;
            hit.reset = now + 60 * 60 * 1000;
        }
        hit.count += 1;
        loginLinkHits.set(email, hit);
        if (hit.count > 5) return res.status(200).json(generic);

        const user = await User.findOne({ email });
        if (!user) return res.status(200).json(generic);

        const registration = await CohortRegistration.findOne({
            user: user._id,
            status: { $ne: "rejected" },
        }).sort({ createdAt: -1 });

        if (!registration) return res.status(200).json(generic);

        await sendCohortLoginLink(user, registration);
        return res.status(200).json(generic);
    } catch (error) {
        console.error("❌ Cohort login link error:", error);
        return res.status(200).json(generic);
    }
});


// =====================================================
// EDIT A COHORT TUTOR (admin)
// PATCH /user_cohort/cohort-tutors/:id
// body: { track?, bio?, skills?, tutorLevel?, status? }
// =====================================================
router.patch("/cohort-tutors/:id", requireAdmin, async (req, res) => {
    try {
        const tutor = await CohortTutor.findById(req.params.id);

        if (!tutor) {
            return res.status(404).json({ success: false, message: "Tutor not found." });
        }

        const { track, bio, skills, tutorLevel, status } = req.body || {};

        if (track !== undefined) {
            const officialTrack = normalizeTrack(track);
            if (!officialTrack) {
                return res.status(400).json({ success: false, message: "Please choose one of the official tracks." });
            }
            tutor.track = officialTrack;
        }

        if (typeof bio === "string") tutor.bio = bio.trim().slice(0, 2000);

        if (skills !== undefined) {
            const list = Array.isArray(skills) ? skills : String(skills).split(",");
            tutor.skills = list.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 30);
        }

        if (typeof tutorLevel === "string" && tutorLevel.trim()) tutor.tutorLevel = tutorLevel.trim();

        if (status !== undefined) {
            if (!["active", "inactive", "suspended"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status." });
            }
            tutor.status = status;
        }

        await tutor.save();

        const populated = await CohortTutor.findById(tutor._id)
            .populate("user", "_id fullName email profileImage")
            .lean();

        return res.status(200).json({
            success: true,
            message: "Tutor updated.",
            data: { tutor: populated },
        });
    } catch (error) {
        console.error("❌ Update cohort tutor error:", error);
        return res.status(500).json({ success: false, message: "Unable to update tutor." });
    }
});


// =====================================================
// REMOVE TUTOR ROLE (admin)
// DELETE /user_cohort/cohort-tutors/:id
// The user keeps their BlockHub account; their past classes stay.
// =====================================================
router.delete("/cohort-tutors/:id", requireAdmin, async (req, res) => {
    try {
        const tutor = await CohortTutor.findById(req.params.id);

        if (!tutor) {
            return res.status(404).json({ success: false, message: "Tutor not found." });
        }

        await User.updateOne(
            { _id: tutor.user },
            { $set: { isCohortTutor: false, cohortTutorProfile: null } }
        );

        await tutor.deleteOne();

        return res.status(200).json({ success: true, message: "Tutor role removed." });
    } catch (error) {
        console.error("❌ Remove cohort tutor error:", error);
        return res.status(500).json({ success: false, message: "Unable to remove tutor." });
    }
});


// =====================================================
// PUBLIC COHORT OVERVIEW  (for the /cohort hub page)
// GET /user_cohort/public/overview
// No personal data - names/photos/bios of tutors only.
// =====================================================
router.get("/public/overview", async (req, res) => {
    try {
        const cohort = "cohort-1.0";

        const [trackCounts, tutors, upcomingCount] = await Promise.all([
            CohortRegistration.aggregate([
                { $match: { cohort, status: { $ne: "rejected" } } },
                { $group: { _id: "$track", students: { $sum: 1 } } },
            ]),
            CohortTutor.find({ cohort, status: "active" })
                .populate("user", "fullName profileImage")
                .lean(),
            CohortClass.countDocuments({
                cohort,
                status: { $in: ["scheduled", "ongoing"] },
                startDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            }),
        ]);

        const studentsByTrack = {};
        for (const row of trackCounts) {
            const name = normalizeTrack(row._id) || row._id;
            studentsByTrack[name] = (studentsByTrack[name] || 0) + row.students;
        }

        const tutorCards = tutors.map((t) => ({
            id: String(t._id),
            name: t.user?.fullName || "BlockHub Tutor",
            avatar: t.user?.profileImage || null,
            track: normalizeTrack(t.track) || t.track,
            bio: t.bio || "",
            skills: (t.skills || []).slice(0, 6),
            level: t.tutorLevel || null,
        }));

        const tracks = COHORT_TRACKS.map((name) => ({
            name,
            students: studentsByTrack[name] || 0,
            tutors: tutorCards.filter((t) => t.track === name).length,
        }));

        return res.status(200).json({
            success: true,
            data: {
                cohort: {
                    id: cohort,
                    name: "BlockHub Cohort 1.0",
                    startDate: process.env.COHORT_1_START_DATE || "2026-10-27T18:00:00.000Z",
                    endDate: process.env.COHORT_1_END_DATE || "2026-12-18T18:00:00.000Z",
                },
                totals: {
                    students: Object.values(studentsByTrack).reduce((a, b) => a + b, 0),
                    tutors: tutorCards.length,
                    tracks: COHORT_TRACKS.length,
                    upcomingClasses: upcomingCount,
                },
                tracks,
                tutors: tutorCards,
                communityLink: process.env.COHORT_COMMUNITY_LINK || process.env.BLOCKHUB_COMMUNITY_LINK || null,
            },
        });
    } catch (error) {
        console.error("❌ Cohort overview error:", error);
        return res.status(500).json({ success: false, message: "Unable to load cohort overview." });
    }
});


module.exports = router;