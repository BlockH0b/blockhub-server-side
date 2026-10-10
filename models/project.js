const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
{
    owner:                  { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    name:                   { type: String, required: true, trim: true },

    slug:                   { type: String, unique: true, lowercase: true, trim: true },

    description:            { type: String, required: true, maxlength: 500 },

    x:                      {
                                username: { type: String, required: true, lowercase: true, trim: true },
                                profileImage: { type: String, default: "" },
                            },

    banner:                 { type: String, default: "" },

    bannerPublicId:         { type: String, default: "" },

    website:                { type: String, default: "" },

    discord:                { type: String, default: "" },

    telegram:               { type: String, default: "" },

    stats:                  {
                                campaigns: { type: Number, default: 0 },
                                participants: { type: Number, default: 0 },
                                completedTasks: { type: Number, default: 0 },
                                rewardsPaid: { type: Number, default: 0 },
                                activeCampaigns: { type: Number, default: 0 },
                                submissions: { type: Number, default: 0 },
                                views: { type: Number, default: 0 },
                            },

    verified:               { type: Boolean, default: false },

    featured:               { type: Boolean, default: false },

    status:                 {
                                type: String,
                                enum: ["active", "paused", "archived"],
                                default: "active",
                            },
    },
    {
        timestamps: true,
        collection: "projects",
    });

module.exports = mongoose.model("projects", projectSchema);