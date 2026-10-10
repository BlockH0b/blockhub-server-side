const mongoose = require("mongoose");

const cohortTutorSchema = new mongoose.Schema(
  {
    // The actual BlockHub user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
      index: true,
    },

    // Cohort this tutor belongs to
    cohort: {
      type: String,
      required: true,
      default: "cohort-1.0",
      index: true,
    },

    // Track this tutor teaches
    track: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Tutor bio
    bio: {
      type: String,
      default: "",
      trim: true,
    },

    // Tutor level
    tutorLevel: {
      type: String,
      default: "Beginner",
      trim: true,
    },

    // Skills
    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    // Unique tutor code
    tutorCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    // Students assigned to this tutor
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],

    // Classes handled by this tutor
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CohortClass",
      },
    ],

    // Statistics
    totalStudents: {
      type: Number,
      default: 0,
    },

    totalClasses: {
      type: Number,
      default: 0,
    },

    totalUpcomingClasses: {
      type: Number,
      default: 0,
    },

    totalCompletedClasses: {
      type: Number,
      default: 0,
    },

    // Whether this tutor is currently active
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },

    // Optional community/curriculum information
    communityLink: {
      type: String,
      default: null,
      trim: true,
    },

    curriculumLink: {
      type: String,
      default: null,
      trim: true,
    },

    scheduleLink: {
      type: String,
      default: null,
      trim: true,
    },

    // Who assigned/created this tutor
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "cohorttutors",
  }
);

cohortTutorSchema.index({
  cohort: 1,
  track: 1,
});

module.exports =
  mongoose.models.CohortTutor ||
  mongoose.model("CohortTutor", cohortTutorSchema);