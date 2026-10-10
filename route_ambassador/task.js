const express = require('express');
const router = express.Router();
const Task = require('../models/task');

const upload = require('../utils/multer');  // your multer config file
const cloudinary = require('../utils/cloudinary'); // your cloudinary config file


const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');

const Submission = require('../models/submit');
const Ambassador = require('../models/Ambassadors');
const ProjectAmbassador = require('../models/projectAmbassador'); // was missing
const jwt = require("jsonwebtoken");
const project = require('../models/project');
const projectAmbassador = require('../models/projectAmbassador');
const tweetLog = require('../models/tweetLog');
const Ambassadors = require('../models/Ambassadors');

// Get start of the current week (Monday as start)
// Get start of the current week (Sunday as start)
function getStartOfWeekSunday() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = now.getUTCDate() - day; // subtract day to get back to Sunday
  const start = new Date(now.setUTCDate(diff));
  start.setUTCHours(0, 0, 0, 0); // reset to midnight UTC
  return start;
}



// ----------------------------------
// POST /add-points (per project scope not really needed here)
// ----------------------------------
router.post("/add-points", async (req, res) => {
  try {
    const { id, twitterId, points } = req.body;

    if (!points || (!id && !twitterId)) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const query = id ? { _id: id } : { twitterId };
    const ambassador = await Ambassador.findOne(query);

    if (!ambassador) {
      return res.status(404).json({ error: "Ambassador not found." });
    }

    ambassador.points = (ambassador.points || 0) + points;
    ambassador.total_points = (ambassador.total_points || 0) + points;

    await ambassador.save();

    res.status(200).json({
      message: "Points added successfully",
      ambassador,
    });
  } catch (err) {
    console.error("Error adding points:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------------
// GET /tasks?projectId=xxx
// ----------------------------------
router.get('/tasks', async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: "projectId required" });

    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------------------------
// POST /submit (task submission per project)
// ----------------------------------

router.post('/submit', upload.array('proofImages', 3), async (req, res) => {
  const { taskId, proof, token, projectId, hashtag } = req.body;

  if (!token) return res.status(401).json({ message: "No token provided" });
  if (!taskId || !projectId) return res.status(400).json({ message: "Missing taskId or projectId" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ambassadorId = decoded.id;

    // Check daily limit
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const todaySubmissions = await Submission.countDocuments({
      ambassadorId,
      submitted_at: { $gte: startOfDay, $lte: endOfDay }
    });
    if (todaySubmissions >= 10) {
      return res.status(400).json({ message: "You have reached your daily submission limit (10)" });
    }

    // Check duplicate proof (if proof text exists)
    if (proof) {
      const duplicate = await Submission.findOne({ proof, projectId });
      if (duplicate) return res.status(400).json({ message: "This proof has already been used" });
    }

    // Handle rejected re-submission
    const rejected = await Submission.findOne({ ambassadorId, taskId, projectId, status: 'rejected' });
    if (rejected) {
      rejected.proof = proof;
      rejected.status = 'pending';
      rejected.hashtag = hashtag;
      rejected.submitted_at = new Date();
      rejected.proofImages = []; // reset previous images

      // If new images are uploaded
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const uploadRes = await cloudinary.uploader.upload(file.path, {
            folder: "blockhub_tasks",
            transformation: [{ width: 1000, quality: "auto" }]
          });
          rejected.proofImages.push({
            public_id: uploadRes.public_id,
            url: uploadRes.secure_url
          });
        }
      }

      await rejected.save();
      return res.status(200).json({ message: "Task resubmitted successfully (pending approval)", submission: rejected });
    }

    // Handle new submission
    const submission = new Submission({
      ambassadorId,
      taskId,
      projectId,
      proof,
      hashtag,
      status: 'pending',
      submitted_at: new Date(),
      proofImages: []
    });

    // Upload any attached images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "blockhub_tasks",
          transformation: [{ width: 1000, quality: "auto" }]
        });
        submission.proofImages.push({
          public_id: uploadRes.public_id,
          url: uploadRes.secure_url
        });
      }
    }

    await submission.save();

    // Ensure project ambassador exists
    const exists = await projectAmbassador.findOne({ ambassadorId, projectId });
    if (!exists) {
      await projectAmbassador.create({ ambassadorId, projectId, totalPoints: 0, totalTasks: 0 });
    }

    res.status(201).json({
      message: "Task submitted successfully (pending approval)",
      submission
    });

  } catch (err) {
    console.error("❌ Error submitting task:", err);
    res.status(500).json({ message: "Server error while submitting task" });
  }
});



/// POST /pending
router.post('/pending', async (req, res) => {
  const { token, projectId } = req.body;
  console.log("🚀 /pending called", { token, projectId });

  if (!token) return res.status(401).json({ message: "No token provided" });
  if (!projectId) return res.status(400).json({ message: "projectId required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ambassadorId = decoded.id;
    const now = new Date();

    // Fetch project
    const Iproject = await project.findById(projectId);
    if (!Iproject) return res.status(404).json({ message: "Project not found" });

    // Fetch all active tasks for this project
    const allTasks = await Task.find({ projectId, is_active: true });

    // Fetch this user's submissions for this project
    const submissions = await Submission.find({ ambassadorId, projectId });

    // ✅ Only hide tasks where submission is approved
    const approvedTaskIds = submissions
      .filter(sub => sub.status === "approved")
      .map(sub => sub.taskId.toString());

    // Keep all other tasks (not submitted or rejected or pending)
    const availableTasks = allTasks.filter(task =>
      !approvedTaskIds.includes(task._id.toString())
    );

    // Build response tasks
    const submissionMap = {};
    submissions.forEach(sub => submissionMap[sub.taskId.toString()] = sub.status);

    const userTasks = availableTasks.map(task => ({
      ...task.toObject(),
      status: submissionMap[task._id.toString()] || 'not_submitted',
      taskFull: task.usage >= 50,
      expired: task.expires_at && new Date(task.expires_at) <= now
    }));

    // Leaderboard
    const leaderboard = await projectAmbassador.find({ projectId })
      .populate({ path: "ambassadorId", select: "name twitter_handle img", model: "Ambassador" })
      .sort({ points: -1 })
      .limit(100);

    res.status(200).json({ Iproject, tasks: userTasks, leaderboard });
  } catch (err) {
    console.error("❌ Error in /pending:", err);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});





// Get ambassador rankings for a project (using body)
router.post('/rankings', async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Find ambassadors tied to this project and sort by points
    const rankings = await ProjectAmbassador.find({ projectId })
      .populate('ambassadorId', 'name username twitter_handle img')
      .sort({ totalPoints: -1, joinedAt: 1 })
      .lean();

    // Format with rank number
    const rankedList = rankings.map((amb, index) => ({
      rank: index + 1,
      ambassadorId: amb.ambassadorId._id,
      name: amb.ambassadorId.name,
      username: amb.ambassadorId.username,
      twitter_handle: amb.ambassadorId.twitter_handle,
      img: amb.ambassadorId.img,
      totalPoints: amb.totalPoints,
      totalTasks: amb.totalTasks,
      joinedAt: amb.joinedAt
    }));

    res.json({ projectId, rankings: rankedList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});
module.exports = router;
