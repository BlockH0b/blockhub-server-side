const jwt = require("jsonwebtoken");

const createCohortToken = ({
    userId,
    registrationId,
    cohort,
}) => {
    const token = jwt.sign(
        {
            userId: userId.toString(),
            registrationId: registrationId.toString(),
            cohort,
            purpose: "cohort_dashboard",
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "30d",
        }
    );

    return token;
};

module.exports = createCohortToken;