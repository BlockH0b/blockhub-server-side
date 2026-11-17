const mongoose = require("mongoose");

/*
 * CohortAssignment - made by a track tutor, emailed to every
 * student in the track. Students answer with a CohortSubmission.
 */
const cohortAssignmentSchema = new mongoose.Schema(
    {
        cohort: { type: String, required: true, default: "cohort-1.0", index: true },
        track: { type: String, required: true, trim: true, index: true },

        title: { type: String, required: true, trim: true, maxlength: 160 },
        instructions: { type: String, required: true, trim: true, maxlength: 8000 },
        resourceLink: { type: String, trim: true, default: null }, // brief, Figma, repo...
        dueAt: { type: Date, default: null },

        // what students may hand in
        allowLink: { type: Boolean, default: true },
        allowFile: { type: Boolean, default: true },
        allowText: { type: Boolean, default: true },

        status: { type: String, enum: ["open", "closed"], default: "open" },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    },
    { timestamps: true, collection: "cohortassignments" }
);

cohortAssignmentSchema.index({ cohort: 1, track: 1, createdAt: -1 });

module.exports =
    mongoose.models.CohortAssignment || mongoose.model("CohortAssignment", cohortAssignmentSchema);
