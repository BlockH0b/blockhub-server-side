const mongoose = require("mongoose");

/*
 * CohortAnnouncement
 * ------------------------------------------------------------
 * Posted by a cohort tutor, shown on the dashboard of every
 * student in the same cohort + track.
 */

const cohortAnnouncementSchema = new mongoose.Schema(
    {
        cohort: { type: String, required: true, default: "cohort-1.0", index: true },
        track: { type: String, required: true, trim: true, index: true },

        title: { type: String, required: true, trim: true, maxlength: 160 },
        message: { type: String, required: true, trim: true, maxlength: 4000 },

        type: {
            type: String,
            enum: ["info", "important", "success"],
            default: "info",
        },

        author: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    },
    {
        timestamps: true,
        collection: "cohortannouncements",
    }
);

cohortAnnouncementSchema.index({ cohort: 1, track: 1, createdAt: -1 });

module.exports =
    mongoose.models.CohortAnnouncement ||
    mongoose.model("CohortAnnouncement", cohortAnnouncementSchema);
