// route_project/projects.js
const express = require("express");
const project = require("../models/project");
const task = require("../models/task");
const projectAmbassador = require("../models/projectAmbassador");
const router = express.Router();
// const Project = require("../models/Project");
// const AmbassadorProject = require("../models/AmbassadorProject");
// const Task = require("../modal/Task");

// GET all projects with ambassador + task counts
// GET all projects with ambassador + task counts
// GET all projects with ambassador + hashtag counts
router.get("/get_projects", async (req, res) => {
  try {
    const projects = await project.find();

    // For each project, calculate ambassadors & hashtag tasks
    const projectsWithStats = await Promise.all(
      projects.map(async (projectDoc) => {
        const ambassadorsCount = await projectAmbassador.countDocuments({
          projectId: projectDoc._id,
        });

        // Count only hashtag tasks
        const hashtagsCount = await task.countDocuments({
          projectId: projectDoc._id,
          hashtags: { $exists: true, $ne: "" },
        });

        return {
          id: projectDoc._id,
          name: projectDoc.projectName,
          desc: projectDoc.description,
          compensation: projectDoc.compensation,
          profile: projectDoc.profileImage,
          participants: ambassadorsCount,
          hashtags: hashtagsCount, // 👈 instead of active_tasks
        };
      })
    );

    // ✅ Sort by participants (ambassadors) in descending order
    projectsWithStats.sort((a, b) => b.participants - a.participants);

    res.json(projectsWithStats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



module.exports = router;
