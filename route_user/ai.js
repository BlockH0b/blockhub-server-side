const express = require("express");
const router = express.Router();

const axios = require("axios");

const auth = require("../middlewave/auth");

const Project = require("../models/project");
const User = require("../models/user");
const Campaign = require("../models/Campaign");

const uploadBuffer = require("../utils/uploadToCloudinary");

router.post("/generate-banner", auth, async (req, res) => {

    try {

        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Prompt is required.",
            });
        }

        //----------------------------------
        // Generate Image
        //----------------------------------

        const imageUrl =
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1792&height=1024&model=flux&enhance=true&nologo=true`;

        //----------------------------------
        // Download Image
        //----------------------------------

        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
        });

        const buffer = Buffer.from(response.data);

        //----------------------------------
        // Upload to Cloudinary
        //----------------------------------

        const uploaded = await uploadBuffer(
            buffer,
            "campaign-banners",
            "image"
        );

        //----------------------------------
        // Response
        //----------------------------------

        return res.json({
            success: true,
            image: uploaded.secure_url,
            publicId: uploaded.public_id,
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Image generation failed.",
        });

    }

});

module.exports = router;