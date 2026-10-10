const mongoose = require('mongoose')

const adminSchema = new mongoose.Schema({
    name: String,
    password: String,
    email: String,
    otp: String,
    otpTime: Date
}, { collection: 'admins' })

module.exports = mongoose.model('Admin', adminSchema);
