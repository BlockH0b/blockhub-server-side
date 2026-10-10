const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Tutor = require("../models/Tutor");
const User = require("../models/user");
const Course = require("../models/Course");
const verifyTutorToken = require("../functions/verifyTutorToken");
const sanitizeTutor = require("../utils/sanitizeTutor");
const sanitizeUser = require("../utils/sanitizeUser");

const TUTOR_ACCESS_SECRET = process.env.TUTOR_ACCESS_SECRET_KEY || "tutoraccesskey";

// Generate tutor code
function generateTutorCode() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `TUT${random}`;
}

router.post("/signup-tutor", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isTutor) {
      return res.status(400).json({ message: "User already a tutor" });
    }

    const tutorCode = generateTutorCode();

    const tutorProfile = await Tutor.create({
      user: user._id,
      tutorCode,
      bio: ""
    });

    user.isTutor = true;
    user.tutorProfile = tutorProfile._id;

    await user.save();

    res.status(200).json({
      message: "Tutor created successfully",
      tutorCode,
      tutorProfile
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login-tutor", async (req, res) => {
  try {
    const { tutorCode } = req.body;

    if (!tutorCode) {
      return res.status(400).json({ message: "Tutor code required" });
    }

    const tutor = await Tutor.findOne({ tutorCode }).populate("user");

    if (!tutor) {
      return res.status(404).json({ message: "Invalid tutor code" });
    }

    // Get all courses created by this tutor
    const allTutorCourses = await Course.find({ tutor: tutor._id });

    const token = jwt.sign(
      {
        tutorId: tutor._id,
        userId: tutor.user._id,
        admin: tutor.user.admin
      },
      TUTOR_ACCESS_SECRET,
      { expiresIn: "30d" }
    );

    // Convert Mongoose doc to plain object
    const tutorObj = tutor.toObject();

    // Remove admin field from user sub-document
    if (tutorObj.user && tutorObj.user.admin !== undefined) {
      delete tutorObj.user.admin;
    }
    res.cookie("tutorToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.status(200).json({
      message: "Login successful",

      tutor: tutorObj, // all fields except admin
      allCourses: allTutorCourses
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/me", verifyTutorToken, async (req, res) => {
  try {

    const tutor = await Tutor.findById(req.tutorId)
      .populate("user");

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found"
      });
    }

    const allCourses = await Course.find({
      tutor: tutor._id
    });

    return res.status(200).json({
      success: true,
      tutor: sanitizeTutor(tutor),
      user: sanitizeUser(tutor.user),
      allCourses,
      isTutor: true
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  }
});
module.exports = router;