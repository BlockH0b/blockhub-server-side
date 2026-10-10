const mongoose = require("mongoose");

const mobileAuthTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },

    token: {
        type: String,
        required: true,
        unique: true,
    },

    expiresAt: {
        type: Date,
        required: true,
    },

    used: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

mobileAuthTokenSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports =
    mongoose.models.mobileAuthTokens ||
    mongoose.model(
        "mobileAuthTokens",
        mobileAuthTokenSchema
    );