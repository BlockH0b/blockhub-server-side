// models/telegramConnection.js

const mongoose = require("mongoose");

const telegramConnectionSchema = new mongoose.Schema(
    {
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },

        telegramId: {
            type: String,
            required: true,
        },

        telegramUsername: {
            type: String,
            default: null,
        },

        telegramFirstName: {
            type: String,
            default: null,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        used: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

telegramConnectionSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports =
    mongoose.models.telegramConnection ||
    mongoose.model(
        "telegramConnection",
        telegramConnectionSchema
    );