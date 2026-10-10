const express = require("express");
const router = express.Router();
const AcademyStudent = require("../models/form");
const { sendAcademyThankYou } = require("../utils/nodemailer");

// POST form submission
router.post("/academy/register", async (req, res) => {
    try {
        // Validate required fields
        const { fullName, email } = req.body;
        if (!fullName || !email) {
            return res.status(400).json({ message: "Full Name and Email are required" });
        }

        // Save all form data
        const newStudent = new AcademyStudent(req.body);
        await newStudent.save();
        await sendAcademyThankYou(newStudent.email, newStudent.fullName)


        res.status(201).json({
            message: "Form submitted successfully ✅",
            student: newStudent,
        });
    } catch (error) {
        console.error("Error saving student:", error.message);
        res.status(500).json({
            message: "Error submitting form ❌",
            error: error.message,
        });
    }
});

module.exports = router;
