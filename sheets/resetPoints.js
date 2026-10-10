// resetPoints.js
const mongoose = require('mongoose');
require('dotenv').config();

const ProjectAmbassador = require('./model/projectAmbassador');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // ID of the specific project
    const projectId = '68dce5c6db9c9cd41ccfae28';

    // Reset points for ambassadors of this specific project
    const result = await ProjectAmbassador.updateMany(
      { projectId: new mongoose.Types.ObjectId(projectId) }, // filter by projectId
      { $set: { points: 0 } } // reset points
    );

    console.log(`✅ Reset points for ${result.modifiedCount} ambassadors of project ${projectId}.`);

    process.exit(0);
  } catch (err) {
    console.error(" Error:", err);
    process.exit(1);
  }
};

run();
