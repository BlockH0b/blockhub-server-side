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
const path = require("path");

/*
 * SECURITY: the profile picture URL comes from the browser, and canvas
 * will happily open ANY path or URL (file:///etc/passwd, our own server,
 * the cloud metadata address...). People were trying exactly that.
 * So we only download https images from known avatar hosts ourselves,
 * with a size + time limit, and hand canvas the bytes.
 */
const AVATAR_HOSTS = [
    "pbs.twimg.com",
    "abs.twimg.com",
    "res.cloudinary.com",
    "lh3.googleusercontent.com",
    "googleusercontent.com",
    "avatars.githubusercontent.com",
    "cdn.discordapp.com",
];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

async function fetchAvatar(value) {
    let url;
    try {
        url = new URL(String(value || ""));
    } catch {
        throw Object.assign(new Error("Invalid profile image"), { status: 400 });
    }
    const host = url.hostname.toLowerCase();
    const allowed = url.protocol === "https:" && AVATAR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    if (!allowed) throw Object.assign(new Error("Profile image must be your X/Google profile photo"), { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url.toString(), { signal: controller.signal, redirect: "error" });
        if (!res.ok) throw new Error("Could not download profile image");
        const type = res.headers.get("content-type") || "";
        if (!/^image\/(png|jpe?g|webp|gif)/i.test(type)) throw new Error("Profile image is not a picture");
        const size = Number(res.headers.get("content-length") || 0);
        if (size > MAX_AVATAR_BYTES) throw new Error("Profile image is too big");
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_AVATAR_BYTES) throw new Error("Profile image is too big");
        return buffer;
    } finally {
        clearTimeout(timer);
    }
}

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
        const { profileImage } = req.body;
        const name = String(req.body?.name || "").trim().slice(0, 40);

        if (!name || !profileImage) {
            return res.status(400).json({ message: "Name and profile image are required" });
        }

        let avatar;
        try {
            avatar = await fetchAvatar(profileImage);
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message || "Could not use that profile image" });
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
        const template = await loadImage(path.join(__dirname, "..", "uploads", "image.png"));
        const userPic = await loadImage(avatar);

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
        console.error("[waitlist] generate-image:", err?.message);
        res.status(500).json({ message: "Could not create your image. Please try again." });
    }
});




module.exports = router;