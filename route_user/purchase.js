const express = require("express");
const router = express.Router();

const Purchase = require("../models/Purchase");
const auth = require("../middlewave/auth");

// Get all purchases for the logged-in user
router.get("/my-purchases", auth, async (req, res) => {
    try {
        const purchases = await Purchase.find({
            user: req.user._id,
            paymentStatus: "paid",
        })
            .populate({
                path: "item",
                select:
                    "title slug thumbnail files pricing createdAt description"
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: purchases.length,
            purchases,
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch purchases.",
        });
    }
});

module.exports = router;