const mongoose = require("mongoose");
require("dotenv").config();

require("../models/task"); // 👈 register Task model
require("../models/Ambassadors"); // 👈 register Ambassador model

const submit = require("../models/submit");
const project = require("../models/project");
const projectAmbassador = require("../models/projectAmbassador");

async function resetAHamsaVision() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      // useUnifiedTopology: true, // 🔥 not needed in Mongoose v6+
    });
    console.log("✅ MongoDB connected");

    // 1. Find the AHamsa Vision project
    const Iproject = await project.findOne({ projectName: "AHamsa Vision" });
    if (!Iproject) {
      console.log("❌ Project 'AHamsa Vision' not found");
      process.exit(1);
    }

    console.log(`🎯 Target Project: ${Iproject.projectName} (${Iproject._id})`);

    // 2. Find all projectAmbassadors for this project
    const projectAmbassadors = await projectAmbassador.find({
      projectId: Iproject._id,
    }).populate("ambassadorId");

    let updatedCount = 0;
    let totalRemovedSubs = 0;
    let totalRemovedPoints = 0;

    for (let pa of projectAmbassadors) {
      // ⚠️ Skip orphaned projectAmbassadors (ambassador deleted)
      if (!pa.ambassadorId) {
        console.log(
          `⚠️ Skipping orphaned ProjectAmbassador ${pa._id} (no linked ambassador)`
        );
        continue;
      }

      // 3. Get all submissions for this ambassador on this project
      const submissions = await submit
        .find({
          projectId: Iproject._id,
          ambassadorId: pa.ambassadorId._id,
        })
        .populate("taskId") // so we can access Task.points
        .sort({ submitted_at: -1 });

      console.log(
        `\n👤 Ambassador: ${pa.ambassadorId?.username || pa.ambassadorId?._id}\n   Submissions: ${submissions.length}, Points: ${pa.points}`
      );

      if (submissions.length > 10) {
        const keepSubs = submissions.slice(0, 10);
        const removeSubs = submissions.slice(10);

        // Calculate total points to subtract
        const removePoints = removeSubs.reduce(
          (sum, sub) => sum + (sub.taskId?.points || 0),
          0
        );

        // Update projectAmbassador
        pa.points = Math.max(0, pa.points - removePoints);
        pa.totalTasks = 10;
        await pa.save();

        // Delete extra submissions
        await submit.deleteMany({ _id: { $in: removeSubs.map((s) => s._id) } });

        console.log(
          `   ⚡ Trimmed: removed ${removeSubs.length} submissions, -${removePoints} pts\n   ➡️ New Total: ${pa.points} pts, 10 submissions`
        );

        updatedCount++;
        totalRemovedSubs += removeSubs.length;
        totalRemovedPoints += removePoints;
      } else {
        console.log("   ✅ Nothing to trim (10 or fewer submissions)");
      }
    }

    console.log("\n🎯 Normalization complete!");
    console.log(
      `📊 Ambassadors updated: ${updatedCount}\n🗑️ Total submissions removed: ${totalRemovedSubs}\n❌ Total points subtracted: ${totalRemovedPoints}`
    );

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

resetAHamsaVision();
