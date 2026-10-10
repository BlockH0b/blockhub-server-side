const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: String,
  description: String,
  type: { type: String, enum: ["manual", "hashtag"], default: "manual" }, // new
  hashtags: String, // 👈 list of hashtags to track
  points: Number,
  taskFull:  { type: Boolean, default: false },
  usage:  { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  important: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expires_at: Date,
  durationInHours: Number
}, { collection: 'tasks' })

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
