/*
 * ============================================================
 * Email configuration  (all from .env)
 * ============================================================
 *
 * WHO SENDS
 *   EMAIL_FROM="BlockHub <hello@blockhubglobal.xyz>"
 *
 * HOW IT SENDS (pick one)
 *   1) Any SMTP provider (recommended: Resend, Brevo, Zoho, SES)
 *        SMTP_HOST=smtp.resend.com
 *        SMTP_PORT=465
 *        SMTP_USER=resend
 *        SMTP_PASS=re_xxxxxxxx
 *   2) Nothing set -> falls back to Gmail with MAIL_USER / MAIL_PASS
 *      (fine for testing; Gmail caps ~500 emails/day)
 *
 * TEST MODE
 *   EMAIL_TEST_MODE=true
 *   EMAIL_TEST_RECIPIENTS=you@gmail.com,teammate@gmail.com
 *     -> EVERY email goes only to these addresses instead of the
 *        real user. The subject shows who it was meant for.
 *     -> If EMAIL_TEST_MODE is not set at all it is ON outside
 *        production, OFF in production.
 *   EMAIL_TEST_MAX_PER_BATCH=5
 *     -> In test mode, a bulk send (e.g. announcement to 300
 *        students) only delivers the first N, so your inbox isn't
 *        flooded. The rest are logged as "skipped (test limit)".
 *
 * OTHER
 *   EMAIL_DISABLED=true          -> log only, send nothing
 *   EMAIL_RATE_PER_MINUTE=120    -> throttle for bulk sends
 *   EMAIL_JOBS_ENABLED=false     -> turn off reminder/digest crons
 *   COHORT_COMMUNITY_LINK=...    -> BlockHub community link in emails
 * ============================================================
 */

function bool(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function list(value) {
    return String(value || "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === "production";

function getConfig() {
    return {
        from:
            process.env.EMAIL_FROM ||
            (process.env.MAIL_USER ? `BlockHub <${process.env.MAIL_USER}>` : "BlockHub <no-reply@blockhubglobal.xyz>"),
        replyTo: process.env.EMAIL_REPLY_TO || undefined,

        smtp: process.env.SMTP_HOST
            ? {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: bool(process.env.SMTP_SECURE, (Number(process.env.SMTP_PORT) || 465) === 465),
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            }
            : null,

        gmail: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },

        testMode: bool(process.env.EMAIL_TEST_MODE, !isProduction),
        testRecipients: list(process.env.EMAIL_TEST_RECIPIENTS),
        testMaxPerBatch: Number(process.env.EMAIL_TEST_MAX_PER_BATCH) || 5,

        disabled: bool(process.env.EMAIL_DISABLED, false),
        ratePerMinute: Number(process.env.EMAIL_RATE_PER_MINUTE) || 120,
        jobsEnabled: bool(process.env.EMAIL_JOBS_ENABLED, true),

        frontendUrl: (process.env.FRONTEND_URL || "https://blockhubglobal.xyz").replace(/\/$/, ""),
        apiUrl: (process.env.SERVER_URL || process.env.API_URL || "https://api2.blockhubglobal.xyz").replace(/\/$/, ""),
        communityLink: process.env.COHORT_COMMUNITY_LINK || process.env.BLOCKHUB_COMMUNITY_LINK || null,
    };
}

module.exports = { getConfig };
