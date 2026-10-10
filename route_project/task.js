const task = require("../models/task");
const express = require('express');
const ambassador = require('../models/LegacyAmbassador');
const submit = require('../models/submit');
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const projectAmbassador = require("../models/projectAmbassador");
const project = require("../models/project");



router.post('/get_tasks', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Authentication token is required' });
        }

        // ✅ Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.projectId) {
            return res.status(400).json({ message: 'Invalid token: projectId missing' });
        }

        // ✅ Fetch project tasks
        const tasks = await task.find({ projectId: decoded.projectId })
            .sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (err) {
        console.error('Error fetching project tasks:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Add a new task for a project
// Add a new task for a project
router.post('/add_task', async (req, res) => {
    try {
        const {
            projectId,
            title,
            description,
            points,
            is_active,
            created_at,
            important,
            durationInHours,
            hashTag // <-- single hashtag string
        } = req.body;

        if (!projectId || !points) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const now = created_at ? new Date(created_at) : new Date();
        let expires_at = undefined;

        if (durationInHours && !isNaN(durationInHours)) {
            expires_at = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
        }

        // ✅ Set type and hashtag
        let type = "manual";
        let hashtag = null;

        if (hashTag) {
            type = "hashtag";
            hashtag = hashTag.trim().toLowerCase();
        }

        const newTask = new task({
            projectId,
            title,
            description,
            type,
            hashtags: hashtag, // now string
            points,
            is_active: typeof is_active === "boolean" ? is_active : true,
            createdAt: now,
            expires_at,
            important: important || false,
            durationInHours: durationInHours || null,
        });

        await newTask.save();

        // ✅ Push hashtag into project (if not already there)
        if (hashtag) {
            await project.findByIdAndUpdate(projectId, {
                $addToSet: { hashtags: hashtag }
            });
        }
        console.log(newTask);


        res.json({ message: 'Task created successfully', task: newTask });
    } catch (err) {
        console.error('Error adding task:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



// Delete a task for a specific project
router.delete('/delete_task/:projectId/:taskId', async (req, res) => {
    try {
        const { projectId, taskId } = req.params;

        console.log('Deleting taskId:', taskId, 'from projectId:', projectId);


        // Find the task under the specific project
        const deleted = await task.findOneAndDelete({
            _id: taskId,
            projectId: projectId
        });
        if (!deleted) {
            return res.status(404).json({ message: 'Task not found for this project' });
        }

        res.json({ message: 'Task deleted successfully', deletedTask: deleted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Edit a task for a specific project
router.put('/edit_task', async (req, res) => {
    try {
        const { updatedData, taskId, token } = req.body;



        if (!taskId || !updatedData || !token) {
            return res.status(400).json({ message: 'Please provide taskId, projectId and updatedData' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id;

        // Update only if the task belongs to this project
        const updatedTask = await task.findOneAndUpdate({ _id: taskId, projectId: projectId },
            updatedData, { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found for this project' });
        }

        res.json({ message: 'Task updated successfully', task: updatedTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Get all pending task submissions (for admin review)
 */router.get('/pending_tasks', async (req, res) => {
    try {
        const pendingSubmissions = await submit.find({ status: 'pending' })
            .populate({
                path: 'ambassadorId',
                model: 'ambassador',
                select: 'name username twitter_handle img'
            })
            .populate({
                path: 'taskId',
                model: 'tasks',
                select: 'title description points'
            })
            // ✅ Include only the fields you want to show in the frontend
            .select('proof proofImages hashtag submitted_at status')
            .limit(100) // ✅ Only return the latest 100
            .sort({ submitted_at: -1 }); // optional: newest first
        if (pendingSubmissions.length === 0) {
            return res.status(200).json({
                message: 'No pending submissions found',
                data: []
            });
        }

        res.status(200).json({
            message: 'Pending submissions retrieved',
            length: pendingSubmissions.length,
            data: pendingSubmissions
        });
    } catch (err) {
        console.error('❌ Fetch pending tasks error:', err);
        res.status(500).json({ message: 'Failed to fetch pending submissions' });
    }
});



/**
 * Approve a task submission
 */
// Approve a task submission

router.post('/approve', async (req, res) => {
    try {
        const { submissionId } = req.body;
        if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ message: 'Invalid submission ID' });
        }

        const submission = await submit.findByIdAndUpdate(
            submissionId,
            { status: 'approved' },
            { new: true }
        );

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const Itask = await task.findById(submission.taskId);
        if (!Itask) return res.status(404).json({ message: 'Task not found' });

        const points = Itask.points || 0;

        // 1️⃣ Update global ambassador stats
        await ambassador.findByIdAndUpdate(submission.ambassadorId, {
            $inc: { totalGlobalPoints: points, totalGlobalTasks: 1 },
        });

        // 2️⃣ Update project-specific stats
        const updatedProjectAmbassador = await projectAmbassador.findOneAndUpdate(
            { ambassadorId: submission.ambassadorId, projectId: submission.projectId },
            { $inc: { totalPoints: points, totalTasks: 1, points: points } },
            { upsert: true, new: true } // create if not exists
        );

        res.json({
            message: 'Task approved & stats updated',
            submission,
            updatedProjectAmbassador,
        });

    } catch (err) {
        console.error('Error approving task:', err);
        res.status(500).json({ message: 'Error approving task' });
    }
});

/**
 * Decline a task submission
 */

router.post('/decline', async (req, res) => {
    try {
        const { submissionId } = req.body;

        if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ message: 'Invalid submission ID' });
        }

        const submission = await submit.findByIdAndUpdate(
            submissionId, { status: 'rejected' }, { new: true }
        );

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        res.json({ message: 'Task rejected', submission });
    } catch (err) {
        console.error('❌ Reject task error:', err);
        res.status(500).json({ message: 'Error rejecting task' });
    }
});

router.post('/get-all-tasks', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id;

        if (!projectId) {
            return res.status(400).json({ message: 'Project ID missing in token' });
        }

        const tasks = await task.find({ projectId: new mongoose.Types.ObjectId(projectId) });

        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error fetching project tasks:', error);
        res.status(500).json({ message: 'Failed to fetch project tasks' });
    }
});


router.post('/project-task-submissions-overview', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Authentication token is required' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id;

        const submissions = await submit.aggregate([
            { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
            {
                $group: {
                    _id: "$projectId",
                    totalSubmissions: { $sum: 1 },
                    approvedSubmissions: {
                        $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
                    },
                    pendingSubmissions: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    }
                }
            }
        ]);
        res.status(200).json(submissions[0] || {
            totalSubmissions: 0,
            approvedSubmissions: 0,
            pendingSubmissions: 0
        });
    } catch (error) {
        console.error('Error fetching project submission overview:', error);
        res.status(500).json({ message: 'Server error retrieving submission overview' });
    }
});

router.post('/task-overview', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {
        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const projectId = decoded.id;

        if (!projectId) {
            return res.status(400).json({ message: 'Project ID is required' });
        }

        // Group counts by the specific projectId
        const overview = await task.aggregate([
            { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
            {
                $group: {
                    _id: "$projectId",
                    totalTasks: { $sum: 1 },
                    activeTasks: { $sum: { $cond: ["$is_active", 1, 0] } }
                }
            }
        ]);

        // Get pending submissions count for the same project
        const pendingSubmissions = await submit.aggregate([{
            $match: {
                projectId: new mongoose.Types.ObjectId(projectId),
                status: "pending"
            }
        },
        {
            $group: {
                _id: "$projectId",
                pendingTasks: { $sum: 1 }
            }
        }
        ]);

        let response = {};
        if (overview.length > 0) {
            const project = overview[0];
            const pending = pendingSubmissions[0];
            response = {
                projectId: project._id,
                totalTasks: project.totalTasks,
                activeTasks: project.activeTasks,
                pendingTasks: pending ? pending.pendingTasks : 0
            };
        } else {
            response = {
                projectId,
                totalTasks: 0,
                activeTasks: 0,
                pendingTasks: 0
            };
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching task overview:', error);
        res.status(500).json({ message: 'Server error retrieving task overview' });
    }
});

// Get submitted tasks for a specific project
/**
 * Get all submitted (non-rejected) tasks for a specific project
 */
router.post('/project-submitted-tasks', async (req, res) => {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ message: 'Project ID is required' });
        }

        const submittedTasks = await submit.find({ projectId, status: { $ne: 'rejected' } }) // exclude rejected
            .populate({
                path: 'ambassadorId',
                select: 'name img twitter_handle username'
            })
            .populate({
                path: 'taskId',
                select: 'title description points'
            })
            .select('proof proofImages hashtag status submitted_at projectId')
            .sort({ submitted_at: -1 }) // newest first
            .limit(100); // ✅ only latest 100

        if (submittedTasks.length === 0) {
            return res.status(200).json({
                message: 'No submitted tasks found for this project',
                data: []
            });
        }

        // Format clean response
        const formatted = submittedTasks.map(item => ({
            id: item._id,
            name: item.ambassadorId?.name,
            img: item.ambassadorId?.img,
            username: item.ambassadorId?.username,
            twitter_handle: item.ambassadorId?.twitter_handle,
            taskTitle: item.taskId?.title,
            taskDescription: item.taskId?.description,
            taskPoints: item.taskId?.points,
            status: item.status,
            proof: item.proof,
            proofImages: item.proofImages || [],
            hashtag: item.hashtag,
            submitted_at: item.submitted_at,
            projectId: item.projectId
        }));

        res.status(200).json({
            message: 'Submitted tasks retrieved successfully',
            length: formatted.length,
            data: formatted
        });

    } catch (err) {
        console.error('❌ Failed to fetch project submitted tasks:', err);
        res.status(500).json({ message: 'Server error fetching project submitted tasks' });
    }
});




module.exports = router