const mongoose = require('mongoose');

const courseSubmittion = new mongoose.Schema({
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'tutors' },

    courseTitle: { type: String, required: true },
    description: { type: String, required: true },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    statusMessage: { type: String, default: '' }

}, { timestamps: true });

module.exports = mongoose.model('CourseSubmission', courseSubmittion);