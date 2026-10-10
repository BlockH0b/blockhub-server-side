const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
{
    //-----------------------------------
    // Relationships
    //-----------------------------------

    project:                    { type: mongoose.Schema.Types.ObjectId, ref: "projects", required: true },

    owner:                      { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    //-----------------------------------
    // Basic Information
    //-----------------------------------
    title:                      { type: String, required: true, trim: true },

    slug:                       { type: String, unique: true, lowercase: true, trim: true },

    description:                { type: String, required: true },

    banner:                     { url: String, publicId: String },


    //-----------------------------------
    // Campaign Configuration
    //-----------------------------------

    hashtags:                   [{ type: String }],

    maxParticipants:            { type: Number, default: 0 }, // 0 = unlimited

    startDate:                  { type: Date, required: true },

    endDate:                    { type: Date, required: true },


    //-----------------------------------
    // Campaign Requirement
    //-----------------------------------
    requirements:               {
                                    required: {type: Boolean, default: true},
                                    walletRequired: {type: Boolean, default: false},
                                    submissionUrlRequired: {type: Boolean, default: false},
                                    screenshotRequired: {type: Boolean, default: false},
                                    oneSubmissionPerWallet: {type: Boolean, default: true},
                                    oneSubmissionPerUser: {type: Boolean, default: true},
                                    minFollowers: {type: Number, default: 0},
                                    minAccountAge: {type: Number, default: 0},
                                },

    //-----------------------------------
    // Reward
    //-----------------------------------

    reward:                     {
                                    type: {  type: String, enum: ["fixed", "pool"],  default: "fixed",  },

                                    currency: { type: String, enum: ["USDT", "BNB", "ETH", "AVAX", "POINTS"],    default: "USDT", },

                                    amount: { type: Number, default: 0, },

                                    totalPool: {type: Number,default: 0,},

                                    distributed: {type: Number,default: 0,},

                                    remaining: {type: Number,default: 0,},
                                },

    //-----------------------------------
    // Statistics
    //-----------------------------------

    stats:                      {
                                    participants: { type: Number, default: 0 },

                                    completedTasks: { type: Number, default: 0 },

                                    submissions: { type: Number, default: 0 },

                                    rewardsDistributed: { type: Number, default: 0 },

                                    views: { type: Number, default: 0 },
                                },

    //-----------------------------------
    // Visibility
    //-----------------------------------

    featured:                   { type: Boolean, default: false },

    verified:                   { type: Boolean, default: false },

    //-----------------------------------
    // Status
    //-----------------------------------

    status:                     {
                                    type: String,
                                    enum: [
                                        "draft",
                                        "upcoming",
                                        "active",
                                        "paused",
                                        "completed",
                                        "cancelled",
                                          ],
                                    default: "draft",
                                },
        },
        {
            timestamps: true,
            collection: "campaigns",
        }   
);

module.exports = mongoose.model("campaigns", campaignSchema);