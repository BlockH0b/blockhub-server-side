
const crypto = require("crypto");
const express = require("express");

const router = express.Router();

const User = require("../models/user");
const Referral = require("../models/Referral");
const notify = require("../services/email/notify");
const CohortRegistration = require("../models/Cohort");
const  requireAdmin = require("../middlewave/adminAuth");


// ============================================================
// REFERRAL CONFIG
// ============================================================

// Change this when you decide on the actual referral reward.
const REFERRAL_REWARD_AMOUNT = 5000;

const DEFAULT_COHORT = "cohort-1.0";


// ============================================================
// Generate a unique referral code
// ============================================================

const generateReferralCode = async () => {
    let code;
    let exists = true;

    while (exists) {
        const random = crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();

        code = `BH-${random}`;

        exists = await User.exists({
            referralCode: code,
        });
    }

    return code;
};


// ============================================================
// Get or create user's referral code
// ============================================================

const getOrCreateReferralCode = async (user) => {
    if (user.referralCode) {
        return user.referralCode;
    }

    user.referralCode = await generateReferralCode();

    await user.save();

    return user.referralCode;
};


// ============================================================
// GET MY REFERRAL CODE
//
// GET /referrals/my-code
//
// Requires logged-in user
// ============================================================

router.get("/my-code", async (req, res) => {
    try {
        if (!req.user?._id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const referralCode = await getOrCreateReferralCode(user);

        const referralLink =
            `${process.env.FRONTEND_URL}/cohort/registration?referral=${referralCode}`;

        return res.status(200).json({
            success: true,
            data: {
                referralCode,
                referralLink,
            },
        });

    } catch (error) {
        console.error("Get referral code error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get referral code",
        });
    }
});


// ============================================================
// VALIDATE REFERRAL CODE
//
// GET /referrals/validate/:code
//
// PUBLIC
//
// Used when someone visits:
//
// /cohort/registration?referral=BH-XXXXXX
// ============================================================

router.get("/validate/:code", async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Referral code is required",
            });
        }

        const normalizedCode = code.trim().toUpperCase();

        const user = await User.findOne({
            referralCode: normalizedCode,
        }).select(
            "_id fullName referralCode profileImage"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Invalid referral code",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                valid: true,
                referralCode: user.referralCode,

                referrer: {
                    id: user._id,
                    fullName: user.fullName,
                    profileImage: user.profileImage,
                },
            },
        });

    } catch (error) {
        console.error(
            "Validate referral code error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to validate referral code",
        });
    }
});


// ============================================================
// CREATE REFERRAL
//
// POST /referrals/create
//
// This will normally be called internally from the
// cohort registration flow.
//
// Body:
//
// {
//     "referralCode": "BH-ABC12345",
//     "referredUserId": "...",
//     "cohortRegistrationId": "...",
//     "cohort": "cohort-1.0"
// }
//
// IMPORTANT:
// The frontend should NOT be allowed to freely create
// referrals. Ideally this endpoint should eventually be
// internal-only and called from the registration controller.
//
// We are keeping it here for now so we can test the flow.
// ============================================================

router.post("/create", async (req, res) => {
    try {
        const {
            referralCode,
            referredUserId,
            cohortRegistrationId,
            cohort = DEFAULT_COHORT,
        } = req.body;


        // --------------------------------------------------------
        // Validate input
        // --------------------------------------------------------

        if (!referralCode) {
            return res.status(400).json({
                success: false,
                message: "Referral code is required",
            });
        }

        if (!referredUserId) {
            return res.status(400).json({
                success: false,
                message: "Referred user is required",
            });
        }


        // --------------------------------------------------------
        // Find referred user
        // --------------------------------------------------------

        const referredUser = await User.findById(
            referredUserId
        );

        if (!referredUser) {
            return res.status(404).json({
                success: false,
                message: "Referred user not found",
            });
        }


        // --------------------------------------------------------
        // Find referrer
        // --------------------------------------------------------

        const normalizedCode =
            referralCode.trim().toUpperCase();

        const referrer = await User.findOne({
            referralCode: normalizedCode,
        });

        if (!referrer) {
            return res.status(404).json({
                success: false,
                message: "Invalid referral code",
            });
        }


        // --------------------------------------------------------
        // Prevent self-referral
        // --------------------------------------------------------

        if (
            referrer._id.toString() ===
            referredUser._id.toString()
        ) {
            return res.status(400).json({
                success: false,
                message: "You cannot refer yourself",
            });
        }


        // --------------------------------------------------------
        // Prevent duplicate referral
        // --------------------------------------------------------

        const existingReferral =
            await Referral.findOne({
                referredUser: referredUser._id,
            });

        if (existingReferral) {
            return res.status(409).json({
                success: false,
                message:
                    "This user has already been referred",
                data: {
                    referralId: existingReferral._id,
                },
            });
        }


        // --------------------------------------------------------
        // Verify cohort registration if provided
        // --------------------------------------------------------

        let cohortRegistration = null;

        if (cohortRegistrationId) {
            cohortRegistration =
                await CohortRegistration.findById(
                    cohortRegistrationId
                );

            if (!cohortRegistration) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Cohort registration not found",
                });
            }


            // Make sure the registration belongs to
            // the referred user.
            if (
                cohortRegistration.user.toString() !==
                referredUser._id.toString()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Cohort registration does not belong to this user",
                });
            }
        }


        // --------------------------------------------------------
        // Create referral
        // --------------------------------------------------------

        const referral = await Referral.create({
            referrer: referrer._id,

            referredUser: referredUser._id,

            referralCode: normalizedCode,

            cohortRegistration:
                cohortRegistration?._id || null,

            cohort:
                cohortRegistration?.cohort ||
                cohort,

            status: "registered",

            paymentReference: null,

            paymentAmount: 0,

            paidAt: null,

            rewardAmount: 0,

            rewardStatus: "pending",

            rewardPaidAt: null,
        });

        notify.referralUsed(referrer._id, referredUser);

        return res.status(201).json({
            success: true,
            message: "Referral created successfully",

            data: {
                referralId: referral._id,
                status: referral.status,
            },
        });

    } catch (error) {
        console.error(
            "Create referral error:",
            error
        );


        // Mongo duplicate key protection
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    "This referral already exists",
            });
        }


        return res.status(500).json({
            success: false,
            message: "Failed to create referral",
        });
    }
});


// ============================================================
// GET REFERRAL DASHBOARD
//
// GET /referrals/dashboard
//
// Requires logged-in user
//
// Query:
//
// ?page=1&limit=10
// ============================================================

router.get("/dashboard", async (req, res) => {
    try {
        if (!req.user?._id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }


        const userId = req.user._id;


        // --------------------------------------------------------
        // Pagination
        // --------------------------------------------------------

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit) || 10,
                1
            ),
            100
        );

        const skip = (page - 1) * limit;


        // --------------------------------------------------------
        // User
        // --------------------------------------------------------

        const user = await User.findById(userId)
            .select(
                "fullName referralCode profileImage"
            );


        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }


        // --------------------------------------------------------
        // Ensure referral code exists
        // --------------------------------------------------------

        const referralCode =
            await getOrCreateReferralCode(user);


        // --------------------------------------------------------
        // Get ALL referrals for statistics
        // --------------------------------------------------------

        const allReferrals = await Referral.find({
            referrer: userId,
        }).select(
            "status rewardAmount rewardStatus"
        );


        // --------------------------------------------------------
        // Statistics
        // --------------------------------------------------------

        const totalReferrals =
            allReferrals.length;


        const registeredReferrals =
            allReferrals.filter(
                (referral) =>
                    [
                        "registered",
                        "paid",
                        "rewarded",
                    ].includes(referral.status)
            ).length;


        const paidReferrals =
            allReferrals.filter(
                (referral) =>
                    [
                        "paid",
                        "rewarded",
                    ].includes(referral.status)
            ).length;


        const rewardsEarned =
            allReferrals.reduce(
                (total, referral) =>
                    total +
                    (referral.rewardAmount || 0),
                0
            );


        const rewardsPaid =
            allReferrals
                .filter(
                    (referral) =>
                        referral.rewardStatus ===
                        "paid"
                )
                .reduce(
                    (total, referral) =>
                        total +
                        (referral.rewardAmount || 0),
                    0
                );


        const rewardsPending =
            allReferrals
                .filter(
                    (referral) =>
                        [
                            "pending",
                            "approved",
                        ].includes(
                            referral.rewardStatus
                        )
                )
                .reduce(
                    (total, referral) =>
                        total +
                        (referral.rewardAmount || 0),
                    0
                );


        // --------------------------------------------------------
        // Paginated referrals
        // --------------------------------------------------------

        const referrals =
            await Referral.find({
                referrer: userId,
            })
                .populate(
                    "referredUser",
                    "fullName email profileImage"
                )
                .populate(
                    "cohortRegistration",
                    "track status registeredAt"
                )
                .sort({
                    createdAt: -1,
                })
                .skip(skip)
                .limit(limit)
                .lean();


        const total =
            allReferrals.length;


        const totalPages =
            Math.ceil(total / limit);


        return res.status(200).json({
            success: true,

            data: {
                referralCode,

                referralLink:
                    `${process.env.FRONTEND_URL}/cohort/registration?referral=${referralCode}`,

                stats: {
                    totalReferrals,
                    registeredReferrals,
                    paidReferrals,
                    rewardsEarned,
                    rewardsPaid,
                    rewardsPending,
                },

                referrals,

                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage:
                        page < totalPages,
                    hasPreviousPage:
                        page > 1,
                },
            },
        });

    } catch (error) {
        console.error(
            "Referral dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to load referral dashboard",
        });
    }
});


// ============================================================
// GET MY REFERRALS
//
// GET /referrals
//
// Optional pagination
//
// ?page=1&limit=10
// ============================================================

router.get("/", async (req, res) => {
    try {
        if (!req.user?._id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }


        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                parseInt(req.query.limit) || 10,
                1
            ),
            100
        );

        const skip = (page - 1) * limit;


        const filter = {
            referrer: req.user._id,
        };


        const [referrals, total] =
            await Promise.all([
                Referral.find(filter)
                    .populate(
                        "referredUser",
                        "fullName email profileImage"
                    )
                    .populate(
                        "cohortRegistration",
                        "track status registeredAt"
                    )
                    .sort({
                        createdAt: -1,
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                Referral.countDocuments(filter),
            ]);


        const totalPages =
            Math.ceil(total / limit);


        return res.status(200).json({
            success: true,

            data: {
                referrals,

                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage:
                        page < totalPages,
                    hasPreviousPage:
                        page > 1,
                },
            },
        });

    } catch (error) {
        console.error(
            "Get referrals error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to get referrals",
        });
    }
});


// =====================================================
// ADMIN REFERRAL OVERVIEW
//
// GET /user_cohort/admin/referrals
//
// Query:
// ?page=1
// ?limit=20
// ?search=daniel
// ?status=paid
// ?cohort=cohort-1.0
// =====================================================

router.get(
    "/admin/referrals",
    requireAdmin,
    async (req, res) => {
        try {
            let {
                page = 1,
                limit = 20,
                search = "",
                status = "",
                cohort = "cohort-1.0",
            } = req.query;

            page = Math.max(
                parseInt(page) || 1,
                1
            );

            limit = Math.min(
                Math.max(
                    parseInt(limit) || 20,
                    1
                ),
                100
            );

            const skip = (page - 1) * limit;

            // ---------------------------------------------
            // Base match
            // ---------------------------------------------

            const match = {
                cohort,
            };

            if (
                status &&
                [
                    "registered",
                    "paid",
                    "rewarded",
                    "cancelled",
                ].includes(status)
            ) {
                match.status = status;
            }

            // ---------------------------------------------
            // Build referrer search
            // ---------------------------------------------

            const searchRegex = search.trim()
                ? new RegExp(search.trim(), "i")
                : null;

            // ---------------------------------------------
            // Get grouped referrers
            // ---------------------------------------------

            const grouped = await Referral.aggregate([
                {
                    $match: match,
                },

                {
                    $group: {
                        _id: "$referrer",

                        referralCode: {
                            $first: "$referralCode",
                        },

                        totalReferrals: {
                            $sum: 1,
                        },

                        registeredReferrals: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            "$status",
                                            "registered",
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },

                        paidReferrals: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            "$status",
                                            [
                                                "paid",
                                                "rewarded",
                                            ],
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },

                        rewardedReferrals: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            "$status",
                                            "rewarded",
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },

                        cancelledReferrals: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            "$status",
                                            "cancelled",
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },

                        rewardsGenerated: {
                            $sum: {
                                $ifNull: [
                                    "$rewardAmount",
                                    0,
                                ],
                            },
                        },

                        rewardsPaid: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            "$rewardStatus",
                                            "paid",
                                        ],
                                    },
                                    {
                                        $ifNull: [
                                            "$rewardAmount",
                                            0,
                                        ],
                                    },
                                    0,
                                ],
                            },
                        },

                        lastReferralAt: {
                            $max: "$createdAt",
                        },
                    },
                },

                // -----------------------------------------
                // Join referrer
                // -----------------------------------------

                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "referrer",
                    },
                },

                {
                    $unwind: {
                        path: "$referrer",
                        preserveNullAndEmptyArrays: true,
                    },
                },

                // -----------------------------------------
                // Search referrer
                // -----------------------------------------

                ...(searchRegex
                    ? [
                          {
                              $match: {
                                  $or: [
                                      {
                                          "referrer.fullName":
                                              searchRegex,
                                      },
                                      {
                                          "referrer.email":
                                              searchRegex,
                                      },
                                      {
                                          referralCode:
                                              searchRegex,
                                      },
                                  ],
                              },
                          },
                      ]
                    : []),

                // -----------------------------------------
                // Sort by most referrals
                // -----------------------------------------

                {
                    $sort: {
                        totalReferrals: -1,
                        lastReferralAt: -1,
                    },
                },

                // -----------------------------------------
                // Pagination
                // -----------------------------------------

                {
                    $facet: {
                        metadata: [
                            {
                                $count: "total",
                            },
                        ],

                        data: [
                            {
                                $skip: skip,
                            },
                            {
                                $limit: limit,
                            },
                        ],
                    },
                },
            ]);

            const result = grouped[0] || {
                metadata: [],
                data: [],
            };

            const totalReferrers =
                result.metadata[0]?.total || 0;

            // ---------------------------------------------
            // Global statistics
            // ---------------------------------------------

            const globalStats =
                await Referral.aggregate([
                    {
                        $match: {
                            cohort,
                        },
                    },

                    {
                        $group: {
                            _id: null,

                            totalReferrals: {
                                $sum: 1,
                            },

                            registeredReferrals: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "registered",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            paidReferrals: {
                                $sum: {
                                    $cond: [
                                        {
                                            $in: [
                                                "$status",
                                                [
                                                    "paid",
                                                    "rewarded",
                                                ],
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            rewardedReferrals: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "rewarded",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            cancelledReferrals: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "cancelled",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            rewardsGenerated: {
                                $sum: {
                                    $ifNull: [
                                        "$rewardAmount",
                                        0,
                                    ],
                                },
                            },

                            rewardsPaid: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$rewardStatus",
                                                "paid",
                                            ],
                                        },
                                        {
                                            $ifNull: [
                                                "$rewardAmount",
                                                0,
                                            ],
                                        },
                                        0,
                                    ],
                                },
                            },

                            rewardsPending: {
                                $sum: {
                                    $cond: [
                                        {
                                            $in: [
                                                "$rewardStatus",
                                                [
                                                    "pending",
                                                    "approved",
                                                ],
                                            ],
                                        },
                                        {
                                            $ifNull: [
                                                "$rewardAmount",
                                                0,
                                            ],
                                        },
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ]);

            const stats =
                globalStats[0] || {
                    totalReferrals: 0,
                    registeredReferrals: 0,
                    paidReferrals: 0,
                    rewardedReferrals: 0,
                    cancelledReferrals: 0,
                    rewardsGenerated: 0,
                    rewardsPaid: 0,
                    rewardsPending: 0,
                };

            return res.status(200).json({
                success: true,

                data: {
                    stats,

                    referrers: result.data,

                    pagination: {
                        page,
                        limit,
                        total: totalReferrers,
                        totalPages: Math.ceil(
                            totalReferrers / limit
                        ),
                        hasNextPage:
                            page <
                            Math.ceil(
                                totalReferrers / limit
                            ),
                        hasPreviousPage:
                            page > 1,
                    },
                },
            });
        } catch (error) {
            console.error(
                "❌ Admin referral overview error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to load referral overview.",
                error: error.message,
            });
        }
    }
);

// =====================================================
// ADMIN REFERRER DETAILS
//
// GET /user_cohort/admin/referrals/:referrerId
// =====================================================

router.get(
    "/admin/referrals/:referrerId",
    requireAdmin,
    async (req, res) => {
        try {
            const { referrerId } = req.params;

            const referrer = await User.findById(
                referrerId
            ).select(
                "fullName email profileImage referralCode twitterHandle createdAt"
            );

            if (!referrer) {
                return res.status(404).json({
                    success: false,
                    message: "Referrer not found.",
                });
            }

            const referrals =
                await Referral.find({
                    referrer: referrerId,
                    cohort: "cohort-1.0",
                })
                    .populate(
                        "referredUser",
                        "fullName email profileImage twitterHandle"
                    )
                    .populate(
                        "cohortRegistration",
                        "fullName email country track about status registeredAt"
                    )
                    .sort({
                        createdAt: -1,
                    })
                    .lean();

            const summary = {
                total: referrals.length,

                registered: referrals.filter(
                    (item) =>
                        item.status === "registered"
                ).length,

                paid: referrals.filter(
                    (item) =>
                        item.status === "paid" ||
                        item.status === "rewarded"
                ).length,

                rewarded: referrals.filter(
                    (item) =>
                        item.status === "rewarded"
                ).length,

                cancelled: referrals.filter(
                    (item) =>
                        item.status === "cancelled"
                ).length,

                rewardsGenerated:
                    referrals.reduce(
                        (total, item) =>
                            total +
                            (item.rewardAmount || 0),
                        0
                    ),

                rewardsPaid:
                    referrals.reduce(
                        (total, item) =>
                            item.rewardStatus === "paid"
                                ? total +
                                  (item.rewardAmount || 0)
                                : total,
                        0
                    ),
            };

            return res.status(200).json({
                success: true,

                data: {
                    referrer,
                    summary,
                    referrals,
                },
            });
        } catch (error) {
            console.error(
                "❌ Admin referrer details error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to load referrer details.",
                error: error.message,
            });
        }
    }
);



module.exports = router;
