require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('../confiq/userPassword');
const axios = require('axios');
const user = require('../models/user');
// const axios = require('axios');
const payment = require('../models/payment');
const uploader = require('../utils/multer')
const router = express.Router();
const cloudinary = require('../utils/cloudinary');
const auth = require('../middlewave/auth');



router.post('/get_user_interest', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) return res.status(401).json({ message: 'Token is required' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const Iuser = await user.findById(userId)

        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        return res.status(200).json({ interests: Iuser.interest });
    } catch (error) {
        console.error('Error fetching user interests:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});


router.post('/edit_interest', async (req, res) => {
    const { token, interest } = req.body;

    if (!token || !interest) {
        return res.status(400).json({ message: 'Token and interest are required' });
    }

    try {
        // Decode the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Update interest
        const updatedUser = await user.findByIdAndUpdate(
            userId, { $set: { interest } }, { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Interest updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Get all portfolio for a user
router.post('/get_portfolio', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const Iuser = await user.findById(decoded.id);
        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        return res.json({
            portfolios: Iuser.portfolioUrl.map((url, i) => ({
                url,
                publicId: Iuser.portfolioPublicId[i] || null
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving portfolios' });
    }
});


// ADD / UPLOAD PORTFOLIO
router.post('/add_portfolio', uploader.single('file'), async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const Iuser = await user.findById(decoded.id);
        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        // Fix old data if it’s still stored as a string
        if (!Array.isArray(Iuser.portfolioUrl)) {
            Iuser.portfolioUrl = Iuser.portfolioUrl ? [Iuser.portfolioUrl] : [];
        }
        if (!Array.isArray(Iuser.portfolioPublicId)) {
            Iuser.portfolioPublicId = Iuser.portfolioPublicId ? [Iuser.portfolioPublicId] : [];
        }


        // Save this type change first
        await Iuser.save();

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'portfolios'
        });

        // Save to DB
        Iuser.portfolioUrl.push(result.secure_url);
        Iuser.portfolioPublicId.push(result.public_id);
        Iuser.portfolio = true;
        await Iuser.save();

        res.json({
            message: 'Portfolio uploaded successfully',
            portfolios: Iuser.portfolioUrl.map((url, i) => ({
                url,
                publicId: Iuser.portfolioPublicId[i] || null
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error uploading portfolio' });
    }
});


// POST /user_profile/portfolios/select
// POST /user_profile/portfolios/select
router.post('/portfolios/select', async (req, res) => {
    const { token, portfolioId } = req.body;
    if (!token || !portfolioId) {
        return res.status(400).json({ message: 'Token and portfolioId are required' });
    }

    try {
        // Verify token and get user
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const Iuser = await user.findById(decoded.id);
        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        // --- Ensure arrays exist and fix old data ---
        if (!Array.isArray(Iuser.portfolioUrl)) {
            Iuser.portfolioUrl = Iuser.portfolioUrl ? [Iuser.portfolioUrl] : [];
        }
        if (!Array.isArray(Iuser.portfolioPublicId)) {
            Iuser.portfolioPublicId = Iuser.portfolioPublicId ? [Iuser.portfolioPublicId] : [];
        }

        // Save this type change if it was fixed
        await Iuser.save();

        // --- Check for portfolio existence ---
        const index = Iuser.portfolioPublicId.findIndex(id => id.toString() === portfolioId);
        if (index === -1) {
            return res.status(404).json({ message: 'Portfolio not found' });
        }

        // --- Reorder so the selected portfolio is first ---
        const selectedUrl = Iuser.portfolioUrl.splice(index, 1)[0];
        const selectedPublicId = Iuser.portfolioPublicId.splice(index, 1)[0];

        // Put the selected portfolio at the start
        Iuser.portfolioUrl.unshift(selectedUrl);
        Iuser.portfolioPublicId.unshift(selectedPublicId);

        await Iuser.save();

        res.json({
            message: 'Primary portfolio updated',
            portfolioUrl: Iuser.portfolioUrl,
            portfolioPublicId: Iuser.portfolioPublicId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error setting primary portfolio' });
    }
});


// DELETE PORTFOLIO
router.post('/delete_portfolio', async (req, res) => {
    const { token, publicId } = req.body;
    if (!token || !publicId) {
        return res.status(400).json({ message: 'Token and publicId are required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const Iuser = await user.findById(decoded.id);
        if (!Iuser) return res.status(404).json({ message: 'User not found' });

        // Remove from Cloudinary
        await cloudinary.uploader.destroy(publicId);

        // Remove from DB arrays
        const index = Iuser.portfolioPublicId.indexOf(publicId);
        if (index > -1) {
            Iuser.portfolioUrl.splice(index, 1);
            Iuser.portfolioPublicId.splice(index, 1);
        }

        // If no portfolios left, mark portfolio as false
        if (Iuser.portfolioUrl.length === 0) {
            Iuser.portfolio = false;
        }

        await Iuser.save();

        res.json({
            message: 'Portfolio deleted successfully',
            portfolios: Iuser.portfolioUrl.map((url, i) => ({
                url,
                publicId: Iuser.portfolioPublicId[i] || null
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting portfolio' });
    }
});

router.get('/getBanks', async (req, res) => {
    try {
        const response = await axios.get(
            "https://api.paystack.co/bank",
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        return res.json({
            success: true,
            banks: response.data.data,
        });

    } catch (error) {
        console.log(error.response?.data || error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch banks",
        });
    }
})

router.post('/resolve_account', async (req, res) => {
    try {

        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            return res.status(400).json({
                success: false,
                message: "Account number and bank code are required."
            });
        }

        const response = await axios.get(
            `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        return res.json({
            success: true,
            account: response.data.data
        });

    } catch (err) {

        return res.status(400).json({
            success: false,
            message:
                err.response?.data?.message ||
                "Unable to resolve account."
        });

    }
})

router.post("/save_account", auth, async (req, res) => {
    try {

        const {
            accountNumber,
            bankCode,
        } = req.body;

        if (!accountNumber || !bankCode) {
            return res.status(400).json({
                success: false,
                message: "Account number and bank code are required."
            });
        }

        const User = req.user;

        // Resolve account with Paystack
        const resolved = await axios.get(
            `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            }
        );

        const account = resolved.data.data;

        // Create transfer recipient
        const recipient = await axios.post(
            "https://api.paystack.co/transferrecipient",
            {
                type: "nuban",
                name: account.account_name,
                account_number: account.account_number,
                bank_code: bankCode,
                currency: "NGN",
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                },
            }
        );
        console.log(recipient.data);

        User.nairaAccount = {
            accountNumber: account.account_number,
            accountName: account.account_name,
            bankName: recipient.data.data.details.bank_name,
            bankCode,
            recipientCode: recipient.data.data.recipient_code,
            recipientId: recipient.data.data.id,
            verified: true,
            activatedAt:
                User.nairaAccount?.activatedAt || new Date(),
            updatedAt: new Date(),
        };

        await User.save();

        return res.status(200).json({
            success: true,
            message: "Withdrawal account saved successfully.",
            account: User.nairaAccount,
        });

    } catch (err) {

        console.log(err.response?.data || err);

        return res.status(500).json({
            success: false,
            message:
                err.response?.data?.message ||
                "Unable to save withdrawal account.",
        });

    }
});

router.delete("/disconnect_account", auth, async (req, res) => {

    const user = req.user;

    user.nairaAccount = {
        accountNumber: null,
        accountName: null,
        bankName: null,
        bankCode: null,
        recipientCode: null,
        recipientId: null,
        verified: false,
        activatedAt: null,
        updatedAt: new Date(),
    };

    await user.save();

    res.json({
        success: true,
        message: "Bank account disconnected.",
    });

}
);

module.exports = router