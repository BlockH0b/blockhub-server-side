/*
 * ============================================================
 * /cohort_student  -  Student: assignments + support tickets
 * ============================================================
 *   GET  /assignments                 my track's assignments + my submission
 *   POST /assignments/:id/submit      multipart: link, text, files[] (max 3 x 10MB)
 *
 *   GET  /tickets                     my questions
 *   POST /tickets                     { subject, category, message }  (emails tutor)
 *   GET  /tickets/:id
 *   POST /tickets/:id/reply           { message }  (emails tutor)
 *   PATCH /tickets/:id                { status: "closed" }
 *
 * Auth: the cohort dashboard cookie (BHCtoken).
 * ============================================================
 */

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");

const { cohortAuth } = require("../middlewave/cohortAuth");
const CohortAssignment = require("../models/CohortAssignment");
const CohortSubmission = require("../models/CohortSubmission");
const CohortTicket = require("../models/CohortTicket");
const User = require("../models/user");
const uploadBuffer = require("../utils/uploadToCloudinary");
const cloudinary = require("../utils/cloudinary");
const notify = require("../services/email/notify");

const router = express.Router();
router.use(cohortAuth);

const MAX_FILE_MB = 10;
const ALLOWED_EXT = [
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".csv", ".txt", ".md",
    ".zip", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".fig", ".psd", ".ai",
    ".mp4", ".mov", ".json", ".html", ".css", ".js", ".ts", ".py", ".ipynb", ".sql",
];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 3 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            return cb(new Error(`"${ext || "this"}" files can't be uploaded. Zip it, or share a Google Drive link instead.`));
        }
        cb(null, true);
    },
});

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

function cleanHttps(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
        url.protocol = "https:";
        return url.toString();
    } catch {
        return undefined;
    }
}

async function me(req) {
    const { userId, cohort, registration } = req.cohortUser;
    const user = await User.findById(userId).select("_id fullName email").lean();
    return {
        userId,
        cohort,
        track: registration.track,
        name: user?.fullName || registration.fullName || "Student",
        email: (user?.email || registration.email || "").toLowerCase(),
    };
}

function formatTicket(t, { full = false } = {}) {
    const last = t.messages?.[t.messages.length - 1];
    return {
        id: String(t._id),
        subject: t.subject,
        category: t.category,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        lastMessageFrom: t.lastMessageFrom,
        preview: last ? String(last.body).slice(0, 140) : "",
        createdAt: t.createdAt,
        messages: full
            ? (t.messages || []).map((m) => ({
                id: String(m._id),
                from: m.from,
                authorName: m.authorName,
                body: m.body,
                createdAt: m.createdAt,
            }))
            : undefined,
    };
}

/* ============================================================
   ASSIGNMENTS
============================================================ */

router.get("/assignments", async (req, res) => {
    try {
        const { cohort, registration, userId } = req.cohortUser;
        const items = await CohortAssignment.find({ cohort, track: registration.track }).sort({ createdAt: -1 }).lean();
        const subs = await CohortSubmission.find({ assignment: { $in: items.map((a) => a._id) }, student: userId }).lean();
        const subMap = new Map(subs.map((s) => [String(s.assignment), s]));

        return res.json({
            success: true,
            data: items.map((a) => {
                const s = subMap.get(String(a._id));
                return {
                    id: String(a._id),
                    title: a.title,
                    instructions: a.instructions,
                    resourceLink: a.resourceLink,
                    dueAt: a.dueAt,
                    allowLink: a.allowLink !== false,
                    allowFile: a.allowFile !== false,
                    allowText: a.allowText !== false,
                    status: a.status,
                    createdAt: a.createdAt,
                    submission: s
                        ? {
                            id: String(s._id),
                            link: s.link,
                            text: s.text,
                            files: s.files || [],
                            status: s.status,
                            grade: s.grade,
                            feedback: s.feedback,
                            late: Boolean(s.late),
                            submittedAt: s.submittedAt,
                            reviewedAt: s.reviewedAt,
                        }
                        : null,
                };
            }),
        });
    } catch (error) {
        console.error("[cohort_student] assignments", error);
        return res.status(500).json({ success: false, message: "Unable to load assignments." });
    }
});

router.post("/assignments/:id/submit", (req, res, next) => {
    upload.array("files", 3)(req, res, (err) => {
        if (!err) return next();
        const message = err.code === "LIMIT_FILE_SIZE"
            ? `Each file must be ${MAX_FILE_MB}MB or smaller. Use a Google Drive link for bigger files.`
            : err.code === "LIMIT_FILE_COUNT"
                ? "You can upload up to 3 files."
                : err.message || "Upload failed.";
        return res.status(400).json({ success: false, message });
    });
}, async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid assignment." });
        const student = await me(req);

        const assignment = await CohortAssignment.findOne({
            _id: req.params.id,
            cohort: student.cohort,
            track: student.track,
        }).lean();
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });
        if (assignment.status === "closed") {
            return res.status(400).json({ success: false, message: "This assignment is closed. Ask your tutor if you still need to submit." });
        }

        const existing = await CohortSubmission.findOne({ assignment: assignment._id, student: student.userId });
        if (existing?.status === "reviewed") {
            return res.status(400).json({ success: false, message: "Your tutor has already reviewed this. Open a support ticket if you need to change it." });
        }

        const link = cleanHttps(req.body?.link);
        if (link === undefined) return res.status(400).json({ success: false, message: "That link doesn't look right. Paste the full link." });
        const text = String(req.body?.text || "").trim().slice(0, 8000) || null;
        const keepFiles = req.body?.keepFiles !== "false"; // keep earlier files unless asked
        const incoming = req.files || [];

        if (link && assignment.allowLink === false) return res.status(400).json({ success: false, message: "This assignment doesn't take links." });
        if (text && assignment.allowText === false) return res.status(400).json({ success: false, message: "This assignment doesn't take written answers." });
        if (incoming.length && assignment.allowFile === false) return res.status(400).json({ success: false, message: "This assignment doesn't take files." });

        // Upload new files to Cloudinary
        const uploaded = [];
        for (const file of incoming) {
            const ext = path.extname(file.originalname).toLowerCase();
            const resourceType = IMAGE_EXT.includes(ext) ? "image" : "raw";
            const result = await uploadBuffer(
                file.buffer,
                `blockhub/cohort-submissions/${student.cohort}/${assignment._id}`,
                resourceType
            );
            uploaded.push({
                url: result.secure_url,
                publicId: result.public_id,
                resourceType,
                name: file.originalname.slice(0, 120),
                size: file.size,
                type: file.mimetype,
            });
        }

        let files = keepFiles && existing ? [...(existing.files || []), ...uploaded] : uploaded;
        if (files.length > 5) files = files.slice(-5);

        // remove files we dropped
        if (existing && !keepFiles) {
            for (const f of existing.files || []) {
                cloudinary.uploader.destroy(f.publicId, { resource_type: f.resourceType || "raw" }).catch(() => null);
            }
        }

        if (!link && !text && !files.length) {
            return res.status(400).json({ success: false, message: "Add a link, a file or a written answer." });
        }

        const now = new Date();
        const late = Boolean(assignment.dueAt && now > new Date(assignment.dueAt));
        const sub = await CohortSubmission.findOneAndUpdate(
            { assignment: assignment._id, student: student.userId },
            {
                $set: {
                    cohort: student.cohort,
                    track: student.track,
                    studentName: student.name,
                    studentEmail: student.email,
                    link,
                    text,
                    files,
                    status: "submitted",
                    submittedAt: now,
                    late,
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

        return res.json({
            success: true,
            message: existing ? "Your work was updated." : "Submitted! Your tutor will review it.",
            data: { id: String(sub._id), status: sub.status, late, files: sub.files, link: sub.link, text: sub.text, submittedAt: sub.submittedAt },
        });
    } catch (error) {
        console.error("[cohort_student] submit", error);
        return res.status(500).json({ success: false, message: "Unable to submit right now. Please try again." });
    }
});

/* ============================================================
   TICKETS (questions to my tutor)
============================================================ */

router.get("/tickets", async (req, res) => {
    try {
        const { userId, cohort } = req.cohortUser;
        const items = await CohortTicket.find({ cohort, student: userId }).sort({ lastMessageAt: -1 }).limit(100).lean();
        return res.json({ success: true, data: items.map((t) => formatTicket(t)) });
    } catch (error) {
        console.error("[cohort_student] tickets", error);
        return res.status(500).json({ success: false, message: "Unable to load your questions." });
    }
});

router.post("/tickets", async (req, res) => {
    try {
        const student = await me(req);
        const subject = String(req.body?.subject || "").trim().slice(0, 160);
        const message = String(req.body?.message || "").trim();
        const category = ["class", "assignment", "technical", "other"].includes(req.body?.category) ? req.body.category : "class";
        if (!subject || !message) return res.status(400).json({ success: false, message: "Add a subject and your question." });
        if (message.length > 5000) return res.status(400).json({ success: false, message: "Question is too long (5000 characters max)." });

        // simple spam guard: max 5 new questions a day
        const today = await CohortTicket.countDocuments({
            student: student.userId,
            createdAt: { $gte: new Date(Date.now() - 86400000) },
        });
        if (today >= 5) {
            return res.status(429).json({ success: false, message: "You've opened 5 questions today. Reply on an existing one, or try again tomorrow." });
        }

        const t = await CohortTicket.create({
            cohort: student.cohort,
            track: student.track,
            student: student.userId,
            studentName: student.name,
            studentEmail: student.email,
            subject,
            category,
            messages: [{ from: "student", authorName: student.name, body: message }],
            lastMessageAt: new Date(),
            lastMessageFrom: "student",
        });

        notify.ticketToTutors(t, t.messages[0], true);

        return res.status(201).json({
            success: true,
            message: "Sent! Your tutor has been emailed and will reply here.",
            data: formatTicket(t.toObject(), { full: true }),
        });
    } catch (error) {
        console.error("[cohort_student] create ticket", error);
        return res.status(500).json({ success: false, message: "Unable to send your question." });
    }
});

router.get("/tickets/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        const t = await CohortTicket.findOne({ _id: req.params.id, student: req.cohortUser.userId }).lean();
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });
        return res.json({ success: true, data: formatTicket(t, { full: true }) });
    } catch (error) {
        console.error("[cohort_student] ticket", error);
        return res.status(500).json({ success: false, message: "Unable to load the question." });
    }
});

router.post("/tickets/:id/reply", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        const body = String(req.body?.message || "").trim();
        if (!body) return res.status(400).json({ success: false, message: "Write a message first." });
        if (body.length > 5000) return res.status(400).json({ success: false, message: "Message is too long." });

        const student = await me(req);
        const t = await CohortTicket.findOne({ _id: req.params.id, student: student.userId });
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });

        t.messages.push({ from: "student", authorName: student.name, body });
        t.status = "open";
        t.lastMessageAt = new Date();
        t.lastMessageFrom = "student";
        await t.save();

        notify.ticketToTutors(t, t.messages[t.messages.length - 1], false);

        return res.json({ success: true, message: "Sent. Your tutor has been emailed.", data: formatTicket(t.toObject(), { full: true }) });
    } catch (error) {
        console.error("[cohort_student] reply", error);
        return res.status(500).json({ success: false, message: "Unable to send your message." });
    }
});

router.patch("/tickets/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        if (req.body?.status !== "closed") return res.status(400).json({ success: false, message: "You can only close a question." });
        const t = await CohortTicket.findOneAndUpdate(
            { _id: req.params.id, student: req.cohortUser.userId },
            { $set: { status: "closed" } },
            { new: true }
        ).lean();
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });
        return res.json({ success: true, message: "Question closed.", data: formatTicket(t, { full: true }) });
    } catch (error) {
        console.error("[cohort_student] close", error);
        return res.status(500).json({ success: false, message: "Unable to close the question." });
    }
});

module.exports = router;
