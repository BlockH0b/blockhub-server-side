const mongoose = require("mongoose");

const cohortAccessTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: true,
            index: true,
        },

        registration: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CohortRegistration",
            required: true,
            index: true,
        },

        cohort: {
            type: String,
            required: true,
            default: "cohort-1.0",
            index: true,
        },

        tokenId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        used: {
            type: Boolean,
            default: false,
        },

        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
        collection: "cohortaccesstokens",
    }
);

// Automatically remove expired access-token records
cohortAccessTokenSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports =
    mongoose.models.CohortAccessToken ||
    mongoose.model(
        "CohortAccessToken",
        cohortAccessTokenSchema
    );
