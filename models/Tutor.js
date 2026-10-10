const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true }, // link back to user
    bio: { type: String },
    coursesCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'courses' }],
    tutorLevel: { type: String, default: 'Beginner' },
    earnings: { type: Number, default: 0 },
    skills: [{ type: String }],

    tutorCode: {
        type: String,
        unique: true
    },
    // New statistic fields
    totalActiveCourses: { type: Number, default: 0 },
    totalDraftedCourses: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalCourseSales: { type: Number, default: 0 },
}, {
    timestamps: true,
    collection: 'tutors'
});



module.exports = mongoose.models.tutors || mongoose.model('tutors', tutorSchema);