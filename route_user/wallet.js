// SPDX-License-Identifier: MIT
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const payment = require('../models/payment');
const { TwitterApi } = require('twitter-api-v2');
const twitterOAuth = require('../models/twitterOAuth');
const User = require('../models/user');
const auth = require('../middlewave/auth');
const sanitizeUser = require('../utils/sanitizeUser');
const router = express.Router();
const crypto = require("crypto");
const MobileAuthToken = require("../models/mobileAuthToken");
const mobileAuthToken = require('../models/mobileAuthToken');
const setAuthCookie = require('../utils/setAuthCookie');


router.post("/connect-wallet", auth, async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: "Wallet address required"
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                walletAddress
            },
            {
                new: true
            }
        );

        res.json({
            success: true,
            user: sanitizeUser(user)
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post("/disconnect-wallet", auth, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    walletAddress: 1
                }
            },
            {
                new: true
            }
        );

        res.json({
            success: true,
            message: "Wallet disconnected",
            user: sanitizeUser(user)
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


router.post("/generate_wallet_token", auth, async (req, res) => {
    try {
        const token = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

        await mobileAuthToken.create({
            userId: req.user._id,
            token,
            expiresAt
        })

        res.json({
            success: true,
            token,
            expiresAt
        })
    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message,
        });

    }

})

router.post("/wallet_login", async (req, res) => {
    try {

        const { token } = req.body;

        const mobileToken =
            await mobileAuthToken.findOne({
                token
            });

        if (!mobileToken) {
            return res.status(401).json({
                success: false
            });
        }

        const user =
            await User.findById(
                mobileToken.userId
            );

        if (!user) {
            return res.status(404).json({
                success: false
            });
        }

        const authToken = jwt.sign(
            {
                id: user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        setAuthCookie(
            res,
            authToken
        );

        await mobileAuthToken.deleteOne({
            _id: mobileToken._id
        });

        console.log("SETTING COOKIE FOR:", user._id);
        console.log("AUTH TOKEN:", authToken);

        return res.json({
            success: true,
            user: sanitizeUser(user)
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
});


module.exports = router;
