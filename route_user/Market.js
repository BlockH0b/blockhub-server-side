const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/user');
const Product = require('../models/Product');
require('dotenv').config();
const Seller = require('../models/Seller');


// Endpoint to get all courses
// PUBLIC: Get all published products
router.get("/products", async (req, res) => {
    try {
        const products = await Product.find({
            status: "published",
            visibility: "public",
        })
            .populate({
                path: "seller",
                populate: {
                    path: "user",
                    select: "fullName twitterHandle profileImage bio",
                },
            })
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: products,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// PUBLIC: Get single product
// PUBLIC: Get single product by slug
router.get("/product/:slug", async (req, res) => {
    try {
        const { slug } = req.params;

        const product = await Product.findOne({
            slug,
            status: "published",
            visibility: "public",
        }).populate({
            path: "seller",
            populate: {
                path: "user",
                select: "fullName twitterHandle profileImage bio",
            },
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.json({
            success: true,
            data: product,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// PUBLIC: Get all sellers
router.get("/sellers", async (req, res) => {
    try {
        const sellers = await Seller.find()
            .populate({
                path: "user",
                select:
                    "fullName twitterHandle profileImage bio followersCount followingCount isVerified",
            })
            .sort({ totalSales: -1 });

        return res.status(200).json({
            success: true,
            count: sellers.length,
            data: sellers,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});



module.exports = router;