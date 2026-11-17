const mongoose = require("mongoose");

/* A student's answer to a CohortAssignment (one per student, can be updated) */
const fileSchema = new mongoose.Schema(
    {
        url: String,
        publicId: String,
        resourceType: String,
        name: String,
        size: Number,
        type: String,
    },
    { _id: false }
);

const cohortSubmissionSchema = new mongoose.Schema(
    {
        assignment: { type: mongoose.Schema.Types.ObjectId, ref: "CohortAssignment", required: true, index: true },
        cohort: { type: String, required: true, index: true },
        track: { type: String, required: true, index: true },

        student: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
        studentName: { type: String, trim: true },
        studentEmail: { type: String, trim: true, lowercase: true },

        link: { type: String, trim: true, default: null },
        text: { type: String, trim: true, maxlength: 8000, default: null },
        files: { type: [fileSchema], default: [] },

        status: {
            type: String,
            enum: ["submitted", "reviewed", "needs_changes"],
            default: "submitted",
        },
        grade: { type: String, trim: true, maxlength: 40, default: null },
        feedback: { type: String, trim: true, maxlength: 4000, default: null },

        submittedAt: { type: Date, default: Date.now },
        reviewedAt: { type: Date, default: null },
        late: { type: Boolean, default: false },
    },
    { timestamps: true, collection: "cohortsubmissions" }
);

cohortSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports =
    mongoose.models.CohortSubmission || mongoose.model("CohortSubmission", cohortSubmissionSchema);
