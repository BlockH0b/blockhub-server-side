const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },

    // Generic purchased item
    item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "itemType",
    },

    itemType: {
        type: String,
        enum: ["courses", "Product"],
        required: true,
    },

    // Generic seller
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "sellerType",
    },

    sellerType: {
        type: String,
        enum: ["tutors", "Seller"],
        required: true,
    },

    amount: Number,             // Customer paid
    itemAmount: Number,         // Original product price
    platformFee: Number,
    sellerAmount: Number,       // Seller receives

    currency: {
        type: String,
        enum: ["NGN", "USDT", "BNB", "FREE"],
        default: "NGN",
    },

    paymentMethod: {
        type: String,
        enum: ["paystack", "crypto", "free"],
        required: true,
    },

    paymentStatus: {
        type: String,
        enum: [
            "pending",
            "paid",
            "failed",
            "refunded",
        ],
        default: "pending",
    },

    paymentReference: String,

    transactionHash: String,

    purchasedAt: {
        type: Date,
        default: Date.now,
    },

}, {
    timestamps: true,
});

module.exports =
    mongoose.models.purchase ||
    mongoose.model("purchase", purchaseSchema);