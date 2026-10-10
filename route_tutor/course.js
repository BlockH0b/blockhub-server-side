const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const verifyTutorToken = require('../middlewave/verifyTutorToken');
const CourseSubmission = require('../models/CourseSubmit');
const requireAdmin = require('../middlewave/adminAuth');
const notify = require('../services/email/notify');

// Create a new course
// Inside your /create_course route
router.post('/create_course', verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;
        const {
            name,
            overview,
            thumbnail,
            level,
            tag,
            twitter,
            website,
            lessons,
            pricing,
        } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Course name is required' });
        }

        // Clean thumbnail logic
        let safeThumbnail = thumbnail;
        if (thumbnail && typeof thumbnail === 'object') {
            safeThumbnail.type = thumbnail.type || 'image';
            safeThumbnail.size = thumbnail.size || 0;
        }

        // Handle lessons validation
        if (lessons && lessons.length > 0) {
            for (let i = 0; i < lessons.length; i++) {
                if (!lessons[i].title || lessons[i].title.trim() === "") {
                    return res.status(400).json({
                        message: `Lesson ${i + 1} is missing a title`
                    });
                }
            }
        }

        // Create course
        const newCourse = new Course({
            tutor: tutor._id,
            name,
            overview: overview || "",
            thumbnail: safeThumbnail || "",
            level: level || "Beginner",
            tag: tag || "",
            twitter: twitter || "",
            website: website || "",
            lessons: lessons || [],
            pricing: pricing || {
                type: "free",
                amount: 0,
                currency: "",
                discount: 0,
            },
            isPublished: false,
            isDraft: true,
        });
        await newCourse.save();

        // Update tutor stats
        tutor.coursesCreated.push(newCourse._id);
        tutor.totalDraftedCourses += 1;
        await tutor.save();

        // IMPORTANT: Fetch all courses created by this tutor
        const allTutorCourses = await Course.find({ tutor: tutor._id });

        // Return everything
        return res.status(201).json({
            message: 'Course created successfully',
            course: newCourse,
            tutor,
            allCourses: allTutorCourses
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong', error: err.message });
    }
});

router.put('/update_course', verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;
        const {
            courseId, name, overview, thumbnail, level, tag, twitter, website, lessons, pricing,
        } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required' });
        }
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        // Ensure course belongs to this tutor
        if (String(course.tutor) !== String(tutor._id)) {
            return res.status(403).json({ message: 'Not allowed to edit this course' });
        }

        if (lessons && lessons.length > 0) {
            for (let i = 0; i < lessons.length; i++) {
                if (!lessons[i].title || lessons[i].title.trim() === "") {
                    return res.status(400).json({
                        message: `Lesson ${i + 1} is missing a title`
                    });
                }
            }
            course.lessons = lessons;
        }
        // PREPARE UPDATED FIELDS
        course.name = name || course.name;
        course.overview = overview || course.overview;
        course.level = level || course.level;
        course.tag = tag || course.tag;
        course.twitter = twitter || course.twitter;
        course.website = website || course.website;
        if (pricing) {
            course.pricing = {
                ...course.pricing,
                ...pricing,
            };
        }
        // Handle lessons update
        if (lessons) {
            course.lessons = lessons;
        }
        // Handle thumbnail:
        // If user uploads a new thumbnail (base64 or object), update it
        // If thumbnail is unchanged object/URL, leave it
        if (thumbnail) {
            if (typeof thumbnail === "object" || typeof thumbnail === "string") {
                course.thumbnail = thumbnail;
            }
        }
        await course.save();
        // Fetch updated list of all tutor courses
        const allTutorCourses = await Course.find({ tutor: tutor._id });
        return res.status(200).json({
            message: 'Course updated successfully',
            course,
            tutor,
            allCourses: allTutorCourses
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong', error: err.message });
    }
});

// DELETE a course
router.delete('/delete_course', verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;
        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: 'Course ID is required' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }


        // Protect: Only owner can delete
        if (String(course.tutor) !== String(tutor._id)) {
            return res.status(403).json({ message: 'Not allowed to delete this course' });
        }

        // Remove course from tutor
        tutor.coursesCreated = tutor.coursesCreated.filter(
            id => String(id) !== String(courseId)
        );
        // Update stats
        if (course.isDraft) tutor.totalDraftedCourses -= 1;
        if (course.isPublished) tutor.totalActiveCourses -= 1;

        await tutor.save();

        await course.deleteOne();

        const allTutorCourses = await Course.find({ tutor: tutor._id });

        return res.status(200).json({
            message: "Course deleted successfully",
            tutor,
            allCourses: allTutorCourses
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong', error: err.message });
    }
});

// PUBLISH course → make it live
router.put('/publish_course', verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;
        const { courseId } = req.body;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (String(course.tutor) !== String(tutor._id)) {
            return res.status(403).json({ message: 'Not allowed to publish this course' });
        }

        // Change state
        course.isPublished = true;
        course.isDraft = false;
        course.publishedAt = new Date();
        await course.save();

        // Update tutor stats
        tutor.totalActiveCourses += 1;
        tutor.totalDraftedCourses = Math.max(0, tutor.totalDraftedCourses - 1);
        await tutor.save();

        const allTutorCourses = await Course.find({ tutor: tutor._id });

        return res.status(200).json({
            message: "Course published successfully",
            course,
            tutor,
            allCourses: allTutorCourses
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong', error: err.message });
    }
});

// POST /tutor_course/duplicate_course
router.post("/duplicate_course", verifyTutorToken, async (req, res) => {
    const { courseId } = req.body;
    const tutor = req.tutor;

    const course = await Course.findById(courseId);

    if (!course) return res.status(404).json({ success: false });

    const duplicatedCourse = new Course({
        ...course.toObject(),
        _id: undefined, // create new ID
        name: course.name + " (Copy)",
        isPublished: false,
        isDraft: true,
    });

    await duplicatedCourse.save();

    // update tutor courses and return
    tutor.coursesCreated.push(duplicatedCourse._id); // ← use coursesCreated
    // ADD THIS (important)
    tutor.totalDraftedCourses += 1;
    await tutor.save();
    const allTutorCourses = await Course.find({ tutor: tutor._id });


    return res.status(200).json({
        success: true,
        tutor,
        allCourses: allTutorCourses,
    });
});

router.post("/submit_course_for_review", verifyTutorToken, async (req, res) => {
    try {
        const tutor = req.tutor;
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        const newCourse = new CourseSubmission({
            tutor: tutor._id,
            courseTitle: title,
            description: description
        });

        await newCourse.save();

        notify.courseSubmittedForReview(tutor, newCourse);

        const courses = await CourseSubmission.find({ tutor: tutor._id })
            .populate({
                path: "tutor",
                populate: {
                    path: "user",
                    select: "fullName profileImage"
                }
            })
            .sort({ createdAt: -1 });

        const formattedCourses = courses.map(course => ({
            id: course._id,
            courseTitle: course.courseTitle,
            description: course.description,
            status: course.status,
            statusMessage: course.statusMessage,

            tutorName: course.tutor?.user?.fullName || "Unknown",
            tutorImage: course.tutor?.user?.profileImage || ""
        }));

        res.status(201).json({
            message: "Course submitted successfully",
            courses: formattedCourses
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
router.get("/get_all_submitions", verifyTutorToken, async (req, res) => {
    try {
        // Fetch all submissions
        const courses = await CourseSubmission.find()
            .populate({
                path: "tutor",
                populate: {
                    path: "user",
                    select: "fullName profileImage"
                }
            })
            .sort({ createdAt: -1 });

        const formattedCourses = courses.map(course => ({
            id: course._id,
            courseTitle: course.courseTitle,
            description: course.description,
            status: course.status,
            statusMessage: course.statusMessage,
            tutorName: course.tutor?.user?.fullName || "Unknown",
            tutorImage: course.tutor?.user?.profileImage || ""
        }));

        res.status(200).json({
            message: "All course submissions fetched successfully",
            courses: formattedCourses
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", courses: [] });
    }
});


// GET all submissions (Admin)
router.get("/get_course_submissions", async (req, res) => {
    try {

        const submissions = await CourseSubmission.find()
            .populate({
                path: "tutor",
                populate: {
                    path: "user",
                    select: "fullName profileImage"
                }
            })
            .sort({ createdAt: -1 });

        const formatted = submissions.map(course => ({
            id: course._id,
            courseTitle: course.courseTitle,
            description: course.description,
            status: course.status,
            statusMessage: course.statusMessage,
            tutorName: course.tutor?.user?.fullName || "Unknown",
            tutorImage: course.tutor?.user?.profileImage || ""
        }));

        res.json({
            message: "Submissions fetched",
            courses: formatted
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});


// Toggle course approval
// Admin only (anyone could approve courses before)
router.patch("/toggle_course_status", requireAdmin, async (req, res) => {
    try {

        const { status, reason, courseId } = req.body;

        if (!["approved", "rejected", "pending"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const course = await CourseSubmission.findById(courseId);

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        course.status = status;
        course.statusMessage = reason || "";

        await course.save();

        notify.courseReviewed(course);

        res.json({
            message: "Course status updated",
            course
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE a course submission
// Admin only
router.delete("/delete_course_submittion", requireAdmin, async (req, res) => {
    try {
        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({ message: "Course ID is required" });
        }

        const course = await CourseSubmission.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course submission not found" });
        }

        await course.deleteOne();

        // Fetch remaining submissions after deletion
        const submissions = await CourseSubmission.find()
            .populate({
                path: "tutor",
                populate: { path: "user", select: "fullName profileImage" }
            })
            .sort({ createdAt: -1 });

        const formatted = submissions.map(c => ({
            id: c._id,
            courseTitle: c.courseTitle,
            description: c.description,
            status: c.status,
            statusMessage: c.statusMessage,
            tutorName: c.tutor?.user?.fullName || "Unknown",
            tutorImage: c.tutor?.user?.profileImage || ""
        }));

        res.json({
            message: "Course submission deleted successfully",
            courses: formatted
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});


// GET all uploaded courses (Admin view)
router.get("/get_all_uploaded_course", async (req, res) => {
    try {

        const courses = await Course.find({
            tutor: { $ne: "69a9403baad07a476521df9d" }
        })

            .populate({
                path: "tutor",
                populate: {
                    path: "user",
                    select: "fullName profileImage"
                }
            })
            .sort({ createdAt: -1 });

        const formatted = courses.map(course => ({
            id: course._id,

            // FIXED FIELDS
            courseTitle: course.name,
            description: course.overview,

            courseImage: course.thumbnail?.url || "",

            tutorName: course.tutor?.user?.fullName || "Unknown",
            tutorImage: course.tutor?.user?.profileImage || "",

            totalLessons: course.lessons?.length || 0,

            // NEW STATUS FIELD (IMPORTANT)
            status: course.isPublished ? "published" : "draft"
        }));

        res.json({
            message: "Courses fetched successfully",
            courses: formatted
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
module.exports = router;