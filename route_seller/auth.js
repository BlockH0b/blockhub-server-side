const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Seller = require("../models/Seller");
const Product = require("../models/Product");
const sanitizeUser = require("../utils/sanitizeUser");
const sanitizeSeller = require("../utils/sanitizeSeller");
const auth = require("../middlewave/auth");



// Generate tutor code
function generateSellerCode() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SEL${random}`;
}



router.get("/me", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.isSeller || !user.sellerProfile) {
      return res.status(200).json({
        success: true,
        isSeller: false,
        seller: null,
        allProducts: [],
        user: sanitizeUser(user),
      });
    }

    const seller = await Seller.findById(user.sellerProfile)
      .populate("productsCreated");

    const allProducts = await Product.find({
      seller: seller._id,
    });

    return res.status(200).json({
      success: true,
      isSeller: true,
      seller: sanitizeSeller(seller),
      allProducts,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
router.post("/activate", auth, async (req, res) => {
  try {
    const user = req.user;

    let seller;

    if (user.isSeller && user.sellerProfile) {
      seller = await Seller.findById(user.sellerProfile)
        .populate("productsCreated");
    } else {
      seller = await Seller.create({
        user: user._id,
        sellerCode: generateSellerCode(),
      });

      user.isSeller = true;
      user.sellerProfile = seller._id;

      await user.save();

      seller = await Seller.findById(seller._id)
        .populate("productsCreated");
    }

    const allProducts = await Product.find({
      seller: seller._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      seller: sanitizeSeller(seller),
      user: sanitizeUser(user),
      allProducts,
      isSeller: true,
      message: user.isSeller
        ? "Seller account activated."
        : "Seller already activated.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


module.exports = router;