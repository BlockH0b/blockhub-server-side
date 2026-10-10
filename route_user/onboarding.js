const mongoose = require('mongoose')
const express = require('express')
const route = express.Router()
const jwt = require("jsonwebtoken");
const user = require('../models/user');
const uploader = require('../utils/multer')
const cloudinary = require('../utils/cloudinary');


route.post('/add-interesr', async(req, res) => {
    const { token, interests } = req.body

    if (!token || !interests || !Array.isArray(interests)) {
        return res.status(400).json({ message: 'Token and interests array are required' });
    }


    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Update interest (replace old ones)
        await user.findByIdAndUpdate(userId, {
            interest: interests
        });

        return res.status(200).json({ message: 'Interest updated successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
})


route.post('/upload_portfolio', uploader.single('file'), async(req, res) => {
    const { token } = req.body;

    // console.log(process.env.CLOUD_NAME, process.env.API_KEY, process.env.API_SECRET);

    try {
        if (!token) return res.status(401).json({ message: 'Token required' });

        // Verify token and get user ID
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id; // depends on how you set it when signing the token

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        // Upload file to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'auto',
            folder: 'portfolios',
            quality: 'auto',
            fetch_format: 'auto',
        });

        // Update user document
        await user.findByIdAndUpdate(userId, {
            portfolioUrl: result.secure_url,
            portfolioPublicId: result.public_id,
            portfolio: true,

        });

        res.json({
            message: 'Portfolio uploaded successfully',
            url: result.secure_url
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
});


module.exports = route