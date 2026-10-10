const express = require("express");
const router = express.Router();
const HKMAIL = require("../models/HKMAIL");

// Subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const existing = await HKMAIL.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "You're already subscribed.",
      });
    }

    const subscriber = await HKMAIL.create({
      email: email.toLowerCase().trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Subscription successful.",
      subscriber,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
});

module.exports = router;