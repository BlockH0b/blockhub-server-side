const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    jobTitle: { type: String, required: true },
    jobType: { type: String },
    candidateRole: { type: String },
    benefit: { type: String },
    compensation: String,
    companyDescription: { type: String },
    skills: { type: [String], default: [] },
    experienceLevel: { type: String },
    web3Area: { type: String },
    tags: { type: [String], default: [] },
    telegramLink: { type: String },
    applicationStart: { type: Date },
    applicationEnd: { type: Date },
    status: { type: String, enum: ['open', 'closed', 'paused'], default: 'open' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    totalApplicants: { type: Number, default: 0 },
    postedAt: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'jobs'
});

module.exports = mongoose.model('Job', jobSchema);