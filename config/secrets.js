/*
 * ============================================================
 * Secrets - read ONLY from environment variables (.env)
 * ============================================================
 * Nothing secret is ever written in the code, so the repo can
 * be pushed to GitHub safely. Missing required values stop the
 * server at startup with a clear message instead of silently
 * falling back to a guessable default.
 * ============================================================
 */

const REQUIRED = ["MONGODB_URI", "JWT_SECRET"];

function checkRequiredEnv() {
    const missing = REQUIRED.filter((key) => !process.env[key]);
    if (missing.length) {
        console.error(`\n❌ Missing required environment variables: ${missing.join(", ")}`);
        console.error("   Add them to Backend/.env (see .env.example) and restart.\n");
        process.exit(1);
    }
}

// Tutor (academy) tokens: own secret if set, otherwise the main JWT secret.
// (Used to fall back to the public string "tutoraccesskey".)
function tutorAccessSecret() {
    return process.env.TUTOR_ACCESS_SECRET_KEY || process.env.JWT_SECRET;
}

module.exports = { checkRequiredEnv, tutorAccessSecret };
