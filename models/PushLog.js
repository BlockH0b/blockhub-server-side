const mongoose = require("mongoose");

/*
 * PushLog
 * ------------------------------------------------------------
 * Every push notification BlockHub sends (one row per send, not
 * per person). Used to:
 *   - never send the same push twice (dedupeKey is unique)
 *   - show history on the admin Push page
 */

const pushLogSchema = new mongoose.Schema(
    {
        kind: { type: String, default: "custom", index: true }, // test | broadcast | announcement | class_reminder | ...
        title: { type: String, required: true },
        message: { type: String, required: true },
        url: { type: String, default: null },
        audience: { type: String, default: "" }, // human label, e.g. "Backend Development"

        status: { type: String, enum: ["sending", "sent", "skipped", "failed"], default: "sending", index: true },
        targeted: { type: Number, default: 0 }, // how many users we aimed at
        unreachable: { type: Number, default: 0 }, // OneSignal had no device for them
        onesignalId: { type: String, default: null },
        error: { type: String, default: null },

        dedupeKey: { type: String },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    },
    { timestamps: true }
);

pushLogSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
pushLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

module.exports = mongoose.models.PushLog || mongoose.model("PushLog", pushLogSchema);
