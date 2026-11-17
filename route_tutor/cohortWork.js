/*
 * ============================================================
 * /tutor_work  -  Tutor: assignments + student support tickets
 * ============================================================
 *  ASSIGNMENTS
 *   GET    /assignments                    list (with submission counts)
 *   POST   /assignments                    create + email the track
 *   PATCH  /assignments/:id                edit / close / reopen
 *   DELETE /assignments/:id                delete (and its submissions)
 *   GET    /assignments/:id/submissions    who handed in what
 *   PATCH  /submissions/:id                review: status, grade, feedback (emails student)
 *
 *  TICKETS
 *   GET    /tickets?status=open|answered|closed|all
 *   GET    /tickets/:id
 *   POST   /tickets/:id/reply              { message }  (emails student)
 *   PATCH  /tickets/:id                    { status }
 *
 * Only the logged-in tutor's own cohort + track.
 * ============================================================
 */

const express = require("express");
const mongoose = require("mongoose");

const requireCohortTutor = require("../middlewave/requireCohortTutor");
const CohortAssignment = require("../models/CohortAssignment");
const CohortSubmission = require("../models/CohortSubmission");
const CohortTicket = require("../models/CohortTicket");
const CohortRegistration = require("../models/Cohort");
const notify = require("../services/email/notify");

const router = express.Router();
router.use(requireCohortTutor);

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

function cleanHttps(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
        url.protocol = "https:";
        return url.toString();
    } catch {
        return undefined; // invalid
    }
}

function formatAssignment(a, counts = {}) {
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
        submissions: counts.total || 0,
        reviewed: counts.reviewed || 0,
    };
}

function formatSubmission(s) {
    return {
        id: String(s._id),
        assignmentId: String(s.assignment),
        studentId: String(s.student),
        studentName: s.studentName,
        studentEmail: s.studentEmail,
        link: s.link,
        text: s.text,
        files: s.files || [],
        status: s.status,
        grade: s.grade,
        feedback: s.feedback,
        late: Boolean(s.late),
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
    };
}

function formatTicket(t, { full = false } = {}) {
    const last = t.messages?.[t.messages.length - 1];
    return {
        id: String(t._id),
        subject: t.subject,
        category: t.category,
        status: t.status,
        studentName: t.studentName,
        studentEmail: t.studentEmail,
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

function readAssignmentBody(body = {}, { partial = false } = {}) {
    const out = {};
    if (!partial || body.title !== undefined) out.title = String(body.title || "").trim().slice(0, 160);
    if (!partial || body.instructions !== undefined) out.instructions = String(body.instructions || "").trim().slice(0, 8000);
    if (!partial || body.resourceLink !== undefined) {
        const link = cleanHttps(body.resourceLink);
        if (link === undefined) throw new Error("The resource link doesn't look right. Paste the full link.");
        out.resourceLink = link;
    }
    if (!partial || body.dueAt !== undefined) {
        if (body.dueAt) {
            const due = new Date(body.dueAt);
            if (Number.isNaN(due.getTime())) throw new Error("Due date is not valid.");
            out.dueAt = due;
        } else {
            out.dueAt = null;
        }
    }
    for (const key of ["allowLink", "allowFile", "allowText"]) {
        if (typeof body[key] === "boolean") out[key] = body[key];
    }
    if (body.status !== undefined) {
        if (!["open", "closed"].includes(body.status)) throw new Error("Unknown status.");
        out.status = body.status;
    }
    return out;
}

/* ============================================================
   ASSIGNMENTS
============================================================ */

router.get("/assignments", async (req, res) => {
    try {
        const items = await CohortAssignment.find({ cohort: req.cohort, track: req.track })
            .sort({ createdAt: -1 })
            .lean();

        const counts = await CohortSubmission.aggregate([
            { $match: { assignment: { $in: items.map((a) => a._id) } } },
            {
                $group: {
                    _id: "$assignment",
                    total: { $sum: 1 },
                    reviewed: { $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] } },
                },
            },
        ]);
        const countMap = new Map(counts.map((c) => [String(c._id), c]));
        const students = await CohortRegistration.countDocuments({
            cohort: req.cohort,
            track: req.track,
            status: { $ne: "rejected" },
        });

        return res.json({
            success: true,
            data: {
                students,
                assignments: items.map((a) => formatAssignment(a, countMap.get(String(a._id)))),
            },
        });
    } catch (error) {
        console.error("[tutor_work] list assignments", error);
        return res.status(500).json({ success: false, message: "Unable to load assignments." });
    }
});

router.post("/assignments", async (req, res) => {
    try {
        let body;
        try {
            body = readAssignmentBody(req.body);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }
        if (!body.title || !body.instructions) {
            return res.status(400).json({ success: false, message: "Add a title and the instructions." });
        }
        if (body.allowLink === false && body.allowFile === false && body.allowText === false) {
            return res.status(400).json({ success: false, message: "Allow at least one way to submit." });
        }

        const item = await CohortAssignment.create({
            ...body,
            cohort: req.cohort,
            track: req.track,
            author: req.user._id,
        });

        if (req.body?.emailStudents !== false) notify.assignmentPosted(item, req.user);

        return res.status(201).json({
            success: true,
            message: req.body?.emailStudents !== false
                ? "Assignment posted. Your students are being emailed."
                : "Assignment posted.",
            data: formatAssignment(item.toObject()),
        });
    } catch (error) {
        console.error("[tutor_work] create assignment", error);
        return res.status(500).json({ success: false, message: "Unable to post the assignment." });
    }
});

router.patch("/assignments/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid assignment." });
        let body;
        try {
            body = readAssignmentBody(req.body, { partial: true });
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }
        if (body.title === "" || body.instructions === "") {
            return res.status(400).json({ success: false, message: "Title and instructions can't be empty." });
        }
        const item = await CohortAssignment.findOneAndUpdate(
            { _id: req.params.id, cohort: req.cohort, track: req.track },
            { $set: body },
            { new: true }
        ).lean();
        if (!item) return res.status(404).json({ success: false, message: "Assignment not found." });
        return res.json({ success: true, message: "Assignment saved.", data: formatAssignment(item) });
    } catch (error) {
        console.error("[tutor_work] update assignment", error);
        return res.status(500).json({ success: false, message: "Unable to save the assignment." });
    }
});

router.delete("/assignments/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid assignment." });
        const item = await CohortAssignment.findOneAndDelete({ _id: req.params.id, cohort: req.cohort, track: req.track });
        if (!item) return res.status(404).json({ success: false, message: "Assignment not found." });
        await CohortSubmission.deleteMany({ assignment: item._id });
        return res.json({ success: true, message: "Assignment deleted." });
    } catch (error) {
        console.error("[tutor_work] delete assignment", error);
        return res.status(500).json({ success: false, message: "Unable to delete the assignment." });
    }
});

router.get("/assignments/:id/submissions", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid assignment." });
        const assignment = await CohortAssignment.findOne({ _id: req.params.id, cohort: req.cohort, track: req.track }).lean();
        if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found." });

        const subs = await CohortSubmission.find({ assignment: assignment._id }).sort({ submittedAt: -1 }).lean();

        // who hasn't submitted yet
        const regs = await CohortRegistration.find({ cohort: req.cohort, track: req.track, status: { $ne: "rejected" } })
            .select("user fullName email")
            .lean();
        const done = new Set(subs.map((s) => String(s.student)));
        const missing = regs
            .filter((r) => r.user && !done.has(String(r.user)))
            .map((r) => ({ name: r.fullName, email: r.email }));

        return res.json({
            success: true,
            data: {
                assignment: formatAssignment(assignment, { total: subs.length }),
                submissions: subs.map(formatSubmission),
                missing,
            },
        });
    } catch (error) {
        console.error("[tutor_work] submissions", error);
        return res.status(500).json({ success: false, message: "Unable to load submissions." });
    }
});

router.patch("/submissions/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid submission." });
        const sub = await CohortSubmission.findOne({ _id: req.params.id, cohort: req.cohort, track: req.track });
        if (!sub) return res.status(404).json({ success: false, message: "Submission not found." });

        const status = req.body?.status;
        if (!["reviewed", "needs_changes"].includes(status)) {
            return res.status(400).json({ success: false, message: "Choose Reviewed or Needs changes." });
        }
        sub.status = status;
        sub.grade = String(req.body?.grade || "").trim().slice(0, 40) || null;
        sub.feedback = String(req.body?.feedback || "").trim().slice(0, 4000) || null;
        sub.reviewedAt = new Date();
        await sub.save();

        const assignment = await CohortAssignment.findById(sub.assignment).lean();
        if (assignment && req.body?.emailStudent !== false) notify.submissionReviewed(sub, assignment, req.user);

        return res.json({ success: true, message: "Review saved. The student has been emailed.", data: formatSubmission(sub.toObject()) });
    } catch (error) {
        console.error("[tutor_work] review", error);
        return res.status(500).json({ success: false, message: "Unable to save the review." });
    }
});

/* ============================================================
   TICKETS
============================================================ */

router.get("/tickets", async (req, res) => {
    try {
        const filter = { cohort: req.cohort, track: req.track };
        const status = req.query.status || "active";
        if (status === "active") filter.status = { $in: ["open", "answered"] };
        else if (["open", "answered", "closed"].includes(status)) filter.status = status;

        const items = await CohortTicket.find(filter).sort({ lastMessageAt: -1 }).limit(200).lean();
        const open = await CohortTicket.countDocuments({ cohort: req.cohort, track: req.track, status: "open" });
        return res.json({ success: true, data: { open, tickets: items.map((t) => formatTicket(t)) } });
    } catch (error) {
        console.error("[tutor_work] tickets", error);
        return res.status(500).json({ success: false, message: "Unable to load questions." });
    }
});

router.get("/tickets/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        const t = await CohortTicket.findOne({ _id: req.params.id, cohort: req.cohort, track: req.track }).lean();
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });
        return res.json({ success: true, data: formatTicket(t, { full: true }) });
    } catch (error) {
        console.error("[tutor_work] ticket", error);
        return res.status(500).json({ success: false, message: "Unable to load the question." });
    }
});

router.post("/tickets/:id/reply", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        const body = String(req.body?.message || "").trim();
        if (!body) return res.status(400).json({ success: false, message: "Write a reply first." });
        if (body.length > 5000) return res.status(400).json({ success: false, message: "Reply is too long (5000 characters max)." });

        const t = await CohortTicket.findOne({ _id: req.params.id, cohort: req.cohort, track: req.track });
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });

        t.messages.push({ from: "tutor", authorName: req.user.fullName || "Tutor", body });
        t.status = req.body?.close === true ? "closed" : "answered";
        t.lastMessageAt = new Date();
        t.lastMessageFrom = "tutor";
        await t.save();

        notify.ticketToStudent(t, t.messages[t.messages.length - 1], req.user);

        return res.json({
            success: true,
            message: "Reply sent. The student has been emailed.",
            data: formatTicket(t.toObject(), { full: true }),
        });
    } catch (error) {
        console.error("[tutor_work] reply", error);
        return res.status(500).json({ success: false, message: "Unable to send the reply." });
    }
});

router.patch("/tickets/:id", async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ticket." });
        const status = req.body?.status;
        if (!["open", "answered", "closed"].includes(status)) {
            return res.status(400).json({ success: false, message: "Unknown status." });
        }
        const t = await CohortTicket.findOneAndUpdate(
            { _id: req.params.id, cohort: req.cohort, track: req.track },
            { $set: { status } },
            { new: true }
        ).lean();
        if (!t) return res.status(404).json({ success: false, message: "Question not found." });
        return res.json({ success: true, message: status === "closed" ? "Question closed." : "Saved.", data: formatTicket(t, { full: true }) });
    } catch (error) {
        console.error("[tutor_work] ticket status", error);
        return res.status(500).json({ success: false, message: "Unable to update the question." });
    }
});

module.exports = router;
