const express = require('express')
const jwt = require('jsonwebtoken');
const notification = require('../models/notification');
const { default: mongoose } = require('mongoose');
const job = require('../models/job');
const jobapplication = require('../models/jobapplication');
const chat = require('../models/chat');
const message = require('../models/message');
const user = require('../models/user');
const router = express.Router()
require('dotenv').config();


router.post('/get_user_id', (req, res) => {
    const { token } = req.body

    if (!token) return res.status(401).json({ message: 'Token required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return res.json({ userId: decoded.id });
    } catch (err) {
        return res.status(403).json({ message: 'Invalid token' });
    }
});

router.post('/get_notifications', async(req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    try {
        console.log('Incoming userId:', userId);

        const objectId = new mongoose.Types.ObjectId(userId);

        // Only keep allowed notification types
        const allowedTypes = ['job_post', 'job_application'];

        const notifications = await notification.find({
                user: objectId,
                type: { $in: allowedTypes }
            })
            .sort({ createdAt: -1 });

        console.log(notifications);

        res.status(200).json({ Notifications: notifications });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/get_user_job_posts', async(req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const jobs = await job.find({ postedBy: userId })
            .sort({ createdAt: -1 })
            .lean();

        const jobsWithApplicants = await Promise.all(
            jobs.map(async jobItem => {
                const applications = await jobapplication.find({ jobId: jobItem._id })
                    .populate('userId', 'fullName twitterHandle profileImage level')
                    .lean();



                const formattedApplications = applications.map(app => ({
                    message: app.message,
                    resumeUrl: app.resumeUrl,
                    status: app.status,
                    appliedAt: app.appliedAt,
                    user: app.userId,
                }));

                return {
                    ...jobItem,
                    applicants: formattedApplications,
                };
            })
        );

        // ✅ Filter only jobs that have at least 1 applicant
        const jobsWithAtLeastOneApplicant = jobsWithApplicants.filter(job => job.applicants.length > 0);

        return res.status(200).json({ jobs: jobsWithAtLeastOneApplicant });
    } catch (error) {
        console.error('Error fetching user jobs:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Endpoint to toggle a job status 
router.post('/toggle_job_status', async(req, res) => {
    const { token, jobId } = req.body;

    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const Ujob = await job.findById(jobId);

        if (!Ujob) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Optionally check if the user is the owner of the job
        if (Ujob.postedBy.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized to toggle this job status' });
        }

        // Toggle status
        Ujob.status = Ujob.status === 'open' ? 'closed' : 'open';
        await Ujob.save();

        return res.status(200).json({
            message: `Job status updated to ${Ujob.status}`,
            updatedStatus: Ujob.status
        });
    } catch (error) {
        console.error('Toggle Job Error:', error);
        return res.status(500).json({ message: 'Server error while toggling job status' });
    }
});



// Get first portfolio for a user
router.post('/get_portfolio', async(req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const Iuser = await user.findById(decoded.id);
        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        // Return the first portfolio (if exists)
        const portfolio =
            Iuser.portfolioUrl && Iuser.portfolioUrl.length > 0 ?
            {
                url: Iuser.portfolioUrl[0],
                publicId: Iuser.portfolioPublicId[0] || null,
            } :
            null;

        return res.json({ portfolio });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving portfolio' });
    }
});



router.post('/check_activities', async(req, res) => {
    const { token } = req.body;

    if (!token) return res.status(400).json({ message: 'Token required' });

    try {
        // Verify token and get userId
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Check notifications count for user
        const notificationsCount = await notification.countDocuments({ user: userId });

        // Check jobs posted count for user
        const jobsCount = await job.countDocuments({ postedBy: userId });

        res.json({
            hasNotifications: notificationsCount > 0,
            hasJobs: jobsCount > 0
        });

    } catch (error) {
        console.error('Error checking user activities:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Endpoint to get a single job post applicants
router.post('/get_single_job_post', async(req, res) => {
    const { token, jobId } = req.body;

    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch job
        const Ujob = await job.findById(jobId).lean();
        if (!Ujob) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Authorization check: only job owner can see
        if (Ujob.postedBy.toString() !== userId) {
            return res.status(403).json({ message: 'You are not authorized to view this job' });
        }

        // Fetch applicants separately from JobApplication
        const applicants = await jobapplication.find({ jobId })
            .populate('userId', 'fullName avatar profileImage email portfolioUrl portfolioPublicId')
            .lean();

        const fullJob = {
            ...Ujob,
            applicants: applicants.map(app => ({
                id: app.userId._id,
                name: app.userId.fullName,
                profileImage: app.userId.profileImage,
                email: app.userId.email,
                message: app.message,
                resumeUrl: app.resumeUrl,
                status: app.status,
                appliedAt: app.appliedAt,
                portfolio: app.userId.portfolioUrl[0] ?
                    {
                        url: app.userId.portfolioUrl[0],
                        publicId: app.userId.portfolioPublicId[0] || null
                    } :
                    null
            }))
        };

        return res.status(200).json({ job: fullJob });
    } catch (error) {
        console.error('Error fetching single job post:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});


// Get details for a single conversation
router.post('/conversation', async(req, res) => {
    try {
        const { chatId, token } = req.body;

        // Validate required fields
        if (!chatId || !token) {
            return res.status(400).json({ message: 'Chat ID and Token are required' });
        }

        // Decode token to get userId
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        // Find chat and populate participants
        const chatData = await chat
            .findById(chatId)
            .populate('participants', 'fullName profileImage avatar email');

        if (!chatData) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        // Ensure user is a participant in the chat
        const isParticipant = chatData.participants.some(
            (p) => p._id.toString() === userId
        );

        if (!isParticipant) {
            return res.status(403).json({ message: 'You are not a participant in this chat' });
        }

        // Get last message
        const lastMessage = await message
            .findOne({ chatId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            chat: chatData,
            lastMessage: lastMessage || null
        });

    } catch (error) {
        console.error('Error fetching conversation details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get messages in a chat
router.post('/messages', async(req, res) => {
    try {
        const { chatId, token } = req.body;

        if (!chatId || !token) {
            return res.status(400).json({ message: 'Chat ID and token are required' });
        }

        // Verify token and get userId
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        // Verify user is participant of the chat
        const chatData = await chat.findById(chatId);
        if (!chatData) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const isParticipant = chatData.participants.some(
            (p) => p.toString() === userId // or p._id.toString() if populated
        );
        if (!isParticipant) {
            return res.status(403).json({ message: 'You are not a participant in this chat' });
        }

        // Fetch messages
        // Fetch messages with populated sender info
        const messages = await message
            .find({ chatId })
            .sort({ createdAt: 1 })
            .populate('sender', '_id fullName profileImage'); // <-- populate sender with selected fields

        res.json(messages);

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get a user conversations
router.post('/my_conversations', async(req, res) => {
    try {
        const { token, userId } = req.body;

        if (!token || !userId) {
            return res.status(400).json({ message: 'Token and User ID are required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let chats = await chat.find({ participants: { $in: [userId] } })
            .populate('participants', 'fullName profileImage avatar')
            .sort({ updatedAt: -1 }).lean();

        // Filter out chats where job is null or undefined
        // chats = chats.filter(c => c.job !== null && c.job !== undefined);

        // // (Optional) Also filter out chats with invalid participants or missing profileImage
        // chats = chats.filter(c =>
        //     Array.isArray(c.participants) &&
        //     c.participants.every(p => p && p._id && p.profileImage)
        // );
        // Add unread count for each chat
        for (let chatItem of chats) {
            const unreadCount = await message.countDocuments({
                chatId: chatItem._id,
                readBy: { $ne: userId },
                sender: { $ne: userId } // exclude user's own messages
            });
            chatItem.unreadCount = unreadCount;
        }

        res.json(chats);

    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark all messages in a conversation as read
router.put('/messages/markAsRead/:conversationId', async(req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Update all messages in the conversation where this user hasn't read them yet
        await message.updateMany({
            chatId: conversationId, // <-- match your schema
            readBy: { $ne: userId }
        }, { $push: { readBy: userId } });

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



router.post('/create_chat', async(req, res) => {
    try {
        const { token, userId2 } = req.body;

        if (!token || !userId2) {
            return res.status(400).json({ message: 'Token and userId2 are required' });
        }

        // Decode the token to get userId1
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const userId1 = decoded.id; // make sure your JWT stores user id in `id`

        // Check if chat exists between both users
        let existingChat = await chat.findOne({
            participants: { $all: [userId1, userId2] }
        });

        // If not, create a new chat
        if (!existingChat) {
            existingChat = await chat.create({
                participants: [userId1, userId2]
            });
        }

        res.json(existingChat);

    } catch (error) {
        console.error('Error creating chat:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router