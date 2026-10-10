const mongoose = require("mongoose");

const campaignParticipantSchema = new mongoose.Schema(
{
    campaign:                       { type: mongoose.Schema.Types.ObjectId, ref: "campaigns", required: true },

    project:                        { type: mongoose.Schema.Types.ObjectId, ref: "projects", required: true },

    user:                           { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    joinedAt:                       { type: Date, default: Date.now },

    completedTasks:                 { type: Number, default: 0 },

    totalTasks:                     { type: Number, default: 0 },

    rewardEarned:                   { type: Number, default: 0 },

    rewardClaimed:                  { type: Boolean, default: false },

    status:                         {
                                        type: String,
                                        enum: [
                                            "joined",
                                            "active",
                                            "completed",
                                            "rewarded",
                                            "disqualified"
                                        ],
                                        default: "joined",
                                     },
        },
            {
                timestamps: true,
                collection: "campaignParticipants",
        }
);

module.exports = mongoose.model("campaignParticipants", campaignParticipantSchema);