const jwt = require("jsonwebtoken");
const User = require("../models/user");
const CohortTutor = require("../models/CohortTutor");

const requireCohortTutor = async (req, res, next) => {
  try {
    /*
     * ------------------------------------------------------
     * 1. GET TOKEN FROM COOKIE
     * ------------------------------------------------------
     */

    const token =
      req.cookies?.token ||
      req.cookies?.accessToken ||
      req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    /*
     * ------------------------------------------------------
     * 2. VERIFY TOKEN
     * ------------------------------------------------------
     */

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session.",
      });
    }

    /*
     * ------------------------------------------------------
     * 3. GET USER ID
     * ------------------------------------------------------
     *
     * Adjust these depending on what your JWT contains.
     */

    const userId =
      decoded.id ||
      decoded.userId ||
      decoded._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    /*
     * ------------------------------------------------------
     * 4. FIND USER
     * ------------------------------------------------------
     */

    const user = await User.findById(userId)
      .select(
        "_id fullName email profileImage isTutor tutorProfile isCohortTutor cohortTutorProfile"
      )
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    /*
     * ------------------------------------------------------
     * 5. CHECK COHORT TUTOR FLAG
     * ------------------------------------------------------
     */

    if (!user.isCohortTutor) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You are not a cohort tutor.",
      });
    }

    /*
     * ------------------------------------------------------
     * 6. FIND COHORT TUTOR PROFILE
     * ------------------------------------------------------
     */

    let cohortTutor = null;

    if (user.cohortTutorProfile) {
      cohortTutor = await CohortTutor.findById(
        user.cohortTutorProfile
      ).lean();
    }

    /*
     * Fallback in case the User profile reference
     * is missing but the CohortTutor document exists.
     */

    if (!cohortTutor) {
      cohortTutor = await CohortTutor.findOne({
        user: user._id,
      }).lean();
    }

    if (!cohortTutor) {
      return res.status(403).json({
        success: false,
        message:
          "Cohort tutor profile not found.",
      });
    }

    /*
     * ------------------------------------------------------
     * 7. CHECK TUTOR STATUS
     * ------------------------------------------------------
     */

    if (cohortTutor.status !== "active") {
      return res.status(403).json({
        success: false,
        message:
          "Your cohort tutor account is not active.",
      });
    }

    /*
     * ------------------------------------------------------
     * 8. ATTACH EVERYTHING TO REQUEST
     * ------------------------------------------------------
     */

    req.user = user;

    req.cohortTutor = cohortTutor;

    req.cohortTutorUserId = user._id;

    req.cohort = cohortTutor.cohort;

    req.track = cohortTutor.track;

    /*
     * ------------------------------------------------------
     * 9. CONTINUE
     * ------------------------------------------------------
     */

    next();
  } catch (error) {
    console.error(
      "requireCohortTutor error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify cohort tutor access.",
    });
  }
};

module.exports = requireCohortTutor;