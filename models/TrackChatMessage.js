/*
 * Track group chat: one group per cohort track (students + their tutor).
 */
const mongoose = require("mongoose");

const trackChatMessageSchema = new mongoose.Schema(
    {
        cohort: { type: String, required: true, default: "cohort-1.0" },
        track: { type: String, required: true, trim: true },

        sender: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        senderName: { type: String, default: "" },
        senderAvatar: { type: String, default: null },
        senderRole: { type: String, enum: ["student", "tutor", "admin"], default: "student" },

        body: { type: String, required: true, trim: true, maxlength: 2000 },

        // quick reply to another message (we keep a small copy so it shows even if that one is deleted)
        replyTo: {
            id: { type: mongoose.Schema.Types.ObjectId, default: null },
            name: { type: String, default: null },
            body: { type: String, default: null },
        },

        pinned: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

trackChatMessageSchema.index({ cohort: 1, track: 1, createdAt: -1 });

module.exports = mongoose.models.TrackChatMessage || mongoose.model("TrackChatMessage", trackChatMessageSchema);
