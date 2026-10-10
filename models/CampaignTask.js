const mongoose = require("mongoose");

const campaignTaskSchema = new mongoose.Schema(
{
    campaign:                   { type: mongoose.Schema.Types.ObjectId, ref: "campaigns", required: true },

    project:                    { type: mongoose.Schema.Types.ObjectId, ref: "projects", required: true },

    title:                      { type: String, required: true },

    description:                { type: String, default: "" },

    type:                       {
                                    type: String,
                                    enum: [
                                        "follow",
                                        "like",
                                        "retweet",
                                        "comment",
                                        "quote",
                                        "tweet",
                                        "visit",
                                        "discord",
                                        "telegram",
                                        "wallet",
                                        "upload",
                                        "custom"
                                    ],
                                    required: true,
                                },

    url:                        { type: String, default: "" },

    points:                     { type: Number, default: 0 },

    required:                   { type: Boolean, default: true },

    order:                      { type: Number, default: 1 },

    reward:                     {
                                    amount: {type:Number,default: 0},
                                    currency: {type: String, enum: ["USDT","BNB","ETH","AVAX","POINTS"], default: "USDT"}
                                },

    verification:               {
                                        type: String,
                                        enum: ["automatic", "manual"],
                                        default: "manual",
                                 },

    status:                      {
                                     type: String,
                                     enum: ["active", "disabled"],
                                     default: "active",
                                 },
        },
        {
            timestamps: true,
            collection: "campaignTasks",
        }
);

module.exports = mongoose.model("campaignTasks", campaignTaskSchema);