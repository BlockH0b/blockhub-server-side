// ============================================
// BlockHub Cohort 1.0
// Referral Community Group Email Campaign
// ============================================

const path = require("path");
const dns = require("dns");

const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

const dnsPromises = require("node:dns/promises");

dnsPromises.setServers([
    "1.1.1.1",
    "8.8.8.8",
]);



// ============================================
// LOAD ENV
// ============================================

dotenv.config({
    path: path.resolve(__dirname, "../.env"),
});

// ============================================
// FORCE IPV4
// ============================================

dns.setDefaultResultOrder("ipv4first");

// ============================================
// MODE
// ============================================

// true  = ONLY test email receives the email
// false = real referred users receive the email
const TEST_MODE = false;

// ============================================
// TEST EMAIL
// ============================================

const TEST_EMAILS = [
    "danieldaudu65@gmail.com",
];

// ============================================
// CAMPAIGN SETTINGS
// ============================================

const COHORT = "cohort-1.0";

// ============================================
// TARGET REFERRER
// ============================================
//
// We can target the referrer using either:
//
// 1. REFERRER_ID
// 2. REFERRAL_CODE
//
// For now we are using the referrer ID.
//
// Replace this with the actual referrer's ID.
//
// ============================================

const REFERRER_ID = "68a489b2cce805962c7d26af";

// If you prefer referral code instead,
// put the code here and set REFERRER_ID = null.
//
// Example:
// const REFERRAL_CODE = "BH-AC4AEF10";

const REFERRAL_CODE = null;

// ============================================
// COMMUNITY GROUP LINK
// ============================================
//
// PUT THE REAL GROUP LINK HERE
//
// ============================================

const GROUP_LINK = "https://chat.whatsapp.com/EGSfZBtI46q12kkF0iJwjM?mode=gi_t";

// ============================================
// MODELS
// ============================================

const User = require("../models/User");

const Referral = require("../models/Referral");

const CohortRegistration = require("../models/Cohort");

// ============================================
// SMTP
// ============================================

const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

// ============================================
// CREATE EMAIL HTML
// ============================================

function createReferralGroupEmailHTML({
    fullName,
    groupLink,
}) {

    return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
    BlockHub Cohort 1.0
</title>

</head>

<body
    style="
        margin:0;
        padding:0;
        background:#f5f5f5;
        font-family:Arial,Helvetica,sans-serif;
    "
>

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
        margin:0;
        padding:0;
        background:#f5f5f5;
    "
>

<tr>

<td
    align="center"
    style="
        margin:0;
        padding:0;
    "
>

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
        max-width:620px;
        margin:0 auto;
        background:#ffffff;
    "
>

<!-- ==========================================
     IMAGE
=========================================== -->

<tr>

<td
    style="
        margin:0;
        padding:0;
        line-height:0;
        font-size:0;
    "
>

<img
    src="https://res.cloudinary.com/dd7faellv/image/upload/v1788434434/photo_2026-09-03_12-19-22_tvehzz.jpg"
    alt="BlockHub Cohort 1.0"
    width="620"
    style="
        display:block;
        width:100%;
        max-width:620px;
        height:auto;
        margin:0;
        padding:0;
        border:0;
        outline:none;
        text-decoration:none;
    "
>

</td>

</tr>

<!-- ==========================================
     CONTENT
=========================================== -->

<tr>

<td
    style="
        padding:35px 30px 30px 30px;
        color:#222222;
    "
>

<p
    style="
        margin:0 0 18px 0;
        font-size:16px;
        line-height:1.6;
    "
>

Hello ${fullName || "there"},

</p>

<p
    style="
        margin:0 0 18px 0;
        font-size:16px;
        line-height:1.6;
    "
>

We noticed there was an issue with an earlier
communication sent regarding the
<strong>BlockHub Cohort 1.0 community group.</strong>

</p>

<p
    style="
        margin:0 0 18px 0;
        font-size:16px;
        line-height:1.6;
    "
>

We sincerely apologize for the confusion.

</p>

<p
    style="
        margin:0 0 25px 0;
        font-size:16px;
        line-height:1.6;
    "
>

The official community group is now ready.

Please join the group using the button below so
you can receive important updates and information
as we prepare for the cohort.

</p>

<!-- ==========================================
     JOIN BUTTON
=========================================== -->

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
>

<tr>

<td align="center">

<a
    href="${groupLink}"
    target="_blank"
    style="
        display:inline-block;
background:linear-gradient(90deg,#052e24 0%,#064e3b 50%,#111827 100%);
        color:#ffffff;
        text-decoration:none;
        font-size:16px;
        font-weight:bold;
        padding:14px 28px;
        border-radius:6px;
    "
>

Join the Cohort Group

</a>

</td>

</tr>

</table>

<p
    style="
        margin:28px 0 0 0;
        font-size:15px;
        line-height:1.6;
        color:#555555;
    "
>

We look forward to having you with us.

</p>

<p
    style="
        margin:25px 0 0 0;
        font-size:15px;
        line-height:1.6;
    "
>

<strong>BlockHub Team</strong>

</p>

</td>

</tr>

<!-- ==========================================
     FOOTER
=========================================== -->

<tr>

<td
    style="
        padding:20px 30px;
        background:linear-gradient(90deg,#052e24 0%,#064e3b 50%,#111827 100%);
        text-align:center;
    "
>

<p
    style="
        margin:0;
        color:#a7f3d0;
        font-size:13px;
        line-height:1.5;
    "
>

© ${new Date().getFullYear()} BlockHub.
All rights reserved.

</p>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
`;
}

// ============================================
// FIND USERS REFERRED BY ONE PERSON
// ============================================

async function getReferredUsers() {

    console.log("\n🔎 Finding referred users...\n");

    // ----------------------------------------
    // Build query
    // ----------------------------------------

    const referralQuery = {
        cohort: COHORT,

        status: {
            $in: [
                "registered",
                "paid",
                "rewarded",
            ],
        },
    };

    // ----------------------------------------
    // Target by referrer ID
    // ----------------------------------------

    if (REFERRER_ID) {

        if (
            !mongoose.Types.ObjectId.isValid(
                REFERRER_ID
            )
        ) {

            throw new Error(
                `Invalid REFERRER_ID: ${REFERRER_ID}`
            );
        }

        referralQuery.referrer =
            new mongoose.Types.ObjectId(
                REFERRER_ID
            );
    }

    // ----------------------------------------
    // OR target by referral code
    // ----------------------------------------

    if (REFERRAL_CODE) {

        referralQuery.referralCode =
            REFERRAL_CODE
                .trim()
                .toUpperCase();
    }

    // ----------------------------------------
    // Find referral records
    // ----------------------------------------

    const referrals =
        await Referral
            .find(referralQuery)
            .select(
                "referrer referredUser referralCode cohortRegistration status"
            )
            .lean();

    console.log(
        `📊 Referral records found: ${referrals.length}`
    );

    if (!referrals.length) {

        return [];
    }

    // ========================================
    // GET REFERRED USER IDS
    // ========================================

    const userIds = [
        ...new Set(
            referrals
                .map(
                    (referral) =>
                        referral.referredUser?.toString()
                )
                .filter(Boolean)
        ),
    ];

    // ========================================
    // FIND USERS
    // ========================================

    const users =
        await User
            .find({
                _id: {
                    $in: userIds,
                },
            })
            .select(
                "_id fullName email"
            )
            .lean();

    // ========================================
    // GET COHORT REGISTRATIONS
    // ========================================

    const registrationIds = [
        ...new Set(
            referrals
                .map(
                    (referral) =>
                        referral.cohortRegistration?.toString()
                )
                .filter(Boolean)
        ),
    ];

    const registrations =
        registrationIds.length
            ? await CohortRegistration
                .find({
                    _id: {
                        $in: registrationIds,
                    },

                    cohort: COHORT,

                    status: {
                        $ne: "rejected",
                    },
                })
                .select(
                    "_id user fullName email status"
                )
                .lean()
            : [];

    // ========================================
    // CREATE LOOKUP MAPS
    // ========================================

    const userMap = new Map(
        users.map(
            (user) => [
                user._id.toString(),
                user,
            ]
        )
    );

    const registrationMap = new Map(
        registrations.map(
            (registration) => [
                registration._id.toString(),
                registration,
            ]
        )
    );

    // ========================================
    // COMBINE DATA
    // ========================================

    const referredUsers = [];

    for (const referral of referrals) {

        const userId =
            referral.referredUser?.toString();

        const user =
            userMap.get(userId);

        if (!user) {

            console.log(
                `⚠️ User not found: ${userId}`
            );

            continue;
        }

        const registration =
            referral.cohortRegistration
                ? registrationMap.get(
                    referral.cohortRegistration.toString()
                )
                : null;

        // ------------------------------------
        // Prefer User email
        // ------------------------------------

        const email =
            user.email ||
            registration?.email ||
            null;

        if (!email) {

            console.log(
                `⚠️ No email found for ${user.fullName || userId
                }`
            );

            continue;
        }

        referredUsers.push({

            userId,

            fullName:
                user.fullName ||
                registration?.fullName ||
                "BlockHub Member",

            email:
                email
                    .trim()
                    .toLowerCase(),

            referralCode:
                referral.referralCode,

            registrationStatus:
                registration?.status || null,
        });
    }

    // ========================================
    // REMOVE DUPLICATE EMAILS
    // ========================================

    const uniqueUsers = [];

    const seenEmails = new Set();

    for (const user of referredUsers) {

        if (
            seenEmails.has(
                user.email
            )
        ) {
            continue;
        }

        seenEmails.add(
            user.email
        );

        uniqueUsers.push(user);
    }

    return uniqueUsers;
}

// ============================================
// FIND TOP REFERRERS
// ============================================

async function findTopReferrers() {

    console.log(
        "\n🏆 Finding top referrers...\n"
    );

    const results =
        await Referral.aggregate([

            {
                $match: {
                    cohort: COHORT,

                    status: {
                        $in: [
                            "registered",
                            "paid",
                            "rewarded",
                        ],
                    },
                },
            },

            {
                $group: {

                    _id: "$referrer",

                    referralCount: {
                        $sum: 1,
                    },

                },
            },

            {
                $sort: {
                    referralCount: -1,
                },
            },

            {
                $limit: 20,
            },

        ]);

    if (!results.length) {

        console.log(
            "No referrers found."
        );

        return [];
    }

    const referrerIds =
        results.map(
            (item) => item._id
        );

    const referrers =
        await User
            .find({
                _id: {
                    $in: referrerIds,
                },
            })
            .select(
                "_id fullName email referralCode"
            )
            .lean();

    const referrerMap =
        new Map(
            referrers.map(
                (user) => [
                    user._id.toString(),
                    user,
                ]
            )
        );

    console.log(
        "=========================================="
    );

    console.log(
        "🏆 TOP REFERRERS"
    );

    console.log(
        "=========================================="
    );

    results.forEach(
        (result, index) => {

            const referrer =
                referrerMap.get(
                    result._id.toString()
                );

            console.log(`
${index + 1}. ${referrer?.fullName || "Unknown"}

   Email:
   ${referrer?.email || "No email"}

   Referral Code:
   ${referrer?.referralCode || "N/A"}

   Referrer ID:
   ${result._id}

   Total Referrals:
   ${result.referralCount}
------------------------------------------
`);
        }
    );

    return results;
}

// ============================================
// SEND ONE EMAIL
// ============================================

async function sendReferralGroupEmail(user) {

    const mailOptions = {

        from:
            `"BlockHub" <${process.env.MAIL_USER}>`,

        to:
            user.email,

        subject:
            "Important Update: BlockHub Cohort 1.0 Community Group",

        html:
            createReferralGroupEmailHTML({

                fullName:
                    user.fullName,

                groupLink:
                    GROUP_LINK,

            }),
    };

    const info =
        await transporter.sendMail(
            mailOptions
        );

    return info;
}

// ============================================
// SEND CAMPAIGN
// ============================================

async function sendReferralGroupEmails(
    users
) {

    console.log(
        "\n📧 Preparing email campaign..."
    );

    let recipients = users;

    // ========================================
    // TEST MODE
    // ========================================

    if (TEST_MODE) {

        console.log(
            "\n🧪 TEST MODE ENABLED"
        );

        console.log(
            `📩 Test recipient(s): ${TEST_EMAILS.join(", ")
            }`
        );

        recipients =
            TEST_EMAILS.map(
                (email) => ({

                    userId: null,

                    fullName:
                        "Daniel",

                    email:
                        email
                            .trim()
                            .toLowerCase(),

                })
            );
    }

    // ========================================
    // SAFETY CHECK
    // ========================================

    if (!recipients.length) {

        console.log(
            "❌ No recipients."
        );

        return;
    }

    console.log(
        `\n📨 Emails to send: ${recipients.length}`
    );

    // ========================================
    // SEND
    // ========================================

    let sent = 0;

    let failed = 0;

    for (
        const user of recipients
    ) {

        try {

            console.log(
                `\n📤 Sending to: ${user.fullName
                } <${user.email}>`
            );

            await sendReferralGroupEmail(
                user
            );

            sent++;

            console.log(
                `✅ Sent successfully`
            );

        } catch (error) {

            failed++;

            console.error(
                `❌ Failed to send to ${user.email
                }`
            );

            console.error(
                error.message
            );
        }

        // Small delay between emails
        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    500
                )
        );
    }

    // ========================================
    // SUMMARY
    // ========================================

    console.log(
        "\n=========================================="
    );

    console.log(
        "📊 CAMPAIGN SUMMARY"
    );

    console.log(
        "=========================================="
    );

    console.log(
        `👥 Total referred users: ${users.length}`
    );

    console.log(
        `📧 Emails attempted: ${recipients.length}`
    );

    console.log(
        `✅ Sent: ${sent}`
    );

    console.log(
        `❌ Failed: ${failed}`
    );

    console.log(
        `🧪 Test mode: ${TEST_MODE}`
    );

    console.log(
        "=========================================="
    );
}

// ============================================
// MAIN
// ============================================

async function main() {

    try {

        console.log(
            "\n=========================================="
        );

        console.log(
            "🚀 BLOCKHUB REFERRAL EMAIL CAMPAIGN"
        );

        console.log(
            "==========================================\n"
        );

        // ====================================
        // ENV CHECK
        // ====================================

        if (!process.env.MONGODB_URI) {

            throw new Error(
                "MONGO_URI is missing from .env"
            );
        }

        if (!process.env.MAIL_USER) {

            throw new Error(
                "MAIL_USER is missing from .env"
            );
        }

        if (!process.env.MAIL_PASS) {

            throw new Error(
                "MAIL_PASS is missing from .env"
            );
        }

        // ====================================
        // GROUP LINK CHECK
        // ====================================

        if (
            !GROUP_LINK ||
            GROUP_LINK ===
            "PASTE_GROUP_LINK_HERE"
        ) {

            throw new Error(
                "Please add the real GROUP_LINK before running the campaign."
            );
        }

        // ====================================
        // CONNECT DATABASE
        // ====================================

        console.log(
            "🔌 Connecting to MongoDB..."
        );

        await mongoose.connect(
            process.env.MONGODB_URI,
        );

        console.log(
            "✅ MongoDB connected"
        );

        // ====================================
        // SHOW TOP REFERRERS
        // ====================================

        await findTopReferrers();

        // ====================================
        // GET TARGET USERS
        // ====================================

        const referredUsers =
            await getReferredUsers();

        console.log(
            `\n👥 Target referred users: ${referredUsers.length
            }`
        );

        // ====================================
        // DISPLAY TARGETS
        // ====================================

        if (
            referredUsers.length
        ) {

            console.log(
                "\n=========================================="
            );

            console.log(
                "🎯 TARGET USERS"
            );

            console.log(
                "=========================================="
            );

            referredUsers.forEach(
                (user, index) => {

                    console.log(
                        `${index + 1}. ${user.fullName
                        } — ${user.email
                        }`
                    );
                }
            );

            console.log(
                "=========================================="
            );
        }

        // ====================================
        // SEND
        // ====================================

        await sendReferralGroupEmails(
            referredUsers
        );

        // ====================================
        // DISCONNECT
        // ====================================

        await mongoose.connection.close();

        console.log(
            "\n🔌 MongoDB disconnected"
        );

        console.log(
            "✅ Campaign finished."
        );

    } catch (error) {

        console.error(
            "\n❌ Campaign failed:"
        );

        console.error(
            error
        );

        try {

            await mongoose.connection.close();

        } catch (_) { }

        process.exit(1);
    }
}

// ============================================
// START
// ============================================

main();