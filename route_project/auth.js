require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { TwitterApi } = require('twitter-api-v2');
const Project = require('../models/project');
const twitterOAuth = require('../models/twitterOAuth');
const multer = require('multer');
const path = require('path');
const cloudinary = require("../utils/cloudinary"); // not cloudinary_js_config

// const { uploader } = require('../utils/cloudinary');
// const twitterOAuth = require('../modal/twitterOAuth');

const router = express.Router();
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: multer.memoryStorage() });

const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
});

const redirectUri = process.env.TWITTER_PROJECT_CALLBACK_URL;

// Step 1: Redirect to Twitter login (for projects)
router.get('/project/twitter', async (req, res) => {
    try {
        const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
            redirectUri, { scope: ['tweet.read', 'users.read', 'offline.access', 'follows.read'] }
        );

        // save verifier + state for callback
        await twitterOAuth.create({ state, codeVerifier, role: 'project' });

        console.log('Redirecting Project to Twitter login URL:', url);
        res.redirect(url);
    } catch (err) {
        console.error('Error generating Project Twitter login URL:', err);
        res.redirect(`${process.env.FRONTEND_URL}/error`);
    }
});

// Step 2: Handle Project callback
router.get('/project/twitter/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        const record = await twitterOAuth.findOne({ state, role: 'project' });
        if (!record) return res.redirect(`${process.env.FRONTEND_URL}/login`);

        // Exchange code for access token
        const { client: loggedClient } = await twitterClient.loginWithOAuth2({
            code,
            codeVerifier: record.codeVerifier,
            redirectUri
        });
        // cleanup record
        await twitterOAuth.deleteOne({ state });

        // fetch Twitter user info
        const twitterUser = await loggedClient.v2.me({
            'user.fields': ['id', 'name', 'username', 'profile_image_url', 'verified', 'public_metrics', 'description']
        });

        const twitterHandle = '@' + twitterUser.data.username;
        const twitterName = twitterUser.data.name;
        const twitterImage = twitterUser.data.profile_image_url;
        const projectDesciption = twitterUser.data.description

        // upsert Project
        let project = await Project.findOneAndUpdate({ twitterId: twitterUser.data.id }, {
            projectName: twitterName, // temp
            twitterHandle,
            twitterId: twitterUser.data.id,
            profileImage: twitterImage,
            description: projectDesciption,
        }, { new: true, upsert: true });

        // issue jwt
        const token = jwt.sign({ id: project._id, role: 'project' },
            process.env.JWT_SECRET
        );

        // redirect back
        const baseUrl = process.env.FRONTEND_URL;
        res.redirect(
            `${baseUrl}/grindfi/edit?token=${token}&id=${project._id}&username=${encodeURIComponent(twitterName)}&handle=${twitterHandle}&desc=${projectDesciption}&img=${encodeURIComponent(twitterImage)}`
        );
    } catch (err) {
        console.error('Project Twitter callback error:', err);
        res.redirect(`${process.env.FRONTEND_URL}/error`);
    }
});
// Upload route
router.post("/upload", upload.single("profileImage"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Wrap Cloudinary upload_stream in a Promise
        const streamUpload = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "projects" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(buffer);
            });
        };

        const result = await streamUpload(req.file.buffer);
        res.json({ imageUrl: result.secure_url });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: "Upload failed" });
    }
});

router.post("/signup", async (req, res) => {
    try {
        const { projectName, twitterHandle, description, compensation, profileImage } = req.body;

        if (!projectName || !description) {
            return res.status(400).json({ message: "Project Name and Description are required" });
        }

        // Create project
        const project = new Project({
            projectName,
            twitterHandle,
            description,
            profileImage, // comes directly from frontend after Cloudinary upload
            compensation,
        });

        await project.save();

        // issue jwt
        const token = jwt.sign({ id: project._id, role: "project" }, process.env.JWT_SECRET);

        res.json({
            message: "Project signed up successfully",
            token,
            id: project._id,
            name: project.projectName,
            handle: project.twitterHandle,
            img: project.profileImage,
            compesation: project.compensation
        });
    } catch (err) {
        console.error("Project signup error:", err);
        res.status(500).json({ message: "Something went wrong" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { twitterHandle } = req.body;

        if (!twitterHandle) {
            return res.status(400).json({ message: "Twitter handle is required" });
        }

        // Find project by Twitter handle
        const project = await Project.findOne({ twitterHandle });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Issue JWT token
        const token = jwt.sign(
            { id: project._id, role: "project" },
            process.env.JWT_SECRET,
            { expiresIn: "7d" } // token expires in 7 days
        );

        res.json({
            message: "Project logged in successfully",
            token,
            id: project._id,
            name: project.projectName,
            handle: project.twitterHandle,
            img: project.profileImage,
            compensation: project.compensation,
            description: project.description,
        });
    } catch (err) {
        console.error("Project login error:", err);
        res.status(500).json({ message: "Something went wrong" });
    }
});

module.exports = router;