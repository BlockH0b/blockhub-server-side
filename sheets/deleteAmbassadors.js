// deleteAmbassadors.js
const mongoose = require('mongoose');
require('dotenv').config(); // make sure you have MONGO_URI in your .env

const Ambassador = require('./models/Ambassadors');
const ProjectAmbassador = require('./models/projectAmbassador');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // 1️⃣ Aggregate total points per ambassador
    const ambassadorsPoints = await ProjectAmbassador.aggregate([
      {
        $group: {
          _id: "$ambassadorId",
          totalPoints: { $sum: "$totalPoints" }
        }
      }
    ]);

    // 2️⃣ Filter ambassadors with totalPoints < 500
    const lowPointAmbassadors = ambassadorsPoints
      .filter(a => a.totalPoints < 500)
      .map(a => a._id);

    if (lowPointAmbassadors.length === 0) {
      console.log("✅ No ambassadors found with less than 500 total points.");
      process.exit(0);
    }

    // 3️⃣ Delete from ProjectAmbassador
    const deletedPA = await ProjectAmbassador.deleteMany({ ambassadorId: { $in: lowPointAmbassadors } });

    // 4️⃣ Delete from Ambassador
    const deletedAmb = await Ambassador.deleteMany({ _id: { $in: lowPointAmbassadors } });

    console.log(`✅ Deleted ${deletedAmb.deletedCount} ambassadors and ${deletedPA.deletedCount} project records with less than 500 points.`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
