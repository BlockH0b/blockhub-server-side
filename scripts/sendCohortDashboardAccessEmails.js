// =====================================================
// LOAD ENVIRONMENT VARIABLES
// =====================================================

require("dotenv").config({
    path: require("path").resolve(
        __dirname,
        "../.env"
    ),
});

const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const User = require("../models/user");
const CohortAccessToken = require("../models/CohortAccessToken");
const CohortRegistration = require("../models/Cohort");



// =====================================================
// DNS CONFIGURATION
// =====================================================

const dnsPromises = require("node:dns/promises");
const dns = require("dns");
const createCohortAccessToken = require("../utils/createCohortAccessToken");

dnsPromises.setServers([
    "1.1.1.1",
    "8.8.8.8",
]);

dns.setDefaultResultOrder("ipv4first");

// =====================================================
// CONFIG
// =====================================================

const COHORT = "cohort-1.0";

// -----------------------------------------------------
// TEST MODE
// -----------------------------------------------------
// true  = ONLY TEST_EMAILS receive the email
// false = ALL Cohort 1.0 registered users receive email
// -----------------------------------------------------

const TEST_MODE = true;

const TEST_EMAILS = [
    "danieldaudu65@gmail.com",
];

// =====================================================
// DATABASE
// =====================================================

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
    throw new Error(
        "MONGODB_URI is missing from your .env file."
    );
}

// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,

    // logger: true,
    // debug: true,

});

// =====================================================
// EMAIL TRANSPORTER CHECK
// =====================================================

const verifyEmailTransporter = async () => {
    try {
        await transporter.verify();

        console.log(
            "✅ Email transporter is ready"
        );
    } catch (error) {
        console.error(
            "❌ Email transporter verification failed:"
        );

        console.error(error.message);

        throw error;
    }
};

// =====================================================
// DASHBOARD EMAIL HTML
// =====================================================


const createDashboardEmailHTML = ({
    firstName,
    dashboardLink,
}) => {
    return `
<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0; padding:0; background:#f4f4f5;"
>
    <tr>
        <td align="center" style="padding:0; margin:0;">

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

                <!-- IMAGE -->
                <tr>
                    <td style="padding:0; margin:0; line-height:0; font-size:0;">
                        <img
                            src="https://res.cloudinary.com/dd7faellv/image/upload/v1788434434/photo_2026-09-03_12-19-22_tvehzz.jpg"
                            alt="BlockHub"
                            width="620"
                            style="
                                display:block;
                                width:100%;
                                max-width:620px;
                                height:auto;
                                margin:0;
                                padding:0;
                                border:0;
                            "
                        />
                    </td>
                </tr>

                <!-- CONTENT -->
                <tr>
                    <td style="padding:25px 25px 30px;">

                        <p style="
                            margin:0 0 15px;
                            font-size:16px;
                            line-height:1.5;
                            color:#18181b;
                        ">
                            Hello ${firstName},
                        </p>

                        <p style="
                            margin:0 0 15px;
                            font-size:15px;
                            line-height:1.6;
                            color:#3f3f46;
                        ">
                            You're already registered for
                            <strong>BlockHub Cohort 1.0</strong>.
                        </p>

                        <p style="
                            margin:0 0 20px;
                            font-size:15px;
                            line-height:1.6;
                            color:#3f3f46;
                        ">
                            Your personal cohort dashboard is now ready.
                            From your dashboard, you'll be able to keep track
                            of your learning journey, classes, schedule,
                            announcements and other important cohort resources.
                        </p>

                        <!-- BUTTON -->
                        <table
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="margin:0 0 20px;"
                        >
                            <tr>
                                <td>
                                    <a
                                        href="${dashboardLink}"
                                        target="_blank"
                                        style="
                                            display:inline-block;
                                            background:linear-gradient(90deg,#052e24 0%,#064e3b 50%,#111827 100%);
                                            color:#ffffff;
                                            text-decoration:none;
                                            padding:12px 22px;
                                            border-radius:6px;
                                            font-size:15px;
                                            font-weight:bold;
                                        "
                                    >
                                        Access My Dashboard
                                    </a>
                                </td>
                            </tr>
                        </table>

                        <!-- NOTICE -->
                        <p style="
                            margin:0 0 20px;
                            padding:12px 15px;
                            background:#f0fdf4;
                            font-size:13px;
                            line-height:1.5;
                            color:#166534;
                        ">
                            <strong>Important:</strong>
                            This access link is unique to you and expires after
                            <strong>7 days</strong>. If it expires, you can
                            request a new dashboard access link.
                        </p>

                        <p style="
                            margin:0 0 15px;
                            font-size:15px;
                            line-height:1.6;
                            color:#3f3f46;
                        ">
                            <strong>Cohort starts:</strong>
                            October 27, 2026
                        </p>

                        <p style="
                            margin:0;
                            font-size:15px;
                            line-height:1.6;
                            color:#3f3f46;
                        ">
                            We're excited to have you with us.
                            Get ready to learn, build and grow with
                            the BlockHub community.
                        </p>

                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td style="
                        padding:18px 25px;
                        background:#fafafa;
                        border-top:1px solid #e4e4e7;
                        text-align:center;
                    ">
                        <p style="
                            margin:0 0 6px;
                            font-size:12px;
                            color:#71717a;
                        ">
                            BlockHub — Building Africa's leading
                            educative digital product platform.
                        </p>

                        <p style="
                            margin:0;
                            font-size:11px;
                            color:#a1a1aa;
                        ">
                            This email was sent because you registered
                            for BlockHub Cohort 1.0.
                        </p>
                    </td>
                </tr>

            </table>

        </td>
    </tr>
</table>
`;
};


// =====================================================
// SEND EMAIL
// =====================================================

const sendDashboardEmail = async ({
    email,
    firstName,
    dashboardLink,
}) => {

    await transporter.sendMail({

        from:
            `"BlockHub" <${process.env.MAIL_USER}>`,

        to: email,

        subject:
            "Your BlockHub Cohort 1.0 Dashboard Is Ready 🎓",

        html:
            createDashboardEmailHTML({
                firstName,
                dashboardLink,
            }),
    });

    console.log(
        `✅ Dashboard email sent to ${email}`
    );
};

// =====================================================
// MAIN CAMPAIGN
// =====================================================

const sendDashboardAccessEmails = async () => {

    try {

        console.log(
            "\n🚀 Starting BlockHub Cohort Dashboard Email Campaign...\n"
        );


        // =============================================
        // CHECK ENVIRONMENT VARIABLES
        // =============================================

        if (!process.env.MAIL_USER) {
            throw new Error(
                "MAIL_USER is missing from your .env file."
            );
        }

        if (!process.env.MAIL_PASS) {
            throw new Error(
                "MAIL_PASSWORD is missing from your .env file."
            );
        }

        if (!process.env.API_URL) {
            throw new Error(
                "API_URL is missing from your .env file."
            );
        }


        // =============================================
        // CONNECT DATABASE
        // =============================================

        await mongoose.connect(MONGO_URI);

        console.log(
            "✅ MongoDB connected"
        );


        // =============================================
        // VERIFY EMAIL
        // =============================================

        await verifyEmailTransporter();


        // =============================================
        // GET REGISTRATIONS
        // =============================================

        let registrations;


        // =============================================
        // TEST MODE
        // =============================================

        if (TEST_MODE) {

            console.log(
                "🧪 TEST MODE ENABLED"
            );

            console.log(
                `📧 Test recipients: ${TEST_EMAILS.join(", ")}`
            );


            registrations =
                await CohortRegistration.find({

                    cohort: COHORT,

                    email: {
                        $in:
                            TEST_EMAILS.map(
                                (email) =>
                                    email
                                        .trim()
                                        .toLowerCase()
                            ),
                    },

                }).lean();

        }


        // =============================================
        // PRODUCTION MODE
        // =============================================

        else {

            console.log(
                "🔥 PRODUCTION MODE ENABLED"
            );

            console.log(
                "📧 Preparing to send to ALL Cohort 1.0 registrations..."
            );


            registrations =
                await CohortRegistration.find({
                    cohort: COHORT,
                }).lean();

        }


        // =============================================
        // REGISTRATION COUNT
        // =============================================

        console.log(
            `👥 Registrations found: ${registrations.length}`
        );


        // =============================================
        // NO REGISTRATIONS
        // =============================================

        if (!registrations.length) {

            console.log(
                "⚠️ No matching cohort registrations found."
            );

            return;
        }


        // =============================================
        // PROCESS EACH USER
        // =============================================

        for (
            const registration
            of registrations
        ) {

            try {

                console.log(
                    `\n🔄 Processing ${registration.email}...`
                );


                // =====================================
                // FIND USER
                // =====================================

                const user =
                    await User.findById(
                        registration.user
                    ).lean();


                if (!user) {

                    console.log(
                        `⚠️ User not found for ${registration.email}`
                    );

                    continue;
                }


                // =====================================
                // GENERATE TEMPORARY ACCESS TOKEN
                // =====================================

                const {
                    token,
                    tokenId,
                } =
                    createCohortAccessToken({

                        userId:
                            user._id,

                        registrationId:
                            registration._id,

                        cohort:
                            COHORT,
                    });


                // =====================================
                // SAVE ACCESS TOKEN
                // =====================================

                await CohortAccessToken.create({

                    user:
                        user._id,

                    registration:
                        registration._id,

                    cohort:
                        COHORT,

                    tokenId,

                    // ================================
                    // TOKEN EXPIRES AFTER 7 DAYS
                    // ================================

                    expiresAt:
                        new Date(
                            Date.now() +
                            7 *
                            24 *
                            60 *
                            60 *
                            1000
                        ),
                });


                console.log(
                    "💾 Temporary access token saved"
                );


                // =====================================
                // CREATE PERSONAL DASHBOARD LINK
                // =====================================

                const dashboardLink =
                    `${process.env.API_URL}/user_userCohort/access/${token}`;


                // =====================================
                // GET FIRST NAME
                // =====================================

                const firstName =
                    user.fullName
                        ?.trim()
                        ?.split(" ")[0] ||
                    "there";


                // =====================================
                // SEND EMAIL
                // =====================================

                await sendDashboardEmail({

                    email:
                        registration.email,

                    firstName,

                    dashboardLink,
                });


                // =====================================
                // SUCCESS LOG
                // =====================================

                console.log(
                    `🎓 ${user.fullName} → ${registration.email}`
                );

            }


            // =========================================
            // USER ERROR
            // =========================================

            catch (userError) {

                console.error(
                    `❌ Failed for ${registration.email}:`,
                    userError.message
                );

            }

        }


        // =============================================
        // CAMPAIGN COMPLETED
        // =============================================

        console.log(
            "\n✅ Campaign completed successfully.\n"
        );

    }


    // ===============================================
    // CAMPAIGN ERROR
    // ===============================================

    catch (error) {

        console.error(
            "\n❌ Campaign failed:"
        );

        console.error(
            error.message
        );

    }


    // ===============================================
    // DISCONNECT DATABASE
    // ===============================================

    finally {

        await mongoose.disconnect();

        console.log(
            "🔌 MongoDB disconnected"
        );

    }
};


// =====================================================
// RUN CAMPAIGN
// =====================================================

sendDashboardAccessEmails();