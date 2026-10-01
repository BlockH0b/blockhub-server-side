// =====================================================
// BLOCKHUB CREATOR CIRCLE EMAIL CAMPAIGN
// =====================================================

require("dotenv").config({
    path: require("path").resolve(
        __dirname,
        "../.env"
    ),
});

const dotenv = require("dotenv");

const dnsPromises = require("node:dns/promises");

dnsPromises.setServers([
    "1.1.1.1",
    "8.8.8.8",
]);

const nodemailer = require("nodemailer");

// =====================================================
// CONFIG
// =====================================================

// true  = ONLY TEST_EMAILS receive the email
// false = ONLY ADDITIONAL_EMAIL_USERS receive the email

const TEST_MODE = false;

const TEST_EMAILS = [
    "danieldaudu65@gmail.com",
];

// =====================================================
// ADDITIONAL EMAIL USERS
// =====================================================

const additionalEmailUsers = [
    "simpabassador@gmail.com",
    "faisallweb3@gmail.com",
    "saidudabai73@gmail.com",
    "olanaseabdulmalik343@gmail.com",
    "aremujesuninsola@gmail.com",
    "tuanhm.forwork@gmail.com",
    "yaukhadija772@gmail.com",
    "rs47825@gmail.com",
    "olamiking112@gmail.com",
    "idrisanisoba@gmail.com",
    "melarneen@gmail.com",
    "shadrachadeyemi22@gmail.com",
    "ewuosoolusesi@gmail.com",
    "reallawancy980@gmail.com",
    "munachicollins16@gmail.com",
    "samueljohnny300@gmail.com",
    "abuyusro0x@gmail.com",
    "loyaltybassey@gmail.com",
    "mra476899@gmail.com",
    "tourmaline537@gmail.com",
    "basmahabdullahi25@gmail.com",
    "argnby2@gmail.com",
    "haseebashiq68@gmail.com",
    "emedionggregory12@gmail.com",
    "kaylashowdq@gmail.com",
    "bigchorux@gmail.com",
    "davidparkerr1109@gmail.com",
    "dilshanmapalahiru@gmail.com",
    "mirasam554@gmail.com",
    "temmymaverick@gmail.com",
    "ekwecollins202@gmail.com",
    "mikailushehu6396@gmail.com",
    "ntatubokjonathan@gmail.com",
    "meerwaseem242@gmail.com",
    "muhammadtoheed016@gmail.com",
    "waqascrypto1212@gmail.com",
    "zeexeeusman@gmail.com",
    "kehnybello@gmail.com",
    "nanakhadija5759@gmail.com",
    "cryptofirst2121@gmail.com",
    "ubomrichard@gmail.com",
    "ahmadmusamusawa05@gmail.com",
    "oparafavouramarachi@gmail.com",
    "blessingaffangkan@gmail.com",
    "isaiahosarobo08@gmail.com",
    "akpanisrael339@gmail.com",
    "ikeorapeace9@gmail.com",
    "nosiriprecious100@gmail.com",
    "gripyodha@gmail.com",
    "idowuadeleye64@gmail.com",
    "obaroelozino@gmail.com",
    "mubaraksultan08132@gmail.com",
    "emaximuse90@gmail.com",
    "clintonallen312@gmail.com",
    "researchererick@gmail.com",
    "moibiridwan05@gmail.com",
    "eyeplays68@gmail.com",
    "emiresshakur@gmail.com",
    "aniebietudo01@gmail.com",
    "justann3771@gmail.com",
    "iwariogi@gmail.com",
    "joesunday2022@gmail.com",
    "sisibaby34@gmail.com",
    "orieoghenebrurugodspower@gmail.com",
    "noelemmanuel1080@gmail.com",
    "danny3adel@gmail.com",
    "raiutkarsh768@gmail.com",
    "freemanweb3@gmail.com",
    "willieuwakmfonabasi@gmail.com",
    "realbayoladimeji@gmail.com",
    "chocofweb3@gmail.com",
    "kaludc7@gmail.com",
    "nemeethan@gmail.com",
    "billionscyberltd@gmail.com",
    "ariaace73@gmail.com",
    "jehanmrda@gmail.com",
    "calliopeburns50@gmail.com",
    "clareonchain@gmail.com",
    "afolajayeola@gmail.com",
    "olajidesolomon033@gmail.com",
    "victoruduma2020@gmail.com",
    "ahamedabdl46@gmail.com",
    "oluebubevictor9448@gmail.com",
    "deesammy27@gmail.com",
    "adebayovictor2021@gmail.com",
    "allehezekiel09@gmail.com",
    "danieletim786@gmail.com",
    "mesh.remusa@gmail.com",
    "damilolan60@gmail.com",
    "justineze9@gmail.com",
    "tessa.creates1@gmail.com",
    "ojigombadavid@gmail.com",
    "cyrusweb8@gmail.com",
    "bumojasper@gmail.com",
    "0xnirjon@gmail.com",
    "philipmujuzi19@gmail.com",
    "danielbabatunde21@gmail.com",
    "kaneejoshua@gmail.com",
    "oyatokunanu2019@gmail.com",
    "sashinmeena@gmail.com",
    "pocox40036@gmail.com",
    "asiandanieluyo@gmail.com",
    "cryptolab746@gmail.com",
    "taminatorweb3@gmail.com",
    "tafatafamustapha@gmail.com",
    "riheaukale@gmail.com",
    "udomme78@gmail.com",
    "dienyejason@gmail.com",
    "cryptoshuraim@gmail.com",
    "olusholadex4u@gmail.com",
    "lexandermbila@gmail.com",
    "leomarvis112@gmail.com",
    "himskid1717@gmail.com",
    "paulbello2005@gmail.com",
    "bebedstar@gmail.com",
    "aasimeer123@gmail.com",
    "ednaramcc@gmail.com",
    "emprezzoftech@gmail.com",
    "fluxioeth@gmail.com",
    "asuquoedidiong100@gmail.com",
    "yyqq15539@gmail.com",
    "faithadesholar@gmail.com",
    "damilolaomokehinde9@gmail.com",
    "zacharyfx459@gmail.com",
    "estrada.kebs@gmail.com",
    "abdulabdulforex@gmail.com",
    "abdulhamidib21@gmail.com",
    "tonystarkq2@gmail.com",
    "nanmwaku97@gmail.com",
    "stephenstevester@gmail.com",
    "marveltroops999@gmail.com",
    "inioluwaoladele14@gmail.com",
    "remivictor20@gmail.com",
    "holamikky50@gmail.com",
    "abubakarabdulwaheed890@gmail.com",
    "abubakaradam08145@gmail.com",
    "boywonder3006@gmail.com",
    "maureenarchibong020@gmail.com",
    "cmcodedx@gmail.com",
    "basseymiracle589@gmail.com",
    "fedorahlazarus@gmail.com",
    "emmakunmi@gmail.com",
    "charlesbella247@gmail.com",
    "shelleymaeph@gmail.com",
    "foyedepo47@gmail.com",
    "decentral24diva@gmail.com",
    "oladeniunique16@gmail.com",
];

// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
});
// =====================================================
// CREATOR EMAIL HTML
// =====================================================

const createCreatorEmailHTML = () => {
    return `
<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0;padding:0;background:#f4f4f5;"
>
    <tr>
        <td align="center" style="padding:0;margin:0;">

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
                    <td
                        style="
                            padding:0;
                            margin:0;
                            line-height:0;
                            font-size:0;
                        "
                    >
                        <img
                            src="https://res.cloudinary.com/dd7faellv/image/upload/v1790419349/creators_vgmzqd.jpg"
                            alt="BlockHub Creator Circle"
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
                    <td
                        style="
                            padding:30px 25px 35px;
                        "
                    >

                        <p
                            style="
                                margin:0 0 18px;
                                font-size:16px;
                                line-height:1.5;
                                color:#18181b;
                            "
                        >
                            Hi Creator 👋,
                        </p>

                        <p
                            style="
                                margin:0 0 18px;
                                font-size:15px;
                                line-height:1.7;
                                color:#3f3f46;
                            "
                        >
                            You filled out the
                            <strong>BlockHub Creator Form</strong>,
                            and we're excited to finally bring the creator
                            community together.
                        </p>

                        <p
                            style="
                                margin:0 0 18px;
                                font-size:15px;
                                line-height:1.7;
                                color:#3f3f46;
                            "
                        >
                            We're building
                            <strong>BlockHub Creator Circle</strong> —
                            a space for creators to connect, collaborate,
                            discover opportunities, work on campaigns,
                            grow their skills, and create with other people
                            in the ecosystem.
                        </p>

                        <p
                            style="
                                margin:0 0 22px;
                                font-size:15px;
                                line-height:1.7;
                                color:#3f3f46;
                            "
                        >
                            And now, we're moving from the form to the
                            community.
                        </p>

                        <!-- NEXT STEP -->
                        <p
                            style="
                                margin:0 0 10px;
                                font-size:15px;
                                line-height:1.6;
                                color:#18181b;
                            "
                        >
                            <strong>Your next step:</strong>
                        </p>

                        <p
                            style="
                                margin:0 0 22px;
                                font-size:15px;
                                line-height:1.6;
                                color:#3f3f46;
                            "
                        >
                            Join the official
                            <strong>BlockHub Creator Group</strong>
                            here:
                        </p>

                        <!-- BUTTON -->
                        <table
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="margin:0 0 25px;"
                        >
                            <tr>
                                <td>
                                    <a
                                        href="https://t.me/+oOYjuCcnDqplNzFk"
                                        target="_blank"
                                        style="
                                            display:inline-block;
                                            background:#111827;
                                            color:#ffffff;
                                            text-decoration:none;
                                            padding:13px 24px;
                                            border-radius:7px;
                                            font-size:15px;
                                            font-weight:bold;
                                        "
                                    >
                                        Join BlockHub Creator Group
                                    </a>
                                </td>
                            </tr>
                        </table>

                        <p
                            style="
                                margin:0 0 18px;
                                font-size:15px;
                                line-height:1.6;
                                color:#3f3f46;
                            "
                        >
                            Or use the link below:
                        </p>

                        <p
                            style="
                                margin:0 0 25px;
                                font-size:13px;
                                line-height:1.6;
                                word-break:break-all;
                            "
                        >
                            <a
                                href="https://t.me/+oOYjuCcnDqplNzFk"
                                target="_blank"
                                style="
                                    color:#16a34a;
                                    text-decoration:none;
                                "
                            >
                                https://t.me/+oOYjuCcnDqplNzFk
                            </a>
                        </p>

                        <!-- WELCOME BOX -->
                        <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="
                                margin:0 0 25px;
                                background:#f0fdf4;
                                border-left:4px solid #16a34a;
                            "
                        >
                            <tr>
                                <td
                                    style="
                                        padding:15px 16px;
                                        font-size:14px;
                                        line-height:1.6;
                                        color:#166534;
                                    "
                                >
                                    <strong>
                                        Welcome to BlockHub Creator Circle 🫂
                                    </strong>
                                    <br />
                                    Let's create, collaborate and grow.
                                </td>
                            </tr>
                        </table>

                        <p
                            style="
                                margin:0;
                                font-size:15px;
                                line-height:1.6;
                                color:#3f3f46;
                            "
                        >
                            See you inside.
                            <br /><br />
                            <strong>— BlockHub Team</strong>
                        </p>

                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td
                        style="
                            padding:18px 25px;
                            background:#fafafa;
                            border-top:1px solid #e4e4e7;
                            text-align:center;
                        "
                    >
                        <p
                            style="
                                margin:0;
                                font-size:12px;
                                color:#71717a;
                            "
                        >
                            BlockHub — Building Africa's leading
                            educative digital product platform.
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

const sendCreatorEmail = async (email) => {

    await transporter.sendMail({

        from:
            `"BlockHub" <${process.env.MAIL_USER}>`,

        to: email,

        subject:
            "You're In — Welcome to the BlockHub Creator Network 🎉",

        html:
            createCreatorEmailHTML(),
    });

    console.log(
        `✅ Creator email sent to ${email}`
    );
};

// =====================================================
// MAIN CAMPAIGN
// =====================================================

const sendCreatorEmails = async () => {

    try {

        console.log(
            "\n🚀 Starting BlockHub Creator Circle Email Campaign...\n"
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
                "MAIL_PASS is missing from your .env file."
            );
        }

        // =============================================
        // VERIFY EMAIL TRANSPORTER
        // =============================================

        await transporter.verify();

        console.log(
            "✅ Email transporter is ready"
        );

        // =============================================
        // SELECT RECIPIENTS
        // =============================================

        const recipients = TEST_MODE
            ? TEST_EMAILS
            : additionalEmailUsers;

        console.log(
            TEST_MODE
                ? "🧪 TEST MODE ENABLED"
                : "🔥 CREATOR CAMPAIGN MODE ENABLED"
        );

        console.log(
            `📧 Recipients: ${recipients.length}`
        );

        // =============================================
        // SEND EMAILS
        // =============================================

        for (const email of recipients) {

            try {

                console.log(
                    `\n📨 Sending to ${email}...`
                );

                await sendCreatorEmail(
                    email.trim().toLowerCase()
                );

            } catch (error) {

                console.error(
                    `❌ Failed for ${email}:`,
                    error.message
                );

            }
        }

        console.log(
            "\n✅ Creator email campaign completed.\n"
        );

    } catch (error) {

        console.error(
            "\n❌ Campaign failed:"
        );

        console.error(
            error.message
        );

    }
};

// =====================================================
// RUN CAMPAIGN
// =====================================================

sendCreatorEmails();