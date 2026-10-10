const mongoose = require("mongoose");

const campaignSubmissionSchema = new mongoose.Schema(
{
    campaign:                   { type: mongoose.Schema.Types.ObjectId, ref: "campaigns", required: true },

    task:                       { type: mongoose.Schema.Types.ObjectId, ref: "campaignTasks", required: true },

    participant:                { type: mongoose.Schema.Types.ObjectId, ref: "campaignParticipants", required: true },

    user:                       { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    submission:                 {
                                    text: { type: String, default: "" },

                                    url: { type: String, default: "" },

                                    screenshot: { type: String, default: "" },

                                    wallet: { type: String, default: "" },
                                },

    reviewedBy:                 {
                                    type: mongoose.Schema.Types.ObjectId,
                                    ref: "users",
                                    default: null,
                                },

    reviewedAt:                 {   type: Date,  default: null, },

    reviewNote:                 {   type: String,  default: "", },

    status:                     {
                                    type: String,
                                    enum: [
                                        "pending",
                                        "approved",
                                        "rejected"
                                    ],
                                    default: "pending",
                                },
},
    {
        timestamps: true,
        collection: "campaignSubmissions",
    }
);


 


module.exports = mongoose.model("campaignSubmissions", campaignSubmissionSchema);