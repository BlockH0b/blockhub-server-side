const express = require('express');
const jwt = require('jsonwebtoken');
const jobapplication = require('../models/jobapplication');
const chat = require('../models/chat');
const job = require('../models/job');
const user = require('../models/user');
const { getIO } = require('../confiq/socket');
const notification = require('../models/notification');
const payment = require('../models/payment');
// const job = require('../models/job');
require('dotenv').config();

const route = express.Router();

route.post('/top_opportunities', async(req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch top 5 jobs (you can use `.sort({ createdAt: -1 })` to get recent jobs)
        // Define start date: August 8, 2025 at 00:00:00
        const startDate = new Date('2025-08-12T00:00:00Z');

        const topJobs = await job.find({
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 }).limit(5);
        return res.status(200).json({ topJobs });
    } catch (err) {
        return res.status(401).json({ message: "Invalid token", error: err.message });
    }
});

route.post('/recent_jobs', async(req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Fetch top 5 jobs (you can use `.sort({ createdAt: -1 })` to get recent jobs)
        // Define start date: August 8, 2025 at 00:00:00
        const startDate = new Date('2025-08-12T00:00:00Z');

        const topJobs = await job.find({
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });
        return res.status(200).json({ topJobs });
    } catch (err) {
        return res.status(401).json({ message: "Invalid token", error: err.message });
    }
})
route.post('/all_jobs', async(req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Define start date: August 8, 2025 at 00:00:00
        const startDate = new Date('2025-08-10T00:00:00Z');

        const topJobs = await job.find({
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });

        return res.status(200).json({ topJobs });
    } catch (err) {
        return res.status(401).json({ message: "Invalid token", error: err.message });
    }
});

route.post('/view_job', async(req, res) => {
    const { token, jobId } = req.body;

    // Validate required fields
    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Find job
        const Ajob = await job.findById(jobId);
        if (!Ajob) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Optional: Log view (e.g., for analytics)
        // job.views = (job.views || 0) + 1;
        // await job.save();

        return res.status(200).json({ Ajob });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Endpoint to Apply for a Job
route.post('/apply_job', async (req, res) => {
  const { token, jobId, message, resumeUrl } = req.body;

  if (!token || !jobId) {
    return res.status(400).json({ message: 'Token and Job ID are required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const applicantUser = await user.findById(userId);
    if (!applicantUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Check if user is verified (paid)
    // You can check Paystack or your payment collection
    // const paymentRecord = await payment.findOne({ username: applicantUser.twitterHandle });
    // const paid = paymentRecord?.status === true; // Add Paystack verification if needed

    // if (!paid) {
    //   return res.status(403).json({ message: 'You are not a verified user. Please get a Portfolio before applying.' });
    // }

    
    // ✅ Check if the user applied for any job in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentApplication = await jobapplication.findOne({
      userId,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    // if (recentApplication) {
    //   return res.status(400).json({ message: 'You can only apply to one job every 24 hours' });
    // }

    // Check if the user already applied
    const alreadyApplied = await jobapplication.findOne({ userId, jobId });
    if (alreadyApplied) {
      return res.status(400).json({ message: 'You already applied for this job' });
    }

    // Check the current number of applicants for the job
    const jobData = await job.findById(jobId).select('totalApplicants status postedBy jobTitle title');
    if (!jobData) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (jobData.status === 'closed' || jobData.status === 'pending') {
      return res.status(400).json({ message: "Application for this job is already closed" });
    }

    // // Limit to 5 total applicants
    // if (jobData.totalApplicants = 5) {
    //   return res.status(400).json({ message: 'Application limit reached (5). This job is already filled.' });
    // }

    // Create a new application
    const newApplication = new jobapplication({
      jobId,
      userId,
      message,
      resumeUrl
    });
    await newApplication.save();

    // Increment applicant count + add applicant data
    await job.findByIdAndUpdate(jobId, {
      $push: {
        applicants: {
          user: userId,
          message,
          resumeUrl
        }
      },
      $inc: { totalApplicants: 1 }
    });

    // Add job to user's appliedJobs list
    await user.findByIdAndUpdate(userId, {
      $addToSet: { appliedJobs: jobId }
    });

    // // Create notification
    // const newNotification = new notification({
    //   user: jobData.postedBy,
    //   type: 'job_application',
    //   message: `${applicantUser.twitterHandle || 'Someone'} applied to your job post: ${jobData.jobTitle || jobData.title}`,
    //   link: `/job/${jobId}`,
    // });
    // await newNotification.save();

    // Emit notification via socket
    try {
      const io = getIO();
      io.to(jobData.postedBy.toString()).emit('notification', {
        id: newNotification._id,
        type: newNotification.type,
        message: newNotification.message,
        senderName: applicantUser.name,
        jobTitle: jobData.jobTitle || jobData.title,
        avatar: applicantUser.avatar || 'https://via.placeholder.com/48',
        time: 'Just now',
      });
    } catch (socketError) {
      console.log('Socket emit failed:', socketError.message);
    }

    return res.status(200).json({ message: 'Application submitted successfully' });

  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Smooth Apply Endpoint (any user can apply)
// route.post('/apply_job', async (req, res) => {
//   const { token, jobId, message, resumeUrl } = req.body;

//   if (!token || !jobId) {
//     return res.status(400).json({ message: 'Token and Job ID are required' });
//   }

//   try {
//     // Decode token to get user
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const userId = decoded.id;

//     const applicantUser = await user.findById(userId);
//     if (!applicantUser) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // ✅ Fetch the job
//     const jobData = await job.findById(jobId).select(
//       'totalApplicants status postedBy jobTitle title telegramLink'
//     );
//     if (!jobData) {
//       return res.status(404).json({ message: 'Job not found' });
//     }

//     // ✅ If you want *everyone* to apply, remove checks like status/limit
//     if (jobData.status === 'closed') {
//       return res.status(400).json({ message: "Application for this job is closed" });
//     }

//     // ✅ Always create a new application
//     const newApplication = new jobapplication({
//       jobId,
//       userId,
//       message,
//       resumeUrl
//     });
//     await newApplication.save();

//     // ✅ Update job (increment applicants + push applicant data)
//     await job.findByIdAndUpdate(jobId, {
//       $push: {
//         applicants: {
//           user: userId,
//           message,
//           resumeUrl
//         }
//       },
//       $inc: { totalApplicants: 1 }
//     });

//     // ✅ Add job to user's appliedJobs list
//     await user.findByIdAndUpdate(userId, {
//       $addToSet: { appliedJobs: jobId }
//     });

// return res.status(200).json({ 
//   message: 'Application submitted successfully',
//   twitterLink: jobData.telegramLink // make sure job has this field
// });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// });


route.post('/save_job', async(req, res) => {
    const { token, jobId } = req.body;

    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Add jobId to savedJobs if it's not already there
        await user.findByIdAndUpdate(userId, {
            $addToSet: { savedJobs: jobId } // $addToSet avoids duplicates
        });

        return res.status(200).json({ message: 'Job saved successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

route.post('/unsave-job', async(req, res) => {
    const { token, jobId } = req.body;

    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        await user.findByIdAndUpdate(userId, {
            $pull: { savedJobs: jobId } // Removes jobId from savedJobs
        });

        return res.status(200).json({ message: 'Job removed from saved list' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

route.post('/job-applicants', async(req, res) => {
    const { jobId, token } = req.body
    if (!token || !jobId) {
        return res.status(400).json({ message: 'Token and Job ID are required' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const applicants = await jobapplication.find({ jobId })
            .populate('userId', 'fullName twitterHandle profileImage') // only select what you need
            .sort({ appliedAt: -1 });

        return res.status(200).json({ applicants });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
})

// Express route for notificaion count
route.post('/notifications_unread-count', async(req, res) => {
    const { userId } = req.body;
    try {
        const count = await notification.countDocuments({ user: userId, isRead: false });
        res.json({ unreadCount: count });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});



// Get first portfolio for a user
route.post('/get_portfolio', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const Iuser = await user.findById(decoded.id);
    if (!Iuser) return res.status(404).json({ message: 'User not found' });

    // Return the first portfolio (if exists)
    const portfolio =
      Iuser.portfolioUrl && Iuser.portfolioUrl.length > 0
        ? {
            url: Iuser.portfolioUrl[0],
            publicId: Iuser.portfolioPublicId?.[0] || null,
          }
        : null;

    return res.json({ portfolio });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving portfolio' });
  }
});


module.exports = route