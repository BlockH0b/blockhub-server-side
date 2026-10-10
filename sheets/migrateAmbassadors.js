const mongoose = require('mongoose');
require('dotenv').config();

// Models
const LegacyAmbassador = require('../models/LegacyAmbassador'); // old collection
const Ambassador = require('../models/Ambassadors');             // new collection
const ProjectAmbassador = require('../models/projectAmbassador');
const Project = require('../models/project');                   // to get BlockHub project ID

async function migrateAmbassadors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    // Find BlockHub project
    const blockhubProject = await Project.findOne({ projectName: 'Block Hub' });
    if (!blockhubProject) throw new Error('BlockHub project not found');

    // Fetch all legacy ambassadors
    const legacyAmbassadors = await LegacyAmbassador.find();
    console.log(`Found ${legacyAmbassadors.length} legacy ambassadors`);

    for (const legacy of legacyAmbassadors) {
      // Check if ambassador exists in new collection
      let ambassador = await Ambassador.findOne({ twitterId: legacy.twitterId });
      if (!ambassador) {
        ambassador = new Ambassador({
          twitterId: legacy.twitterId,
          name: legacy.name,
          username: legacy.username,
          twitter_handle: legacy.twitter_handle,
          img: legacy.img,
          totalGlobalPoints: 0,
          totalGlobalTasks: 0,
          project: true,
        });
        await ambassador.save();
        console.log(`Created new Ambassador ${ambassador.twitter_handle}`);
      }

      // Check if ProjectAmbassador exists for BlockHub
      let projAmb = await ProjectAmbassador.findOne({
        ambassadorId: ambassador._id,
        projectId: blockhubProject._id
      });

      if (!projAmb) {
        // Create ProjectAmbassador for BlockHub using legacy points
        projAmb = new ProjectAmbassador({
          ambassadorId: ambassador._id,
          projectId: blockhubProject._id,
          points: legacy.total_points || 0,
          totalPoints: legacy.total_points || 0,
          totalTasks: legacy.total_tweets || 0
        });
        await projAmb.save();
        console.log(`Created ProjectAmbassador for BlockHub: ${ambassador.twitter_handle}`);
      }

      // Update ambassador global totals: sum across all projects
      const projectTotals = await ProjectAmbassador.aggregate([
        { $match: { ambassadorId: ambassador._id } },
        { $group: {
            _id: '$ambassadorId',
            globalPoints: { $sum: '$totalPoints' },
            globalTasks: { $sum: '$totalTasks' }
          }
        }
      ]);

      if (projectTotals.length > 0) {
        ambassador.totalGlobalPoints = projectTotals[0].globalPoints;
        ambassador.totalGlobalTasks = projectTotals[0].globalTasks;
        await ambassador.save();
        console.log(`Updated global totals for ${ambassador.twitter_handle}`);
      }
    }

    console.log('Migration complete!');
    process.exit(0);

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateAmbassadors();
