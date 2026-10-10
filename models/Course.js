const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  id: String,
  name: String,
  size: { type: Number, default: 0 },
  type: { type: String, default: "image" },
  url: String
});


// Quiz option schema
const quizOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
});

const quizSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [quizOptionSchema],
  correctAnswer: { type: String }
});

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['note', 'video', 'slides'], default: 'note' },

  // Can be either string (note content) or object (video file info)
  content: { type: mongoose.Schema.Types.Mixed, default: '' },

  files: [fileSchema],
  quizEnabled: { type: Boolean, default: false },
  quiz: [quizSchema],
  open: { type: Boolean, default: true }
});

const courseSchema = new mongoose.Schema(
  {
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'tutors', required: true },
    name: { type: String, required: true },
    overview: { type: String, default: '' },
    thumbnail: { type: fileSchema },
    level: { type: String, default: 'Beginner' },

    pricing: {
      type: {
        type: String,
        enum: ["free", "paid"],
        default: "free"
      },

      amount: {
        type: Number,
        default: 0
      },

      currency: {
        type: String,
        default: "USD"
      },
      discount: {
        type: Number,
        default: 0
      }
    },

    tag: { type: String, default: '' },
    twitter: { type: String, default: '' },
    website: { type: String, default: '' },
    lessons: [lessonSchema],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    totalViews: { type: Number, default: 0 },
    totalEnrollments: { type: Number, default: 0 },
    isDraft: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'courses' }
);

module.exports = mongoose.models.courses || mongoose.model('courses', courseSchema);