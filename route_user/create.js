const express = require('express');
const jwt = require('jsonwebtoken');
const Job = require('../models/job');
const notification = require('../models/notification');
const { getIO } = require('../confiq/socket');

const router = express.Router();
require('dotenv').config();




router.post('/post_job', async(req, res) => {
    const { token, jobTitle, jobType, candidateRole, benefit, companyDescription,compensation, skills, experienceLevel, web3Area, tags, telegramLink, applicationStart, applicationEnd, status } = req.body;

    console.log(token);

    const requiredFields = { jobTitle, jobType, candidateRole, companyDescription, skills, experienceLevel, web3Area, telegramLink, applicationStart, applicationEnd, status };
    const missingFields = Object.entries(requiredFields).filter(([_, value]) => !value).map(([key]) => key);

    if (missingFields.length > 0) return res.status(400).json({ success: false, message: `Missing required fields: ${missingFields.join(', ')}` });


    if (!token) return res.status(401).json({ error: 'Token missing' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const newJob = new Job({
            jobTitle,
            jobType,
            candidateRole,
            benefit,
            companyDescription,
            skills,
            experienceLevel,
            compensation,
            web3Area,
            tags,
            telegramLink,
            applicationStart,
            applicationEnd,
            status: status || 'open',
            postedBy: userId
        });

        await newJob.save();

        const newNotification = new notification({
            user: userId,
            type: 'job_post',
            content: `Your job (${jobTitle}) has been posted successfully`,
            // link: `/job/${jobId}`,
        });
        await newNotification.save();

        // Optionally send real-time notification
        const io = getIO();
        io.to(userId.toString()).emit('notification', {
            id: newNotification._id,
            type: 'job_post',
            message: newNotification.content,
            jobTitle,
            // avatar: userAvatar,
            time: 'Just now',
        });

        res.status(201).json({ message: 'Job created successfully', job: newJob });

    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'An error occured please try again' });
    }
});

module.exports = router;