/*
 * ============================================================
 * /admin_cohort  -  Admin control of the cohort timetable
 * ============================================================
 *   GET    /overview                 tracks, tutor, students, class counts
 *   POST   /schedule/generate        make every class from the master timetable
 *   GET    /classes?track=&range=    list classes (upcoming | past | all)
 *   PATCH  /classes/:id              edit link / time / status / tutor
 *   DELETE /classes/:id              delete a class (no emails)
 *   POST   /email                    email students of one, some or all tracks
 *
 * All routes: logged-in BlockHub admin (user.admin = true).
 * ============================================================
 */

const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require("path");

const requireAdmin = require("../middlewave/adminAuth");
const CohortClass = require("../models/CohortClass");
const CohortTutor = require("../models/CohortTutor");
const CohortRegistration = require("../models/Cohort");
const User = require("../models/user");
const notify = require("../services/email/notify");
const { sendEmail, queueBulk, queueStatus } = require("../services/email");
const EmailLog = require("../models/EmailLog");
const { getClassStartsAt, getClassEndsAt } = require("../utils/classTime");
const { cleanMeetLink } = require("../utils/meetLink");
const { COHORT_TRACKS, normalizeTrack } = require("../config/cohortTracks");

const router = express.Router();
router.use(requireAdmin);

const DEFAULT_COHORT = process.env.DEFAULT_COHORT || "cohort-1.0";

/*
 * BlockHub Skills Cohort 1.0 - master timetable (Lagos time)
 * day: 0 = Sunday ... 6 = Saturday
 */
const MASTER_TIMETABLE = [
    { day: 1, track: "Full Stack Web Development", start: "18:00", end: "21:00" },

    { day: 2, track: "AI Video & Content Creation", start: "20:00", end: "22:00" },

    { day: 3, track: "Backend Development", start: "18:00", end: "20:00" },
    { day: 3, track: "Data Analytics", start: "21:00", end: "23:00" },
    { day: 3, track: "Crypto Trading (Degen)", start: "21:00", end: "23:00" },

    { day: 4, track: "Backend Development", start: "18:00", end: "20:00" },
    { day: 4, track: "Vibecoding & Front-end Development", start: "20:00", end: "22:00" },

    { day: 5, track: "Full Stack Web Development", start: "18:00", end: "20:00" },
    { day: 5, track: "2D Design & Animation", start: "20:00", end: "22:00" },
    { day: 5, track: "Project Management", start: "20:00", end: "22:00" },
    { day: 5, track: "Data Analytics", start: "21:00", end: "23:00" },

    { day: 6, track: "Project Management", start: "19:00", end: "21:00" },
    { day: 6, track: "2D Design & Animation", start: "20:00", end: "22:00" },
    { day: 6, track: "AI Video & Content Creation", start: "20:00", end: "22:00" },
    { day: 6, track: "Crypto Trading (Degen)", start: "21:00", end: "23:00" },

    { day: 0, track: "Vibecoding & Front-end Development", start: "20:00", end: "22:00" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesOf(hhmm) {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + m;
}

function ymd(date) {
    return date.toISOString().slice(0, 10);
}

/** "2026-11-17" -> Date at 00:00 UTC (how CohortClass stores startDate) */
function utcDay(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(d.getTime()) ? null : d;
}

function validTime(value) {
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim());
}

function formatClass(c, tutorMap, studentCounts) {
    const startsAt = getClassStartsAt(c);
    const endsAt = getClassEndsAt(c);
    const tutor = c.tutor ? tutorMap.get(String(c.tutor)) : null;
    return {
        id: String(c._id),
        cohort: c.cohort,
        track: c.track,
        title: c.title,
        description: c.description,
        classNumber: c.classNumber,
        startDate: c.startDate,
        startTime: c.startTime,
        endTime: c.endTime,
        startsAt,
        endsAt,
        meetingLink: c.meetingLink,
        meetingStatus: c.meetingStatus,
        recordingLink: c.recordingLink,
        status: c.status,
        emailStudents: c.emailStudents !== false,
        tutor: tutor ? { id: String(tutor._id), name: tutor.fullName, email: tutor.email } : null,
        students: studentCounts?.get(c.track) || 0,
    };
}

async function studentCountsByTrack(cohort) {
    const rows = await CohortRegistration.aggregate([
        { $match: { cohort, status: { $ne: "rejected" } } },
        { $group: { _id: "$track", count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.count]));
}

/* ------------------------------------------------------------
   GET /overview
------------------------------------------------------------ */
router.get("/overview", async (req, res) => {
    try {
        const cohort = req.query.cohort || DEFAULT_COHORT;
        const [tutors, counts, classCounts] = await Promise.all([
            CohortTutor.find({ cohort }).populate("user", "fullName email").lean(),
            studentCountsByTrack(cohort),
            CohortClass.aggregate([
                { $match: { cohort, status: { $ne: "cancelled" } } },
                {
                    $group: {
                        _id: "$track",
                        total: { $sum: 1 },
                        withLink: { $sum: { $cond: [{ $eq: ["$meetingStatus", "available"] }, 1, 0] } },
                    },
                },
            ]),
        ]);

        const classMap = new Map(classCounts.map((r) => [r._id, r]));
        const tracks = COHORT_TRACKS.map((track) => {
            const trackTutors = tutors.filter((t) => normalizeTrack(t.track) === track);
            return {
                track,
                students: counts.get(track) || 0,
                classes: classMap.get(track)?.total || 0,
                classesWithLink: classMap.get(track)?.withLink || 0,
                inTimetable: MASTER_TIMETABLE.some((s) => s.track === track),
                tutors: trackTutors.map((t) => ({
                    id: String(t.user?._id || ""),
                    name: t.user?.fullName || "Unknown",
                    email: t.user?.email || "",
                    status: t.status,
                })),
            };
        });

        return res.json({
            success: true,
            data: {
                cohort,
                tracks,
                timetable: MASTER_TIMETABLE.map((s) => ({ ...s, dayName: DAY_NAMES[s.day] })),
                totalStudents: [...counts.values()].reduce((a, b) => a + b, 0),
            },
        });
    } catch (error) {
        console.error("[admin_cohort] overview", error);
        return res.status(500).json({ success: false, message: "Could not load the cohort overview." });
    }
});

/* ------------------------------------------------------------
   POST /schedule/generate
   body: { startDate: "2026-11-17", weeks: 16, dryRun: true, tracks?: [] }
   Safe to run twice: a class that already exists (same track, day
   and start time) is skipped. No "new class" emails are sent - the
   students are emailed when the tutor adds the link, plus reminders.
------------------------------------------------------------ */
router.post("/schedule/generate", async (req, res) => {
    try {
        const cohort = req.body?.cohort || DEFAULT_COHORT;
        const start = utcDay(req.body?.startDate || "2026-11-17");
        const weeks = Math.min(Math.max(Number(req.body?.weeks) || 16, 1), 26);
        const dryRun = req.body?.dryRun === true;
        const onlyTracks = Array.isArray(req.body?.tracks)
            ? req.body.tracks.map(normalizeTrack).filter(Boolean)
            : [];

        if (!start) {
            return res.status(400).json({ success: false, message: "Start date must look like 2026-11-17." });
        }

        const slots = MASTER_TIMETABLE.filter((s) => !onlyTracks.length || onlyTracks.includes(s.track));

        // One active tutor per track (first one if there are several)
        const tutors = await CohortTutor.find({ cohort, status: "active" }).select("user track").lean();
        const tutorFor = new Map();
        for (const t of tutors) {
            const track = normalizeTrack(t.track);
            if (track && !tutorFor.has(track)) tutorFor.set(track, t.user);
        }

        const end = new Date(start.getTime() + weeks * 7 * 86400000);
        const existing = await CohortClass.find({
            cohort,
            startDate: { $gte: start, $lt: end },
            status: { $ne: "cancelled" },
        })
            .select("track startDate startTime classNumber")
            .lean();
        const taken = new Set(existing.map((c) => `${c.track}|${ymd(new Date(c.startDate))}|${c.startTime}`));

        // Keep numbering after any class the track already has
        const lastNumber = new Map();
        const numbers = await CohortClass.aggregate([
            { $match: { cohort, classNumber: { $ne: null } } },
            { $group: { _id: "$track", max: { $max: "$classNumber" } } },
        ]);
        numbers.forEach((n) => lastNumber.set(n._id, n.max || 0));

        // Walk the days in order so class numbers follow the calendar
        const docs = [];
        let skipped = 0;
        for (let i = 0; i < weeks * 7; i += 1) {
            const day = new Date(start.getTime() + i * 86400000);
            const week = Math.floor(i / 7) + 1;
            const daySlots = slots
                .filter((s) => s.day === day.getUTCDay())
                .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));

            for (const slot of daySlots) {
                const key = `${slot.track}|${ymd(day)}|${slot.start}`;
                if (taken.has(key)) {
                    skipped += 1;
                    continue;
                }
                taken.add(key);
                const classNumber = (lastNumber.get(slot.track) || 0) + 1;
                lastNumber.set(slot.track, classNumber);

                docs.push({
                    cohort,
                    track: slot.track,
                    title: `Week ${week} · Class ${classNumber}`,
                    description: null,
                    classNumber,
                    startDate: day,
                    startTime: slot.start,
                    endTime: slot.end,
                    durationMinutes: minutesOf(slot.end) - minutesOf(slot.start),
                    meetingLink: null,
                    meetingStatus: "pending",
                    meetSource: null,
                    tutor: tutorFor.get(slot.track) || null,
                    createdBy: req.adminUser?._id || null,
                    status: "scheduled",
                    emailStudents: true,
                });
            }
        }

        const perTrack = {};
        docs.forEach((d) => {
            perTrack[d.track] = (perTrack[d.track] || 0) + 1;
        });

        const missingTutor = [...new Set(docs.filter((d) => !d.tutor).map((d) => d.track))];

        if (!dryRun && docs.length) {
            await CohortClass.insertMany(docs, { ordered: false });
        }

        return res.json({
            success: true,
            message: dryRun
                ? `Preview: ${docs.length} classes would be created (${skipped} already exist).`
                : `${docs.length} classes created (${skipped} already existed).`,
            data: {
                dryRun,
                created: dryRun ? 0 : docs.length,
                toCreate: docs.length,
                skipped,
                perTrack,
                missingTutor,
                from: ymd(start),
                to: ymd(new Date(end.getTime() - 86400000)),
                first: docs.slice(0, 8).map((d) => ({
                    track: d.track,
                    title: d.title,
                    date: ymd(d.startDate),
                    time: `${d.startTime}–${d.endTime}`,
                })),
            },
        });
    } catch (error) {
        console.error("[admin_cohort] generate", error);
        return res.status(500).json({ success: false, message: "Could not create the timetable." });
    }
});

/* ------------------------------------------------------------
   GET /classes?track=&range=upcoming|past|all&noLink=1
------------------------------------------------------------ */
router.get("/classes", async (req, res) => {
    try {
        const cohort = req.query.cohort || DEFAULT_COHORT;
        const filter = { cohort };
        const track = normalizeTrack(req.query.track);
        if (track) filter.track = track;
        if (req.query.noLink === "1") filter.meetingStatus = { $ne: "available" };

        const range = req.query.range || "upcoming";
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (range === "upcoming") filter.startDate = { $gte: new Date(today.getTime() - 86400000) };
        if (range === "past") filter.startDate = { $lte: new Date(today.getTime() + 86400000) };

        const limit = Math.min(Number(req.query.limit) || 300, 1000);
        let classes = await CohortClass.find(filter)
            .sort({ startDate: range === "past" ? -1 : 1, startTime: 1 })
            .limit(limit)
            .lean();

        const now = Date.now();
        if (range === "upcoming") classes = classes.filter((c) => (getClassEndsAt(c)?.getTime() || 0) >= now);
        if (range === "past") classes = classes.filter((c) => (getClassEndsAt(c)?.getTime() || 0) < now);

        const tutorIds = [...new Set(classes.map((c) => c.tutor).filter(Boolean).map(String))];
        const tutorDocs = await User.find({ _id: { $in: tutorIds } }).select("_id fullName email").lean();
        const tutorMap = new Map(tutorDocs.map((u) => [String(u._id), u]));
        const counts = await studentCountsByTrack(cohort);

        return res.json({ success: true, data: classes.map((c) => formatClass(c, tutorMap, counts)) });
    } catch (error) {
        console.error("[admin_cohort] classes", error);
        return res.status(500).json({ success: false, message: "Could not load classes." });
    }
});

/* ------------------------------------------------------------
   PATCH /classes/:id
   body: any of { meetingLink, recordingLink, title, description,
                  startDate, startTime, endTime, status, tutorId,
                  emailStudents }
------------------------------------------------------------ */
router.patch("/classes/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid class id." });
        }
        const classItem = await CohortClass.findById(id);
        if (!classItem) return res.status(404).json({ success: false, message: "Class not found." });

        const body = req.body || {};
        const previousStartsAt = getClassStartsAt(classItem);
        const previousStatus = classItem.status;
        const previousLink = classItem.meetingStatus === "available" ? classItem.meetingLink || null : null;

        if (body.meetingLink !== undefined) {
            let link;
            try {
                link = cleanMeetLink(body.meetingLink);
            } catch (linkError) {
                return res.status(400).json({ success: false, message: linkError.message });
            }
            classItem.meetingLink = link;
            classItem.meetingStatus = link ? "available" : "pending";
            classItem.meetSource = link ? "manual" : null;
        }

        if (body.recordingLink !== undefined) {
            const text = String(body.recordingLink || "").trim();
            if (text && !/^https:\/\//i.test(text)) {
                return res.status(400).json({ success: false, message: "Recording link must start with https://" });
            }
            classItem.recordingLink = text || null;
        }

        if (body.title !== undefined && String(body.title).trim()) classItem.title = String(body.title).trim();
        if (body.description !== undefined) classItem.description = String(body.description || "").trim() || null;

        if (body.startDate !== undefined) {
            const day = utcDay(String(body.startDate).slice(0, 10));
            if (!day) return res.status(400).json({ success: false, message: "Date must look like 2026-11-17." });
            classItem.startDate = day;
        }
        if (body.startTime !== undefined) {
            if (!validTime(body.startTime)) return res.status(400).json({ success: false, message: "Start time must look like 18:00." });
            classItem.startTime = String(body.startTime).trim();
        }
        if (body.endTime !== undefined) {
            if (!validTime(body.endTime)) return res.status(400).json({ success: false, message: "End time must look like 20:00." });
            classItem.endTime = String(body.endTime).trim();
        }
        if (body.startTime !== undefined || body.endTime !== undefined) {
            const mins = minutesOf(classItem.endTime) - minutesOf(classItem.startTime);
            classItem.durationMinutes = mins > 0 ? mins : null;
        }

        if (body.status !== undefined) {
            if (!["scheduled", "ongoing", "completed", "cancelled"].includes(body.status)) {
                return res.status(400).json({ success: false, message: "Unknown status." });
            }
            classItem.status = body.status;
        }

        if (typeof body.emailStudents === "boolean") classItem.emailStudents = body.emailStudents;

        if (body.tutorId !== undefined) {
            if (!body.tutorId) {
                classItem.tutor = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(body.tutorId)) {
                    return res.status(400).json({ success: false, message: "Invalid tutor." });
                }
                const isTutor = await CohortTutor.exists({ user: body.tutorId });
                if (!isTutor) return res.status(400).json({ success: false, message: "That user is not a cohort tutor." });
                classItem.tutor = body.tutorId;
            }
        }

        await classItem.save();

        // Emails (only when something students care about changed)
        const sendEmails = body.notifyStudents !== false;
        const newStartsAt = getClassStartsAt(classItem);
        const newLink = classItem.meetingStatus === "available" ? classItem.meetingLink || null : null;

        if (sendEmails) {
            if (classItem.status === "cancelled" && previousStatus !== "cancelled") {
                notify.classCancelled(classItem);
            } else if (classItem.status !== "cancelled") {
                if (previousStartsAt && newStartsAt && previousStartsAt.getTime() !== newStartsAt.getTime()) {
                    notify.classUpdated(classItem, previousStartsAt);
                }
                if (newLink && newLink !== previousLink) {
                    notify.classLinkReady(classItem, { changed: Boolean(previousLink) });
                }
            }
        }

        const tutorDoc = classItem.tutor
            ? await User.findById(classItem.tutor).select("_id fullName email").lean()
            : null;
        const tutorMap = new Map(tutorDoc ? [[String(tutorDoc._id), tutorDoc]] : []);

        return res.json({
            success: true,
            message: newLink && newLink !== previousLink && sendEmails
                ? "Saved. Students are being emailed the link."
                : "Saved.",
            data: formatClass(classItem.toObject(), tutorMap),
        });
    } catch (error) {
        console.error("[admin_cohort] update class", error);
        return res.status(500).json({ success: false, message: "Could not save the class." });
    }
});

/* ------------------------------------------------------------
   POST /classes/resend-links   { classId? }
   Re-sends the "your class link" email to students who never got it
   (e.g. Gmail blocked us). Students who already got it are skipped.
------------------------------------------------------------ */
router.post("/classes/resend-links", async (req, res) => {
    try {
        const cohort = req.body?.cohort || DEFAULT_COHORT;
        const filter = { cohort, status: { $ne: "cancelled" }, meetingStatus: "available", meetingLink: { $ne: null } };
        if (req.body?.classId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.classId)) {
                return res.status(400).json({ success: false, message: "Invalid class." });
            }
            filter._id = req.body.classId;
        } else {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            filter.startDate = { $gte: new Date(today.getTime() - 86400000), $lte: new Date(today.getTime() + 8 * 86400000) };
        }
        const classes = await CohortClass.find(filter).lean();
        const upcoming = classes.filter((c) => (getClassEndsAt(c)?.getTime() || 0) > Date.now());
        upcoming.forEach((c) => notify.classLinkReady(c, { changed: false }));
        return res.json({
            success: true,
            message: upcoming.length
                ? `Re-sending the link for ${upcoming.length} upcoming class${upcoming.length === 1 ? "" : "es"}. Students who already got it are skipped.`
                : "No upcoming classes with a link to resend.",
            data: { classes: upcoming.length },
        });
    } catch (error) {
        console.error("[admin_cohort] resend links", error);
        return res.status(500).json({ success: false, message: "Could not resend the links." });
    }
});

/* ------------------------------------------------------------
   GET /email-health   is email working right now?
------------------------------------------------------------ */
router.get("/email-health", async (req, res) => {
    try {
        const status = await queueStatus();
        const lastError = await EmailLog.findOne({ status: { $in: ["failed", "retry"] } })
            .sort({ updatedAt: -1 })
            .select("error updatedAt template")
            .lean();
        return res.json({
            success: true,
            data: {
                ...status,
                lastError: lastError
                    ? { message: String(lastError.error || "").split("\n")[0].slice(0, 200), at: lastError.updatedAt, template: lastError.template }
                    : null,
            },
        });
    } catch (error) {
        console.error("[admin_cohort] email health", error);
        return res.status(500).json({ success: false, message: "Could not check email." });
    }
});

/* ------------------------------------------------------------
   DELETE /classes/:id   (no emails - use status "cancelled" to tell students)
------------------------------------------------------------ */
router.delete("/classes/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid class id." });
        }
        const deleted = await CohortClass.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, message: "Class not found." });
        return res.json({ success: true, message: "Class deleted." });
    } catch (error) {
        console.error("[admin_cohort] delete class", error);
        return res.status(500).json({ success: false, message: "Could not delete the class." });
    }
});

/* ------------------------------------------------------------
   POST /email
   body: { tracks: ["Data Analytics"] | [] (= every track), subject, message }
------------------------------------------------------------ */
router.post("/email", async (req, res) => {
    try {
        const cohort = req.body?.cohort || DEFAULT_COHORT;
        const subject = String(req.body?.subject || "").trim();
        const message = String(req.body?.message || "").trim();
        const tracks = Array.isArray(req.body?.tracks)
            ? req.body.tracks.map(normalizeTrack).filter(Boolean)
            : [];

        if (!subject || subject.length > 150) {
            return res.status(400).json({ success: false, message: "Add a subject (up to 150 characters)." });
        }
        if (!message || message.length > 5000) {
            return res.status(400).json({ success: false, message: "Add a message (up to 5000 characters)." });
        }

        const sender = await User.findById(req.adminUser?._id).select("fullName").lean();
        const batchId = crypto.randomBytes(6).toString("hex");

        const queued = await notify.trackMessage({
            cohort,
            tracks,
            subject,
            message,
            senderName: sender?.fullName || null,
            batchId,
        });

        return res.json({
            success: true,
            message: queued
                ? `${queued} email${queued === 1 ? "" : "s"} queued. They go out over the next few minutes.`
                : "Nobody to email in that selection.",
            data: { queued, batchId },
        });
    } catch (error) {
        console.error("[admin_cohort] email", error);
        return res.status(500).json({ success: false, message: "Could not send the email." });
    }
});

/* ------------------------------------------------------------
   COHORT ONBOARDING EMAIL (with the D-Day banner)
   GET  /onboarding/status   how many students, how many already sent
   POST /onboarding/test     send ONLY to the test address
   POST /onboarding/send     send to every registered student (once each)
------------------------------------------------------------ */
// Test emails go ONLY to these (comma separated in ONBOARDING_TEST_EMAILS to change)
const ONBOARDING_TEST_EMAILS = String(
    process.env.ONBOARDING_TEST_EMAILS || "danieldaudu65@gmail.com,preciousgbadebo01@gmail.com"
)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
const ONBOARDING_KEY = (cohort) => `cohort-onboarding:${cohort}`;
const ONBOARDING_BANNER = [
    {
        filename: "blockhub-cohort-dday.jpg",
        path: path.join(__dirname, "..", "assets", "email", "cohort-onboarding.jpg"),
        cid: "onboarding-banner",
    },
];

function onboardingData(body) {
    const time = String(body?.time || "").trim().slice(0, 60);
    const date = String(body?.date || "").trim().slice(0, 60);
    const note = String(body?.note || "").trim().slice(0, 2000);
    // Onboarding email: any https link is fine (calendar invite, Meet, etc).
    // Only admins can send this, so no site restriction here.
    let link = null;
    const raw = String(body?.link || "").trim();
    if (raw) {
        let url;
        try {
            url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        } catch {
            throw new Error("That doesn't look like a link. Paste the full link, e.g. https://calendar.app.google/...");
        }
        url.protocol = "https:";
        link = url.toString();
    }
    return { time, date, note, link };
}

async function onboardingRecipients(cohort) {
    const regs = await CohortRegistration.find({ cohort, status: { $ne: "rejected" } })
        .select("user email fullName")
        .lean();
    const seen = new Set();
    const list = [];
    for (const r of regs) {
        const email = String(r.email || "").trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        list.push({ userId: r.user ? String(r.user) : null, email, name: r.fullName });
    }
    return list;
}

router.get("/onboarding/status", async (req, res) => {
    try {
        const cohort = req.query.cohort || DEFAULT_COHORT;
        const recipients = await onboardingRecipients(cohort);
        const keyRegex = new RegExp(`^${ONBOARDING_KEY(cohort).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`);
        const [sent, queued, failed] = await Promise.all([
            EmailLog.countDocuments({ dedupeKey: keyRegex, status: "sent" }),
            EmailLog.countDocuments({ dedupeKey: keyRegex, status: "queued" }),
            EmailLog.countDocuments({ template: "cohort_onboarding", status: "failed", createdAt: { $gte: new Date(Date.now() - 2 * 86400000) } }),
        ]);
        return res.json({
            success: true,
            data: { cohort, recipients: recipients.length, sent, queued, failed, testEmail: ONBOARDING_TEST_EMAILS.join(", ") },
        });
    } catch (error) {
        console.error("[admin_cohort] onboarding status", error);
        return res.status(500).json({ success: false, message: "Could not load the onboarding status." });
    }
});

router.post("/onboarding/test", async (req, res) => {
    try {
        let data;
        try {
            data = onboardingData(req.body);
        } catch (linkError) {
            return res.status(400).json({ success: false, message: linkError.message });
        }
        const sent = [];
        const failed = [];
        for (const to of ONBOARDING_TEST_EMAILS) {
            const result = await sendEmail({
                to,
                template: "cohort_onboarding",
                category: "essential",
                data: { ...data, name: to.startsWith("precious") ? "Precious" : "Daniel" },
                attachments: ONBOARDING_BANNER,
            });
            if (result.status === "sent") sent.push(to);
            else failed.push(`${to} (${result.reason || result.status})`);
        }
        if (!sent.length) {
            return res.status(400).json({ success: false, message: `Test not sent: ${failed.join(", ")}` });
        }
        return res.json({
            success: true,
            message: `Test email sent to ${sent.join(" and ")}.${failed.length ? ` Not sent: ${failed.join(", ")}.` : ""} Check inbox (and spam).`,
        });
    } catch (error) {
        console.error("[admin_cohort] onboarding test", error);
        return res.status(500).json({ success: false, message: "Could not send the test email." });
    }
});

router.post("/onboarding/send", async (req, res) => {
    try {
        if (req.body?.confirm !== true) {
            return res.status(400).json({ success: false, message: "Please confirm before sending." });
        }
        const cohort = req.body?.cohort || DEFAULT_COHORT;
        let data;
        try {
            data = onboardingData(req.body);
        } catch (linkError) {
            return res.status(400).json({ success: false, message: linkError.message });
        }
        if (!data.link) {
            return res.status(400).json({ success: false, message: "Add the onboarding call link first." });
        }

        const recipients = await onboardingRecipients(cohort);
        // Same dedupe key every time -> pressing the button again never
        // emails the same student twice (it only reaches people who were missed).
        const queued = queueBulk(recipients, {
            template: "cohort_onboarding",
            category: "essential",
            dedupePrefix: ONBOARDING_KEY(cohort),
            data,
            attachments: ONBOARDING_BANNER,
        });

        return res.json({
            success: true,
            message: `Sending to ${queued} students. It takes a few minutes; anyone who already got it is skipped.`,
            data: { queued },
        });
    } catch (error) {
        console.error("[admin_cohort] onboarding send", error);
        return res.status(500).json({ success: false, message: "Could not start sending." });
    }
});

module.exports = router;
module.exports.MASTER_TIMETABLE = MASTER_TIMETABLE;
