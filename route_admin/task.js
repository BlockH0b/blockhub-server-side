const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const submit = require('../models/submit');
const { default: mongoose } = require('mongoose');
const ambassador = require('../models/LegacyAmbassador');
// was used below but never imported -> approving a task crashed after
// points were already added (so retries double-counted points)
const ProjectAmbassador = require('../models/projectAmbassador');
const task = require('../models/task');
const jwt = require("jsonwebtoken");

// Get all tasks
router.get('/get_tasks', async(req, res) => {
    try {
        const tasks = await Task.find().sort({ created_at: -1 });
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a new task
router.post('/add_task', async(req, res) => {
    try {
        const {
            token,
            title,
            description,
            points,
            is_active,
            created_at,
            important,
            durationInHours
        } = req.body;


        if (!token) {
            return res.status(400).json({ message: 'Send in an authentication token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const productId = decoded.id;

        if (!title || !description || !points) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const now = created_at ? new Date(created_at) : new Date();
        let expires_at = undefined;

        if (durationInHours && !isNaN(durationInHours)) {
            // Convert hours to milliseconds and calculate expiration
            expires_at = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
        }

        const newTask = new Task({
            productId,
            title,
            description,
            points,
            is_active: (typeof is_active === "boolean" ? is_active : true),
            created_at: now,
            expires_at,
            important: important || false,
            durationInHours: durationInHours || null // Optional: save it for reference
        });

        await newTask.save();
        res.json({ message: 'Task created successfully', task: newTask });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Delete a task
router.delete('/delete_task/:id', async(req, res) => {
    try {
        const taskId = req.params.id;
        const deleted = await Task.findByIdAndDelete(taskId);

        if (!deleted) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Edit a task
router.put('/edit_task', async(req, res) => {
    try {
        const { updatedData, taskId, token } = req.body;

        // if(!taskId || !updatedData || !token){
        //   res.status(400).json('Please fill in all correct details')
        // }

        const updatedTask = await Task.findByIdAndUpdate(taskId, updatedData, {
            new: true,
        });

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ message: 'Task updated successfully', task: updatedTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all pending task submissions (for admin review)
router.get('/pending_tasks', async(req, res) => {
    try {
        const pendingSubmissions = await submit.find({ status: 'pending' })
            .populate({ path: 'ambassadorId', model: 'ambassador', select: 'name username twitter_handle img' })
            .populate({ path: 'taskId', model: 'tasks', select: 'title description points' })

        if (pendingSubmissions.length === 0) {
            return res.status(200).json({ message: 'No pending submissions found', data: [] });
        }

        res.status(200).json({ message: 'Pending submissions retrieved', length: pendingSubmissions.length, data: pendingSubmissions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch pending submissions' });
    }
});

// Approve a task submission// Approve a task submission
router.post('/approve', async (req, res) => {
    try {
        const { submissionId } = req.body;

        if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ message: 'Invalid submission ID' });
        }

        // Update submission status
        const submission = await submit.findByIdAndUpdate(
            submissionId,
            { status: 'approved' },
            { new: true }
        );

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        // Find the task related to the submission
        const task = await Task.findById(submission.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        console.log("✅ Approving submission:", submissionId);
        console.log("➡️ Ambassador:", submission.ambassadorId.toString());
        console.log("➡️ Project:", task.projectId.toString());
        console.log("➡️ Task points:", task.points);

        // Update Ambassador global stats
        await ambassador.findByIdAndUpdate(submission.ambassadorId, {
            $inc: {
                total_points: task.points || 0,
                total_tweets: 1,
                points: task.points || 0
            },
            $push: { tweets: submission.proof },
        });

        // 🔥 Update project-specific stats
        const updatedProjectAmbassador = await ProjectAmbassador.findOneAndUpdate(
            { ambassadorId: submission.ambassadorId, projectId: task.projectId },
            {
                $inc: {
                    totalPoints: task.points || 0,
                    totalTasks: 1
                }
            },
            { upsert: true, new: true }
        );

        console.log("📊 Updated ProjectAmbassador:", updatedProjectAmbassador);

        res.json({ message: 'Task approved & stats updated', submission, updatedProjectAmbassador });

    } catch (err) {
        console.error("❌ Error approving task:", err);
        res.status(500).json({ message: 'Error approving task' });
    }
});

router.post('/decline', async(req, res) => {
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
        console.error(err);
        res.status(500).json({ message: 'Error rejecting task' });
    }
});


router.post('/task-overview', async(req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;
        const totalTasks = await task.countDocuments({});
        const activeTasks = await task.countDocuments({ is_active: true });
        const pendingTasks = await submit.countDocuments({ status: 'pending' });

        res.status(200).json({
            totalTasks,
            activeTasks,
            pendingTasks,
        });
    } catch (error) {
        console.error('Error fetching task overview:', error);
        res.status(500).json({ message: 'Server error retrieving task overview' });
    }
});

router.post('/task-submissions-overview', async(req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Authentication token is required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;

        const totalSubmissions = await submit.countDocuments({});
        const approvedSubmissions = await submit.countDocuments({ status: 'approved' });
        const pendingSubmissions = await submit.countDocuments({ status: 'pending' });

        res.status(200).json({
            totalSubmissions,
            approvedSubmissions,
            pendingSubmissions,
        });
    } catch (error) {
        console.error('Error fetching submission overview:', error);
        res.status(500).json({ message: 'Server error retrieving submission overview' });
    }
});


router.post('/get-all-tasks', async(req, res) => {

    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;

        const tasks = await task.find({}, 'title important description points is_active');

        const formattedTasks = tasks.map(task => ({
            id: task._id,
            title: task.title,
            description: task.description,
            points: task.points,
            is_active: task.is_active,
            important: task.important

        }));

        res.status(200).json(formattedTasks);
    } catch (error) {
        console.error('Error fetching submitted tasks:', error);
        res.status(500).json({ message: 'Failed to fetch submitted tasks' });
    }
});

router.delete('/delete-task', async(req, res) => {
    const { id, token } = req.body;

    if (!id || !token) {
        res.status(400).json('Please fill all field')
    }

    try {
        const deletedTask = await Task.findByIdAndDelete(id);

        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task' });
    }
});

router.post('/submitted-tasks', async(req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const submittedTasks = await submit.find()
            .populate({ path: 'ambassadorId', select: 'name img' })
            .populate('taskId', 'description points')
            .sort({ createdAt: -1 });

        const formatted = submittedTasks
            .filter(item => item.ambassadorId.name && item.ambassadorId.img)
            .map(item => ({
                id: item._id,
                name: item.ambassadorId.name,
                img: item.ambassadorId.img,
                taskDescription: item.taskId.description || "No description",
                taskPoints: item.taskId.points || 0,
                status: item.status,
                proof: item.proof
            }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Failed to fetch submitted tasks:', err);
        res.status(500).json({ message: 'Server error fetching submitted tasks' });
    }
});



module.exports = router;