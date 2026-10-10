const mongoose = require("mongoose");

/*
 * EmailLog
 * ------------------------------------------------------------
 * Every email BlockHub tries to send. Used to:
 *   - never send the same email twice (dedupeKey is unique)
 *   - see what went out / what failed (admin: GET /email/logs)
 */

const emailLogSchema = new mongoose.Schema(
    {
        template: { type: String, required: true, index: true },
        category: { type: String, default: "essential", index: true },

        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },

        // Real recipient, and who it actually went to (test mode)
        to: { type: String, required: true, lowercase: true, trim: true },
        deliveredTo: [{ type: String }],

        subject: { type: String, default: "" },

        status: {
            type: String,
            enum: ["queued", "sent", "failed", "skipped"],
            default: "queued",
            index: true,
        },
        skipReason: { type: String, default: null },
        error: { type: String, default: null },

        testMode: { type: Boolean, default: false },

        // e.g. "class-reminder:<classId>:<userId>" - unique, so retries/crons never double send
        dedupeKey: { type: String, default: undefined },

        sentAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        collection: "emaillogs",
    }
);

emailLogSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
// Keep logs for 120 days
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

module.exports =
    mongoose.models.EmailLog || mongoose.model("EmailLog", emailLogSchema);
