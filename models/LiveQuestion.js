const mongoose = require("mongoose");

/*
 * LiveQuestion
 * ------------------------------------------------------------
 * A question a student asks during a YouTube-provider live class.
 * Others upvote it; the tutor pins it or marks it answered.
 */
const liveQuestionSchema = new mongoose.Schema(
    {
        session: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        name: { type: String, trim: true, default: "Student" },
        avatar: { type: String, default: null },
        text: { type: String, required: true, trim: true, maxlength: 300 },
        upvoters: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
        answered: { type: Boolean, default: false },
        pinned: { type: Boolean, default: false },
    },
    { timestamps: true, collection: "livequestions" }
);

liveQuestionSchema.index({ session: 1, createdAt: -1 });

module.exports =
    mongoose.models.LiveQuestion ||
    mongoose.model("LiveQuestion", liveQuestionSchema);
