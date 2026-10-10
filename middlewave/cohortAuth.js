const jwt = require("jsonwebtoken");
const CohortRegistration = require("../models/Cohort");
const COHORT_COOKIE_NAME = "BHCtoken";



const cohortAuth = async (req, res, next) => {
  try {
    // ==========================================
    // Get token from HttpOnly cookie
    // ==========================================

    const token = req.cookies?.[COHORT_COOKIE_NAME];

    // console.log("==========================================");
    // console.log("🍪 COHORT COOKIE NAME:", COHORT_COOKIE_NAME);
    // console.log("🍪 ALL COOKIES:", req.cookies);
    // console.log("🔑 COHORT TOKEN:", token);
    // console.log("🔑 TOKEN TYPE:", typeof token);
    // console.log("==========================================");

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Cohort access required. Please register or request access again.",
      });
    }

    // ==========================================
    // Make sure token is actually a string
    // ==========================================

    if (typeof token !== "string") {
      console.error(
        "❌ BHCtoken is not a string:",
        token
      );

      return res.status(401).json({
        success: false,
        message: "Invalid cohort access token.",
      });
    }


    // ==========================================
    // Verify token
    // ==========================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ==========================================
    // Make sure this is a cohort token
    // ==========================================

    if (decoded.purpose !== "cohort_dashboard") {
      return res.status(401).json({
        success: false,
        message: "Invalid cohort access token.",
      });
    }

    // ==========================================
    // Make sure we have the required information
    // ==========================================

    if (
      !decoded.userId ||
      !decoded.registrationId ||
      !decoded.cohort
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid cohort access token.",
      });
    }

    // ==========================================
    // Verify registration belongs to this user
    // ==========================================

    const registration =
      await CohortRegistration.findOne({
        _id: decoded.registrationId,
        user: decoded.userId,
        cohort: decoded.cohort,
      }).lean();

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: "Cohort registration not found.",
      });
    }

    // ==========================================
    // Reject users whose registration is rejected
    // ==========================================

    if (registration.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your cohort registration has been rejected.",
      });
    }

    // ==========================================
    // Attach information to request
    // ==========================================

    req.cohortUser = {
      userId: decoded.userId,
      registrationId: decoded.registrationId,
      cohort: decoded.cohort,
      registration,
    };

    next();
  } catch (error) {
    console.error("Cohort authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your cohort session has expired. Please request a new access link.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired cohort access token.",
    });
  }
};

module.exports = {
  cohortAuth,
  COHORT_COOKIE_NAME,
};