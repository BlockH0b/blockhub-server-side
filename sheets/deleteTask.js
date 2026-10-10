const mongoose = require('mongoose');
require('dotenv').config();

const Task = require('../models/task'); // your Task schema

async function deleteAllTasks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');

    const result = await Task.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} tasks`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error deleting tasks:', err);
    process.exit(1);
  }
}

deleteAllTasks();
