const express = require('express');
const router = express.Router();
const Waitlist = require('../models/waitlist');
const { sendAcademyThankYou } = require('../utils/nodemailer');
const notify = require('../services/email/notify');
// "canvas" is loaded lazily inside /generate-image so a missing native build
// (common on new Node versions) can't stop the whole server from starting.
const fs = require("fs");
const cloudinary = require('../utils/cloudinary');


const SERVER_URL = process.env.SERVER_URL || "http://localhost:8080";

router.post('/waitlist', async (req, res) => {
    console.log("📥 Incoming request to /waitlist");
    console.log("🧾 Request body:", req.body);

    const { email } = req.body;

    if (!email) {
        console.log("❌ Email missing in request");
        return res.status(400).json({ message: 'Email is required' });
    }

    console.log("✅ Email received:", email);

    try {
        console.log("🔍 Checking if email already exists...");

        const existing = await Waitlist.findOne({ email });

        if (existing) {
            console.log("⚠️ Email already exists in DB:", email);
            return res.status(400).json({ message: 'Email already on the waitlist' });
        }

        console.log("🆕 Creating new waitlist entry...");

        const newEntry = new Waitlist({
            email,
        });

        console.log("💾 Saving to database...");

        await newEntry.save();

        console.log("✅ Successfully saved:", newEntry);

        notify.waitlistJoined(email);

        console.log("🚀 Request completed successfully");

        res.status(201).json({ message: 'Added to waitlist and email sent successfully' });

    } catch (err) {
        console.error("🔥 Error occurred:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/waitlist-count', async (req, res) => {
    try {
        const count = await Waitlist.countDocuments();
        res.status(200).json({
            message: "Total waitlist count fetched successfully",
            totalWaitlist: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error fetching waitlist count" });
    }
});

// endpoint to generate the image
router.post("/generate-image", async (req, res) => {
    try {
        const { createCanvas, loadImage } = require("canvas");
        const { name, profileImage } = req.body;

        if (!name || !profileImage) {
            return res.status(400).json({ message: "Name and profile image are required" });
        }

        const width = 1200;
        const height = 630;
        const scale = 2;

        const canvas = createCanvas(width * scale, height * scale);
        const ctx = canvas.getContext("2d");

        const circleX = ((width / 2) - 20) * scale;
        const circleY = (height / 2) * scale;
        const radius = 160 * scale;

        // Load images
        const template = await loadImage("uploads/image.png");
        const userPic = await loadImage(profileImage);

        // Draw template
        ctx.drawImage(template, 0, 0, width * scale, height * scale);

        // Clip + draw user image
        ctx.save();
        ctx.beginPath();
        ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(userPic, circleX - radius, circleY - radius, radius * 2, radius * 2);
        ctx.restore();

        // Write text
        ctx.fillStyle = "#00FF66";
        ctx.font = `bold ${48 * scale}px Sans`;
        ctx.textAlign = "center";
        ctx.fillText(name, circleX, circleY + radius + 60 * scale);

        // Convert canvas → buffer
        const buffer = canvas.toBuffer("image/png");

        // Upload buffer to Cloudinary using Promise wrapper
        const uploadToCloudinary = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "share-cards" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(buffer);
            });
        };

        const result = await uploadToCloudinary(buffer);

        // Return Cloudinary URL
        res.json({ imageUrl: result.secure_url });

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});




module.exports = router;