const mongoose = require('mongoose');

const waitListSchema = new mongoose.Schema({
    fullName: { type: String },
    email: { type: String, required: true },
    twitterHandle: { type: String },
    courses: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Waitlist', waitListSchema);
