const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const verifyTutorToken = require('../functions/verifyTutorToken');

// GET tutor stats
router.get('/tutor_stats', verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;

        // Fetch all courses of this tutor (published and drafts)
        const courses = await Course.find({ tutor: tutor._id });

        // Stats
        const totalActiveCourses = courses.filter(c => c.isPublished).length;
        const totalStudents = courses.reduce((acc, c) => acc + (c.totalEnrollments || 0), 0);
        const totalCourseSales = courses.reduce((acc, c) => acc + ((c.totalEnrollments || 0) * (c.price || 0)), 0);

        return res.status(200).json({
            totalActiveCourses,
            totalStudents,
            totalCourseSales,
            coursesCreated: courses // send full array for frontend
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
});



router.get('/tutor_sales_chart', verifyTutorToken, async (req, res) => {
    try {
        const tutorId = req.tutor._id;
        const period = req.query.period || 'overall'; // use query string

        const courses = await Course.find({ tutor: tutorId, isPublished: true });

        const salesByPeriod = {};

        courses.forEach(course => {
            if (!course.publishedAt) return;

            const date = new Date(course.publishedAt);
            let key;

            if (period === 'month') {
                key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            } else if (period === 'year') {
                key = date.getFullYear().toString();
            } else {
                key = 'Overall';
            }

            salesByPeriod[key] = (salesByPeriod[key] || 0) + (course.totalEnrollments || 0);
        });

        const chartData = Object.keys(salesByPeriod).map(k => ({ month: k, sales: salesByPeriod[k] }));

        return res.status(200).json(chartData);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Something went wrong", error: err.message });
    }
});


router.post('/get_tutor_courses', verifyTutorToken, async (req, res) => {
    try {
        const tutorId = req.tutor._id;
        const courses = await Course.find({ tutor: tutorId });
        return res.status(200).json(courses);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
});


router.post('/publish_course', verifyTutorToken, async (req, res) => {
    try {
        const tutorId = req.tutor._id;
        const { courseId } = req.body;

        // Find the course
        const course = await Course.findOne({ _id: courseId, tutor: tutorId });
        if (!course) {
            return res.status(404).json({ message: 'Course not found or not owned by tutor' });
        }

        course.isPublished = true;
        course.isDraft = false;
        course.publishedAt = new Date();

        await course.save();

        // Return full tutor object with courses
        const tutorCourses = await Course.find({ tutor: tutorId });

        return res.status(200).json({
            message: 'Course published successfully',
            course,
            coursesCreated: tutorCourses, // full array of course objects for frontend
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong', error: err.message });
    }
});


module.exports = router;