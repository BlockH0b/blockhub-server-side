const mongoose = require("mongoose");

const cohortRegistrationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: true,
            index: true,
        },

        cohort: {
            type: String,
            required: true,
            default: "cohort-1.0",
            index: true,
        },

        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        telegramUsername: {
            type: String,
            trim: true,
            default: null,
        },

        country: {
            type: String,
            required: true,
            trim: true,
        },

        track: {
            type: String,
            required: true,
           
        },

        about: {
            type: String,
            required: true,
            enum: [
                "Student",
                "Beginner",
                "Freelancer",
                "Creator",
                "Developer/Tech professional",
                "Entrepreneur",
                "Working professional",
                "Other",
            ],
        },

        source: {
            type: String,
            required: true,
            enum: [
                "X",
                "TikTok",
                "Telegram",
                "Friend/Referral",
                "Other",
            ],
        },

        status: {
            type: String,
            enum: [
                "registered",
                "accepted",
                "rejected",
                "completed",
            ],
            default: "registered",
        },

        registeredAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: "cohortregistrations",
    }
);

/**
 * Prevent the same BlockHub user
 * from registering twice for the same cohort.
 */
cohortRegistrationSchema.index(
    { user: 1, cohort: 1 },
    { unique: true }
);

module.exports =
    mongoose.models.CohortRegistration ||
    mongoose.model("CohortRegistration", cohortRegistrationSchema);