const express = require('express');
const router = express.Router();
const Ambassador = require('../models/LegacyAmbassador');

const Submission = require('../models/submit');
const Task = require('../models/task');
const Payment = require('../models/payment');
const { sendWhatsappInvite, sendPortfolioEmail } = require('../utils/nodemailer');
const task = require('../models/task');
const jwt = require("jsonwebtoken");


// GET all ambassadors
router.post('/all', async(req, res) => {

    const { token } = req.body
    if (!token) {
        return res.status(400).json({ message: 'Send in an authentication token' });
    }
    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.id;
        const ambassadors = await Ambassador.find({});
        res.status(200).json(ambassadors);
    } catch (err) {
        console.error('Error fetching ambassadors:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});



router.post('/remove-duplicate-submissions', async(req, res) => {
    try {
        // Step 1: Group by proof and find duplicates
        const duplicates = await Submission.aggregate([{
                $group: {
                    _id: "$proof",
                    count: { $sum: 1 },
                    submissions: { $push: "$$ROOT" }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        let totalDuplicatesRemoved = 0;
        let totalPointsAdjusted = 0;

        for (const group of duplicates) {
            // Sort to keep the earliest one
            const sortedSubs = group.submissions.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
            const [keep, ...toDelete] = sortedSubs;

            for (const sub of toDelete) {
                const task = await Task.findById(sub.taskId);
                const ambassador = await Ambassador.findById(sub.ambassadorId);

                if (task && ambassador) {
                    // Subtract points
                    ambassador.points = Math.max(0, (ambassador.points || 0) - task.points);
                    ambassador.total_points = Math.max(0, (ambassador.total_points || 0) - task.points);
                    await ambassador.save();

                    // Delete submission
                    await Submission.findByIdAndDelete(sub._id);

                    totalDuplicatesRemoved++;
                    totalPointsAdjusted += task.points;
                }
            }
        }

        res.json({
            message: 'Duplicate submissions cleaned',
            totalDuplicatesRemoved,
            totalPointsAdjusted
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error while cleaning duplicates' });
    }
});


router.get('/task-points-from-date', async(req, res) => {
    try {
        const startDate = new Date('2025-08-05T00:00:00Z'); // Replace or make dynamic if needed

        const tasks = await Task.find({
            createdAt: { $gte: startDate }
        });

        const totalPoints = tasks.reduce((sum, task) => sum + (task.points || 0), 0);

        res.status(200).json({ totalPoints });
    } catch (err) {
        console.error("Error calculating points:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/task-stats', async(req, res) => {
    try {
        const periodAStart = new Date('2025-08-05T00:00:00Z');
        const periodAEnd = new Date('2025-08-05T00:00:00Z');
        const periodBStart = periodAEnd;
        const now = new Date();

        // Helper function to compute stats for a period
        const computeStats = async(startDate, endDate) => {
            const tasks = await Task.find({
                createdAt: {
                    $gte: startDate,
                    $lt: endDate,
                }
            });

            const totalPoints = tasks.reduce((sum, task) => sum + (task.points || 0), 0);
            const totalRetweets = tasks.reduce((sum, task) => sum + (task.retweets || 0), 0);
            const totalTasks = tasks.length;

            return { totalPoints, totalRetweets, totalTasks };
        };

        const periodAStats = await computeStats(periodAStart, periodAEnd);
        const periodBStats = await computeStats(periodBStart, now);

        return res.status(200).json({
            periodA: {
                from: periodAStart,
                to: periodAEnd,
                ...periodAStats
            },
            periodB: {
                from: periodBStart,
                to: now,
                ...periodBStats
            }
        });

    } catch (err) {
        console.error("Error fetching task stats:", err);
        return res.status(500).json({ message: "Server error" });
    }
});

router.post('/reset-current-points', async(req, res) => {
    try {
        const result = await Ambassador.updateMany({}, { $set: { points: 0 } });

        res.status(200).json({
            message: 'All ambassador current points have been reset to 0',
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        console.error("Error resetting current points:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.delete('/remove-duplicate-submissions', async(req, res) => {
    try {
        const allSubmissions = await Submission.find({});

        // Group by 'user_id' + 'task_id'
        const grouped = {};
        for (const submission of allSubmissions) {
            const key = `${submission.user_id}_${submission.task_id}`;

            if (!grouped[key]) {
                grouped[key] = [submission];
            } else {
                grouped[key].push(submission);
            }
        }

        let deletedCount = 0;

        for (const key in grouped) {
            const submissions = grouped[key];

            if (submissions.length > 1) {
                // Sort by createdAt or _id (Mongo ObjectId contains timestamp)
                submissions.sort((a, b) => a.createdAt - b.createdAt);

                // Keep the first one, delete the rest
                const duplicatesToDelete = submissions.slice(1);

                for (const dup of duplicatesToDelete) {
                    await Submission.findByIdAndDelete(dup._id);
                    deletedCount++;
                }
            }
        }

        res.status(200).json({
            message: `✅ Duplicate submissions cleaned.`,
            duplicates_removed: deletedCount
        });
    } catch (error) {
        console.error('Error removing duplicates:', error);
        res.status(500).json({ error: 'Server error while removing duplicates.' });
    }
});



router.post('/send-whatsapp-invite', async(req, res) => {
    const whatsappGroupLink = 'https://chat.whatsapp.com/DZGDVVInnjc1M1nQsfgh7y'
    try {
        // Get all paid users
        const paidUsers = await Payment.find({ product_price: { $gt: 0 }, status: true });

        if (!paidUsers.length) {
            return res.status(404).json({ message: 'No paid users found.' });
        }

        for (const user of paidUsers) {
            // Send the WhatsApp invite email
            console.log(`Sending to: ${user.email}, ${user.name}`);
            await sendWhatsappInvite(user.email, user.name, whatsappGroupLink);
        }

        return res.status(200).json({ message: 'Invites sent to all paid users.' });

    } catch (err) {
        console.error('Error sending emails:', err);
        return res.status(500).json({ message: 'Server error. Could not send emails.' });
    }
});


router.post('/send-portfolio', async(req, res) => {
    try {
        const portfolioLink = 'https://www.canva.com/design/DAGvzVXCH0c/1npxvtCaOkCP-5t8Zv9KTQ/edit?utm_content=DAGvzVXCH0c&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton';

        // const paidUsers = await Payment.find({ product_price: { $gt: 0 }, status: true });
        const paidUsers = [{
                email: 'pk5082119@gmail.com',
                name: 'dear'
            },
        {
                email: 'uidiajoshua@gmail.com',
                name: 'dear'
            },

        ]

        if (!paidUsers.length) {
            return res.status(404).json({ message: 'No paid users found.' });
        }

        // Make sure the PDF is inside your project folder or somewhere accessible
        const portfolioPdfPath = 'C:/Users/HP/Downloads/WINNING_POSITIONING_PROFILE_BlockHub.pdf';
        // Adjust the relative path based on your folder structure

        for (const user of paidUsers) {
            console.log(`Sending to: ${user.email}, ${user.name}`);
            await sendPortfolioEmail(user.email, user.name, portfolioLink, portfolioPdfPath);
        }

        return res.status(200).json({ message: 'Invites sent to all paid users.' });
    } catch (err) {
        console.error('Error sending emails:', err);
        return res.status(500).json({ message: 'Server error. Could not send emails.' });
    }
});




module.exports = router;