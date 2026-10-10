const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    bio: {
      type: String,
      default: "",
    },

    sellerCode: {
      type: String,
      unique: true,
    },

    level: {
      type: String,
      default: "Beginner",
    },

    skills: [
      {
        type: String,
      },
    ],

    productsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
         ref: "Product",
      },
    ],

    // 💰 Revenue
    earnings: {
      type: Number,
      default: 0,
    },

    pendingEarnings: {
      type: Number,
      default: 0,
    },

    withdrawnEarnings: {
      type: Number,
      default: 0,
    },

    // 📦 Products
    totalActiveProducts: {
      type: Number,
      default: 0,
    },

    totalDraftProducts: {
      type: Number,
      default: 0,
    },

    // 🛒 Sales
    totalSales: {
      type: Number,
      default: 0,
    },

    activeSales: {
      type: Number,
      default: 0,
    },

    completedSales: {
      type: Number,
      default: 0,
    },

    // 👥 Customers
    totalCustomers: {
      type: Number,
      default: 0,
    },

    totalDownloads: {
      type: Number,
      default: 0,
    },

    averageRating: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "sellers",
  }
);
module.exports = mongoose.model("Seller", sellerSchema);