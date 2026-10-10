const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");

const createCohortAccessToken = ({
    userId,
    registrationId,
    cohort,
}) => {
    const tokenId = randomUUID();

    const token = jwt.sign(
        {
            userId: userId.toString(),
            registrationId: registrationId.toString(),
            cohort,
            purpose: "cohort_email_access",
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
            jwtid: tokenId,
        }
    );

    return {
        token,
        tokenId,
    };
};

module.exports = createCohortAccessToken;