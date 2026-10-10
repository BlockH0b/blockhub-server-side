
const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
    {
        // The user who shared the referral link
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: true,
            index: true,
        },

        // The user who registered through the referral
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: true,
            unique: true,
            index: true,
        },

        // The referral code that was used
        referralCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },

        // The cohort registration connected to this referral
        cohortRegistration: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CohortRegistration",
            default: null,
            index: true,
        },

        cohort: {
            type: String,
            default: "cohort-1.0",
            index: true,
        },

        // Referral lifecycle
        status: {
            type: String,
            enum: [
                "registered",
                "paid",
                "rewarded",
                "cancelled",
            ],
            default: "registered",
            index: true,
        },

        // Paystack information
        paymentReference: {
            type: String,
            default: null,
            index: true,
        },

        paymentAmount: {
            type: Number,
            default: 0,
        },

        paidAt: {
            type: Date,
            default: null,
        },

        // Referral reward
        rewardAmount: {
            type: Number,
            default: 0,
        },

        rewardStatus: {
            type: String,
            enum: [
                "pending",
                "approved",
                "paid",
                "cancelled",
            ],
            default: "pending",
        },

        rewardPaidAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: "referrals",
    }
);


// Prevent the same user from being referred more than once
referralSchema.index(
    { referredUser: 1 },
    { unique: true }
);


// Useful for dashboard queries
referralSchema.index({
    referrer: 1,
    status: 1,
});


// Useful for finding referrals by payment
referralSchema.index({
    paymentReference: 1,
});


module.exports =
    mongoose.models.Referral ||
    mongoose.model("Referral", referralSchema);

