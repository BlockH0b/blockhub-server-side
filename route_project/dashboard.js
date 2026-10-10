const express = require('express');
const ambassador = require('../models/LegacyAmbassador');
const task = require('../models/task');
const submit = require('../models/submit');
const route = express.Router();
const jwt = require("jsonwebtoken");
const project = require('../models/project');
const projectAmbassador = require('../models/projectAmbassador');




route.post('/get-overview', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {
        // decode projectId from the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id; // 👈 this is the project._id you signed into the token

        const Iproject = await project.findById(projectId);

        if (!Iproject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // count ambassadors joined for this project
        const totalAmbassadors = await projectAmbassador.countDocuments({ projectId });

        // count tasks created for this project
        const totalTasks = await task.countDocuments({ projectId });

        res.status(200).json({
            projectName: Iproject.projectName,
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
        // ✅ Decode token to get projectId
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id; // assuming token was signed with { id: project._id }

        // Fetch submissions from this project
        const submittedTasks = await submit.find({
            status: { $in: ['pending', 'approved'] }
        })
            .populate({
                path: 'ambassadorId',
                select: 'name img twitter_handle',
            })
            .populate({
                path: 'taskId',
                match: { projectId }, // only tasks that belong to this project
                select: 'title points projectId',
            });

        // Filter out submissions where task didn’t match the project
        const validTasks = submittedTasks.filter(item =>
            item.ambassadorId &&
            item.taskId && item.taskId.projectId?.toString() === projectId
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
route.post('/top-ambassadors', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }


    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id;

        // fetch ambassadors for this project, sorted by totalPoints
        const topAmbassadors = await projectAmbassador.find({ projectId })
            .sort({ totalPoints: -1, points: -1 })
            .limit(10) // optional: top 10
            .populate({
                path: 'ambassadorId',
                select: 'name img  twitter_handle',
            });

        const formatted = topAmbassadors.map(item => ({
            ambassadorId: item.ambassadorId._id,
            ambassadorName: item.ambassadorId.name,
            ambassadorImage: item.ambassadorId.img,
            ambassadorTwitter: item.ambassadorId.twitter_handle,
            totalPoints: item.totalPoints,
            totalTasks: item.totalTasks,
            points: item.points,
            joinedAt: item.joinedAt
        }));

        res.status(200).json(formatted);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = route