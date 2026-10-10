const express = require('express');
const Payment = require('../models/payment');
const User = require('../models/user');
const user = require('../models/user');
const { sendSuccessMessage } = require('../utils/nodemailer');
const notify = require('../services/email/notify');

const axios = require("axios");
const crypto = require("crypto");


const Course = require("../models/Course");
const Purchase = require("../models/Purchase");
const Enrollment = require("../models/Enrollment");
const auth = require('../middlewave/auth');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Tutor = require('../models/Tutor');

// Create new payment
const router = express.Router();

// Last good USD -> NGN rate, so a flaky FX API doesn't break checkout
let lastGoodNgnRate = null;

async function fetchFXRates() {
    try {
        const res = await axios.get(
            "https://open.er-api.com/v6/latest/USD",
            { timeout: 5000 }
        );

        const ngnRate = res.data?.rates?.NGN;

        if (!ngnRate) throw new Error("NGN rate missing from FX API");

        lastGoodNgnRate = ngnRate;
        return ngnRate;
    } catch (err) {
        console.log("⚠️ FX fetch failed:", err.message);

        // Fallback: last good rate, else a safe default.
        // (This used to call two functions that didn't exist, so a failed
        // FX request crashed the whole checkout instead of falling back.)
        const fallback = lastGoodNgnRate || Number(process.env.USD_NGN_FALLBACK_RATE) || 1500;

        console.log(`🟡 USING FALLBACK USD → NGN = ${fallback}`);

        return fallback;
    }
}




router.get("/use_token/:token", async (req, res) => {
    const { token } = req.params;

    const payment = await Payment.findOne({ token });

    if (!payment) return res.status(404).send("Invalid link");
    if (payment.tokenUsed) return res.status(400).send("Link already used");
    if (payment.expiresAt < new Date()) return res.status(400).send("Link expired");


    payment.tokenUsed = true;
    await payment.save();

    // redirect user to the actual booking link stored in DB
    if (payment.bookingLink) {
        return res.redirect(payment.bookingLink);
    } else {
        return res.status(400).send("No booking link found for this payment.");
    }
});

router.post('/create_payment', async (req, res) => {
    try {
        let { name, email, is_call_payment, username, product_id, product_title, product_price } = req.body;

        if (!name || !email || is_call_payment === undefined || !username || !product_id || !product_title || !product_price) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // ✅ Lowercase and trim the username
        username = username.toLowerCase().trim();

        // ✅ Check if the Twitter handle already exists in Users
        // const existingUser = await user.findOne({ twitterHandle: username });
        // if (existingUser) {
        //     return res.status(400).json({ message: 'This Twitter handle is already registered.' });
        // }

        // Booking link logic for call payments
        let bookingLink = "";
        if (is_call_payment && product_title.includes("30")) {
            bookingLink = "https://calendly.com/block-hub-mailer/30min";
        } else if (is_call_payment && product_title.includes("45")) {
            bookingLink = "https://calendly.com/block-hub-mailer/new-meeting";
        }

        const payment = new Payment({
            name,
            email,
            username,
            product_id,
            is_call_payment,
            product_title,
            product_price,
            bookingLink,
            status: false
        });

        await payment.save();

        res.status(201).json({
            message: 'Payment record created successfully',
            data: payment
        });
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/mark_as_paid', async (req, res) => {
    try {
        const { name, paymentId } = req.body;

        // 1️⃣ Find and mark payment as paid
        const payment = await Payment.findOneAndUpdate(
            { _id: paymentId },
            { status: true },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found.' });
        }

        // 2️⃣ Find user by twitterHandle (username in payment)
        let Iuser = await user.findOne({ twitterHandle: payment.username });

        if (Iuser) {
            // ✅ Mark template as bought
            Iuser.template_bought = true;

            // Optional: update handle if not already correct
            if (payment.username && Iuser.twitterHandle !== payment.username) {
                Iuser.twitterHandle = payment.username;
            }

            await Iuser.save();
        } else {
            console.warn(`⚠️ No user found with handle ${payment.username}`);
        }

        // 3️⃣ Decide link to send
        let linkToSend;
        if (payment.is_call_payment) {
            const token = crypto.randomBytes(24).toString("hex");
            payment.token = token;
            payment.tokenUsed = false;
            payment.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await payment.save();

            linkToSend = `https://blockhub-server.onrender.com/user_payment/use_token/${token}`;
        } else if (payment.product_id === "kit_9f3a7c1b82d4") {
            linkToSend = "https://chat.whatsapp.com/HMKMLZpcDoU7K5kfl9ABy7";
        } else {
            linkToSend = "https://chat.whatsapp.com/DZGDVVInnjc1M1nQsfgh7y";
        }

        // 4️⃣ Send success email
        await sendSuccessMessage(payment.email, name, linkToSend);

        return res.status(200).json({
            message: 'Payment marked as paid, user updated, email sent',
            payment,
            user: Iuser
        });

    } catch (err) {
        console.error("❌ Error in mark_as_paid:", err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Naira payment initialization
router.post("/course_payment_initialize", auth, async (req, res) => {
    try {

        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            });
        }

        // Find course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        const originalAmount = course.pricing.amount;
        const currency = course.pricing.currency;

        let convertedAmount = originalAmount;
        let exchangeRate = null;

        // Only convert if course is priced in USDT/USD
        if (currency === "USDT" || currency === "USD") {
            exchangeRate = await fetchFXRates();
            convertedAmount = originalAmount * exchangeRate;
        }

        // Platform fee (10%)
        const platformFee = convertedAmount * 0.10;

        // Amount customer pays
        const finalAmount = Math.round(convertedAmount + platformFee);

        // Already enrolled?
        const already = await Enrollment.findOne({
            user: req.user._id,
            course: course._id
        });

        // if (already) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Already enrolled"
        //     });
        // }

        // Free Course
        if (course.pricing.type === "free") {

            const enrollment = await Enrollment.create({
                user: req.user._id,
                course: course._id,
                totalLessons: course.lessons.length,
                progress: 0,
                completed: false,
                completedLessons: []
            });


            await Purchase.create({
                user: req.user._id,
                item: course._id,
                itemType: "courses",
                seller: course.tutor,
                sellerType: "tutors",
                course: course._id,
                tutor: course.tutor,
                amount: 0,
                platformFee: 0,
                tutorAmount: 0,
                currency: "NGN",
                paymentMethod: "paystack",
                paymentStatus: "paid",
                paymentReference: `FREE_${Date.now()}`
            });

            await User.findByIdAndUpdate(req.user._id, {
                $inc: {
                    totalCoursesBought: 1
                }
            });

            return res.json({
                success: true,
                free: true,
                enrollment
            });

        }

        const amount = course.pricing.amount;

        const reference =
            `BH_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // Save purchase
        const purchase = await Purchase.create({

            user: req.user._id,

            item: course._id,
            itemType: "courses",

            seller: course.tutor,
            sellerType: "tutors",

            platformFee,

            tutor: course.tutor,
            amount: finalAmount,

            course: course._id,
            currency: "NGN",
            tutorAmount: convertedAmount,


            paymentMethod: "paystack",

            paymentReference: reference,

            paymentStatus: "pending"

        });

        // Initialize Paystack

        const response = await axios.post(

            "https://api.paystack.co/transaction/initialize",

            {

                email: req.user.email,

                amount: finalAmount * 100,

                currency: "NGN",

                reference,

                callback_url:
                    `${process.env.FRONTEND_URL}/payment/success`

            },

            {

                headers: {

                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

                    "Content-Type": "application/json"

                }

            }

        );

        return res.json({
            success: true,

            pricing: {
                originalAmount,
                originalCurrency: currency,

                exchangeRate, // null if no conversion happened

                convertedAmount,
                platformFee,
                total: finalAmount,

                payableCurrency: "NGN"
            },

            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference
        });
    }

    catch (err) {

        console.log(err.response?.data || err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// Naira payment verification
router.get("/course_payment_verify", auth, async (req, res) => {
    try {

        const { reference } = req.query;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference is required"
            });
        }

        // Find purchase
        const purchase = await Purchase.findOne({
            paymentReference: reference,
            user: req.user._id,
            itemType: "courses"
        });

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        // Prevent duplicate verification
        if (purchase.paymentStatus === "paid") {

            const enrollment = await Enrollment.findOne({
                user: req.user._id,
                course: purchase.item
            });

            return res.json({
                success: true,
                alreadyVerified: true,
                enrollment
            });

        }

        // Verify with Paystack

        const verify = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const payment = verify.data.data;

        if (payment.status !== "success") {

            purchase.paymentStatus = "failed";
            await purchase.save();

            notify.paymentFailed(purchase, await Course.findById(purchase.item).select("name").lean());

            return res.status(400).json({
                success: false,
                message: "Payment not successful"
            });

        }

        purchase.paymentStatus = "paid";
        purchase.transactionHash = payment.reference;

        await purchase.save();

         const updatedUser = await user.findByIdAndUpdate(
            purchase.user,
            {
                $inc: {
                    totalPurchases: 1,
                    totalSpent: purchase.amount
                }
            },
            { new: true }
        );

        await Tutor.findByIdAndUpdate(
            purchase.seller,
            {
                $inc: {
                    pendingEarnings: purchase.tutorAmount,
                    totalStudents: 1
                }
            }
        );

        // Get course

        const course = await Course.findById(purchase.item);

        // Create enrollment if missing

        let enrollment = await Enrollment.findOne({
            user: req.user._id,
            course: purchase.item
        });

        if (!enrollment) {

            enrollment = await Enrollment.create({

                user: req.user._id,

                course: purchase.item,

                totalLessons: course.lessons.length,

                progress: 0,

                completed: false,

                completedLessons: []

            });

            await Course.findByIdAndUpdate(
                course._id,
                {
                    $inc: {
                        totalEnrollments: 1
                    }
                }
            );

        }

        notify.purchaseCompleted(purchase, course);

        return res.json({

            success: true,

            message: "Payment verified",

            purchase,

            enrollment

        });

    } catch (err) {

        console.log(err.response?.data || err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }
});

router.post("/course_crypto_initialize", auth, async (req, res) => {
    try {

        const { courseId, paymentMethod } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required"
            });
        }

        if (!["usdt", "bnb"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method"
            });
        }

        // Find course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        // Already enrolled?
        const already = await Enrollment.findOne({
            user: req.user._id,
            course: course._id
        });

        // Uncomment if you want to prevent duplicate purchases
        /*
        if (already) {
            return res.status(400).json({
                success: false,
                message: "Already enrolled"
            });
        }
        */

        // Free course
        if (course.pricing.type === "free") {

            const enrollment = await Enrollment.create({
                user: req.user._id,
                course: course._id,
                totalLessons: course.lessons.length,
                progress: 0,
                completed: false,
                completedLessons: []
            });

            return res.json({
                success: true,
                free: true,
                enrollment
            });

        }

        const originalAmount = Number(course.pricing.amount);
        const originalCurrency = course.pricing.currency;

        let exchangeRate = null;
        let cryptoAmount = originalAmount;

        /**
         * Convert to selected crypto
         */

        if (paymentMethod === "usdt") {

            if (originalCurrency === "NGN") {

                // fetchFXRates() should return NGN per USD
                // Example: 1 USD = 1580 NGN

                exchangeRate = await fetchFXRates();

                cryptoAmount =
                    originalAmount / exchangeRate;

            }

            else if (
                originalCurrency === "USD" ||
                originalCurrency === "USDT"
            ) {

                cryptoAmount = originalAmount;

            }

        }

        else if (paymentMethod === "bnb") {

            // We'll implement this after USDT
            return res.status(400).json({
                success: false,
                message: "BNB payment is coming soon."
            });

        }

        // Platform fee (10%)
        const platformFee = cryptoAmount * 0.10;

        // Total payable
        const payableAmount =
            Number((cryptoAmount + platformFee).toFixed(6));

        // Generate unique payment reference
        const reference =
            `BH_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // Save purchase
        await Purchase.create({

            user: req.user._id,

            tutor: course.tutor,

            course: course._id,

            amount: payableAmount,

            currency: paymentMethod.toUpperCase(),

            paymentMethod: "crypto",

            paymentReference: reference,

            paymentStatus: "pending"

        });

        return res.json({

            success: true,

            paymentMethod,

            wallet: process.env.CRYPTO_PAYMENT_WALLET,

            reference,

            pricing: {

                originalAmount,

                originalCurrency,

                exchangeRate,

                cryptoAmount:
                    Number(cryptoAmount.toFixed(6)),

                platformFee:
                    Number(platformFee.toFixed(6)),

                payableAmount,

                payableCurrency:
                    paymentMethod.toUpperCase()

            }

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

router.post("/product_payment_initialize", auth, async (req, res) => {
    try {

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (
            product.status !== "published" ||
            product.visibility !== "public"
        ) {
            return res.status(400).json({
                success: false,
                message: "Product unavailable"
            });
        }

        const alreadyPurchased = await Purchase.findOne({
            buyer: req.user._id,
            product: product._id,
            paymentStatus: "paid"
        });

        if (alreadyPurchased) {
            return res.status(400).json({
                success: false,
                message: "You already own this product."
            });
        }

        // FREE PRODUCT
        if (product.pricing.type === "free") {

            const purchase = await Purchase.create({
                user: req.user._id,
                seller: product.seller,
                sellerType: "Seller",
                item: product._id,
                itemType: "Product",
                amount: 0,
                itemAmount: 0,
                platformFee: 0,
                sellerAmount: 0,
                currency: "FREE",
                paymentMethod: "free",
                paymentStatus: "paid"
            });

            await Product.findByIdAndUpdate(product._id, {
                $inc: {
                    totalDownloads: 1
                }
            });

            notify.purchaseCompleted(purchase, product);

            return res.json({
                success: true,
                free: true,
                purchase
            });
        }

        const originalAmount = product.pricing.amount;
        const currency = product.pricing.currency;

        let convertedAmount = originalAmount;
        let exchangeRate = null;

        if (currency === "USDT" || currency === "USD") {
            exchangeRate = await fetchFXRates();
            convertedAmount = originalAmount * exchangeRate;
        }

        const platformFee = convertedAmount * 0.10;

        const finalAmount = Math.round(
            convertedAmount + platformFee
        );

        const reference =
            `BH_PRODUCT_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const purchase = await Purchase.create({
            user: req.user._id,
            seller: product.seller,
            sellerType: "Seller",
            item: product._id,
            itemType: "Product",
            amount: finalAmount,
            itemAmount: convertedAmount,
            platformFee,
            sellerAmount: convertedAmount,
            currency: "NGN",
            paymentMethod: "paystack",
            paymentReference: reference,
            paymentStatus: "pending"
        });

        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email: req.user.email,
                amount: finalAmount * 100,
                currency: "NGN",
                reference,
                callback_url: `${process.env.FRONTEND_URL}/product/payment/success`
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.json({
            success: true,
            pricing: {
                originalAmount,
                originalCurrency: currency,
                exchangeRate,
                convertedAmount,
                platformFee,
                total: finalAmount,
                payableCurrency: "NGN"
            },
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference
        });

    } catch (err) {

        console.log(err.response?.data || err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
});

router.get("/product_payment_verify", auth, async (req, res) => {
    try {

        const { reference } = req.query;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference is required"
            });
        }

        const purchase = await Purchase.findOne({
            itemType: "Product",
            paymentReference: reference,
            user: req.user._id
        }).populate("item");

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        if (purchase.paymentStatus === "paid") {
            return res.json({
                success: true,
                alreadyVerified: true,
                purchase
            });
        }

        const verify = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const payment = verify.data.data;

        if (payment.status !== "success") {

            purchase.paymentStatus = "failed";
            await purchase.save();

            notify.paymentFailed(purchase, purchase.item);

            return res.status(400).json({
                success: false,
                message: "Payment not successful"
            });

        }

        purchase.paymentStatus = "paid";
        purchase.transactionHash = payment.reference;

        await purchase.save();

        await Product.findByIdAndUpdate(
            purchase.item,
            {
                $inc: {
                    totalSales: 1,
                    totalDownloads: 1
                }
            }
        );

        await Seller.findByIdAndUpdate(
            purchase.seller,
            {
                $inc: {
                    pendingEarnings: purchase.sellerAmount,
                    totalSales: 1
                }
            }
        );

        const updatedUser = await user.findByIdAndUpdate(
            purchase.user,
            {
                $inc: {
                    totalPurchases: 1,
                    totalSpent: purchase.amount
                }
            },
            { new: true }
        );

        notify.purchaseCompleted(purchase, purchase.item);

        return res.json({
            success: true,
            message: "Payment verified",
            purchase
        });

    } catch (err) {

        console.log(err.response?.data || err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
});

// module.exports = /;


module.exports = router;