const mongoose = require("mongoose");

const cohortClassSchema = new mongoose.Schema(
    {
        // ============================================
        // COHORT
        // ============================================

        cohort: {
            type: String,
            required: true,
            default: "cohort-1.0",
            index: true,
        },

        // ============================================
        // COURSE / TRACK
        // ============================================

        track: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        // ============================================
        // CLASS INFORMATION
        // ============================================

        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: null,
            trim: true,
        },

        // ============================================
        // CLASS DATE & TIME
        // ============================================

        startDate: {
            type: Date,
            required: true,
            index: true,
        },

        startTime: {
            type: String,
            required: true,
            trim: true,
        },

        endTime: {
            type: String,
            required: true,
            trim: true,
        },

        // ============================================
        // GOOGLE MEET
        // ============================================

        meetingLink: {
            type: String,
            default: null,
            trim: true,
        },

        meetingStatus: {
            type: String,
            enum: ["pending", "available"],
            default: "pending",
        },

        // ============================================
        // TUTOR
        // ============================================

        tutor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            default: null,
            index: true,
        },

        // ============================================
        // CLASS STATUS
        // ============================================

        status: {
            type: String,
            enum: [
                "scheduled",
                "ongoing",
                "completed",
                "cancelled",
            ],
            default: "scheduled",
            index: true,
        },

        // ============================================
        // OPTIONAL CLASS METADATA
        // ============================================

        classNumber: {
            type: Number,
            default: null,
        },

        durationMinutes: {
            type: Number,
            default: null,
        },

        // ============================================
        // RECORD TIMESTAMPS
        // ============================================

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            default: null,
        },
    },
    {
        timestamps: true,
        collection: "cohortclasses",
    }
);


// ============================================
// INDEXES
// ============================================

cohortClassSchema.index({
    cohort: 1,
    track: 1,
    startDate: 1,
});


// ============================================
// MODEL
// ============================================

module.exports =
    mongoose.models.CohortClass ||
    mongoose.model("CohortClass", cohortClassSchema);