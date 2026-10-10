const cron = require('node-cron');
const submit = require('../models/submit');
const task = require('../models/task');
const Ambassadors = require('../models/Ambassadors');
const projectAmbassador = require('../models/projectAmbassador');

const startAutoApprove = () => {
    console.log("⏱ Starting auto-approve cron job...");

    cron.schedule('*/10 * * * *', async () => { // every 5 minutes
        console.log("⏱ Cron tick: checking pending submissions...", new Date());

        try {
            const now = new Date();
            const pendingSubs = await submit.find({ status: 'pending' });
            console.log(`📋 Pending submissions found: ${pendingSubs.length}`);

            for (const sub of pendingSubs) {

                if (sub.proofImages && sub.proofImages.length > 0) {
                    console.log(`🖼️ Skipping submission ${sub._id} — contains images, requires manual review.`);
                    continue; // move to next submission
                }
                const age = now - sub.submitted_at;
                console.log(`⏳ Submission ${sub._id} age: ${Math.floor(age / 1000)} seconds`);

                if (age >= 60 * 1000) {
                    const TaskInstance = await task.findById(sub.taskId);
                    console.log(`✅ Auto-approving submission ${sub._id}`);

                    if (!TaskInstance) {
                        console.log(`⚠️ Task not found for submission ${sub._id}, skipping`);
                        // await submit.deleteOne({ _id: sub._id });

                        continue; // skip to next submission
                    }

                    sub.status = 'approved';
                    sub.projectId = TaskInstance.projectId;

                    await sub.save();

                    // Fetch task info including projectId
                    if (!TaskInstance) {
                        console.log(`⚠️ Task not found for submission ${sub._id}, skipping`);
                        continue;
                    }

                    // Increment task usage
                    TaskInstance.usage = (TaskInstance.usage || 0) + 1;
                    if (TaskInstance.usage >= 50) TaskInstance.taskFull = true;
                    await TaskInstance.save();
                    console.log(`📊 Task updated: usage=${TaskInstance.usage}, taskFull=${TaskInstance.taskFull}`);

                    // const ambassador = await Ambassadors.findById(ambassadorId);
                    // console.log(`Ambassador ${ambassadorId} has total points: ${ambassador.totalGlobalPoints}`);


                    const updatedAmbassador = await Ambassadors.findById(sub.ambassadorId);
                    console.log(`🌟 Updated points for ambassador ${sub.ambassadorId}: ${updatedAmbassador.totalGlobalPoints}`);

                    // Update ambassador stats
                    await Ambassadors.findByIdAndUpdate(
                        sub.ambassadorId,
                        {
                            $inc: { totalGlobalPoints: TaskInstance.points || 0, totalGlobalTasks: 1 }
                        },
                        { new: true } // this returns the updated document
                    );
                    console.log(`🌟 Ambassador points updated: ${sub.ambassadorId}`);

                    // Update project-specific stats
                    await projectAmbassador.findOneAndUpdate(
                        { ambassadorId: sub.ambassadorId, projectId: TaskInstance.projectId },
                        { $inc: { totalPoints: TaskInstance.points, totalTasks: 1, points: TaskInstance.points } },
                        { upsert: true }
                    );
                    console.log(`🌟 Project ambassador stats updated for project: ${TaskInstance.projectId}`);
                } else {
                    console.log(`⏳ Submission ${sub._id} not old enough to auto-approve.`);
                }
            }
        } catch (err) {
            console.error("❌ Error in auto-approve cron:", err);
        }
    });
};

module.exports = startAutoApprove;
