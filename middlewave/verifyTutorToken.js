const jwt = require("jsonwebtoken");
const Tutor = require("../models/Tutor");

const TUTOR_ACCESS_SECRET =
  require("../config/secrets").tutorAccessSecret();

const verifyTutorToken = async (req, res, next) => {
  try {
    const token = req.cookies?.tutorToken;

    if (!token) {
      return res.status(401).json({
        message: "No tutor token provided"
      });
    }

    const decoded = jwt.verify(
      token,
      TUTOR_ACCESS_SECRET
    );

    req.tutorId = decoded.tutorId;
    req.userId = decoded.userId;

    const tutor = await Tutor.findById(
      decoded.tutorId
    );

    if (!tutor) {
      return res.status(404).json({
        message: "Tutor not found"
      });
    }

    req.tutor = tutor;

    next();
  } catch (err) {
    console.error(err);

    return res.status(401).json({
      message: "Invalid or expired tutor token"
    });
  }
};

module.exports = verifyTutorToken;