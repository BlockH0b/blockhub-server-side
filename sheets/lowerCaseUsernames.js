// lowerCaseUsernames.js
const mongoose = require('mongoose');
require('dotenv').config();

// import your modal
const Payment = require('./modal/payment'); 
const ProjectAmbassador = require('./modal/projectAmbassador'); 

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Update payment usernames to lowercase
    const paymentResult = await Payment.updateMany(
      {}, // all docs
      [
        { $set: { username: { $toLower: "$username" } } } // MongoDB aggregation update
      ]
    );
    console.log(`✅ Updated ${paymentResult.modifiedCount} payment usernames to lowercase.`);

    // Update ambassador twitterHandles to lowercase
    const ambassadorResult = await ProjectAmbassador.updateMany(
      {}, // all docs
      [
        { $set: { twitterHandle: { $toLower: "$twitterHandle" } } }
      ]
    );
    console.log(`✅ Updated ${ambassadorResult.modifiedCount} ambassador twitter handles to lowercase.`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

run();
