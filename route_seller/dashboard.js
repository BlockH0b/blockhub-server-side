const express = require("express");
const router = express.Router();


const Seller = require("../models/Seller");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const auth = require("../middlewave/auth");

router.get("/seller_stats", auth, async (req, res) => {
    try {
        const user = req.user;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found",
            });
        }

        const products = await Product.find({
            seller: seller._id,
        });

        const totalProducts = products.length;

        const totalActiveProducts = products.filter(
            product => product.status === "published"
        ).length;

        const totalDraftProducts = products.filter(
            product => product.status === "draft"
        ).length;

        const totalSales = products.reduce(
            (sum, product) => sum + (product.totalSales || 0),
            0
        );

        const totalDownloads = products.reduce(
            (sum, product) => sum + (product.totalDownloads || 0),
            0
        );

        const totalViews = products.reduce(
            (sum, product) => sum + (product.totalViews || 0),
            0
        );

        const totalLikes = products.reduce(
            (sum, product) => sum + (product.totalLikes || 0),
            0
        );

        return res.status(200).json({
            success: true,
            totalProducts,
            totalActiveProducts,
            totalDraftProducts,
            totalSales,
            totalDownloads,
            totalViews,
            totalLikes,
            products,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
});

router.get("/seller_sales_chart", auth, async (req, res) => {
    try {
        const user = req.user;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found",
            });
        }

        const purchases = await Purchase.find({
            seller: seller._id,
            paymentStatus: "paid",
        });

        const period = req.query.period || "month";

        const sales = {};

        purchases.forEach(purchase => {
            const date = new Date(purchase.purchasedAt);

            let key;

            if (period === "month") {
                key = date.toLocaleString("default", {
                    month: "short",
                    year: "numeric",
                });
            } else if (period === "year") {
                key = date.getFullYear().toString();
            } else {
                key = "Overall";
            }

            sales[key] = (sales[key] || 0) + purchase.amount;
        });

        const chartData = Object.keys(sales).map(key => ({
            month: key,
            sales: sales[key],
        }));

        return res.status(200).json({
            success: true,
            chartData,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

router.get("/my_products", auth, async (req, res) => {
    try {
        const user = req.user;

        const seller = await Seller.findById(user.sellerProfile);

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found",
            });
        }

        const products = await Product.find({
            seller: seller._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            products,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

module.exports = router;