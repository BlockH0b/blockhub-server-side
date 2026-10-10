const express = require('express');
const ambassador = require('../models/LegacyAmbassador');
const task = require('../models/task');
const submit = require('../models/submit');
const route = express.Router();
const jwt = require("jsonwebtoken");




route.post('/get-overview', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;

        const totalAmbassadors = await ambassador.countDocuments();
        const totalTasks = await task.countDocuments();

        res.status(200).json({
            totalAmbassadors,
            totalTasks,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong' });
    }
});
route.post('/submitted-tasks', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {
        const submittedTasks = await submit.find({
            status: { $in: ['pending', 'approved'] }
        })
            .populate({
                path: 'ambassadorId',
                select: 'name img twitter_handle',
            })
            .populate({
                path: 'taskId',
                select: 'title points',
            });

        const validTasks = submittedTasks.filter(item =>
            item.ambassadorId && item.ambassadorId.name &&
            item.taskId && item.taskId.title
        );

        const formatted = validTasks.map(item => ({
            ambassadorName: item.ambassadorId.name,
            ambassadorImage: item.ambassadorId.img,
            ambassadorTwitter: item.ambassadorId.twitter_handle,
            taskTitle: item.taskId.title,
            taskPoints: item.taskId.points,
            status: item.status,
            submittedAt: item.submitted_at,
        }));



        res.status(200).json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch submitted tasks' });
    }
});


//get all ambassador 
route.post('/top-ambassador', async (req, res) => {

    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminid = decoded.id;

        const ambassadors = await ambassador.find().sort({ total_points: -1 });
        res.json(ambassadors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = route