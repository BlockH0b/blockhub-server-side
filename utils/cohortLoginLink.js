const CohortAccessToken = require("../models/CohortAccessToken");
const createCohortAccessToken = require("./createCohortAccessToken");
const notify = require("../services/email/notify");

/*
 * Email a one-time cohort dashboard login link.
 * Uses the existing /user_userCohort/access/:token flow
 * (single use, expires in 7 days).
 */
async function sendCohortLoginLink(user, registration) {
    const { token, tokenId } = createCohortAccessToken({
        userId: user._id,
        registrationId: registration._id,
        cohort: registration.cohort,
    });

    await CohortAccessToken.create({
        user: user._id,
        registration: registration._id,
        cohort: registration.cohort,
        tokenId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const apiBase = (process.env.SERVER_URL || process.env.API_URL || "").replace(/\/$/, "");
    const url = `${apiBase}/user_userCohort/access/${token}`;

    return notify.cohortLoginLink({
        email: registration.email || user.email,
        name: user.fullName || registration.fullName,
        url,
    });
}

module.exports = sendCohortLoginLink;
