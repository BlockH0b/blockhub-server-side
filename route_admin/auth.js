const Admin = require('../models/admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express')
const route = express.Router()
const crypto = require('crypto');
const { sendOTP } = require('../utils/nodemailer');
// const sendOTP = require('../utils/nodemailer');



route.post('/signup', async(req, res) => {
    const { username, email, password } = req.body;

    try {
        const exists = await Admin.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = new Admin({ username, email, password: hashedPassword });
        await admin.save();

        res.status(201).json({ message: 'Admin created successfully', admin });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
})

route.post('/login', async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json('Please fill in the correct details');
    }

    try {
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        // Generate 6-digit OTP using crypto
        const otp = crypto.randomInt(10000, 99999).toString();
        const otpTime = new Date();

        // Save OTP and timestamp in DB
        admin.otp = otp;
        admin.otpTime = otpTime;
        await admin.save();
        // sendOTP(email, otp);
        sendOTP(email, otp)

        // Generate JWT
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '2d' });

        res.status(200).json({
            message: 'Login successful, OTP sent',
            token,
            // otp, // in production you would email or SMS this, not expose it in response
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
})

route.post('/verify-otp', async(req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    try {
        const admin = await Admin.findOne({ email });
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        // Check if OTP matches and is not expired (e.g., valid for 10 minutes)
        const now = new Date();
        const expiry = new Date(admin.otpTime);
        expiry.setMinutes(expiry.getMinutes() + 10);

        if (admin.otp !== otp) {
            return res.status(401).json({ message: 'Invalid OTP' });
        }

        if (now > expiry) {
            return res.status(401).json({ message: 'OTP has expired' });
        }

        // OTP is valid
        admin.otp = null; // Clear OTP after use
        admin.otpTime = null;
        await admin.save();

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});



module.exports = route