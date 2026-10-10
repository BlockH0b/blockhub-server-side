const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "courses", required: true, index: true },

  progress: { type: Number, default: 0, min: 0, max: 100 },
  completed: { type: Boolean, default: false },

  completedLessons: [{ type: Number, default: [] }],
  totalLessons: { type: Number, default: 0 },

  quizCompletedLessons: [{ type: Number, default: [] }],

  // certificates
  certificateStatus: {
    type: String,
    enum: ["pending", "processing", "delivered"],
    default: "pending",
  },

  certificateUrl: {
    type: String,
    default: null,
  },

  certificateIssuedAt: {
    type: Date,
    default: null,
  },

  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  lastAccessedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: "enrollments",
});

// prevent duplicate enrollment
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports =
  mongoose.models.Enrollment ||
  mongoose.model("Enrollment", enrollmentSchema);