/*
 * ============================================================
 * Scheduled emails (node-cron, Lagos time)
 * ============================================================
 *   every 5 min  - class reminders (1 hour before)
 *   every 5 min  - BlockHub Meetings reminders (1 hour before)
 *   every 30 min - "new campaign is live"
 *   hourly       - campaign ending in 24h / campaign ended
 *   daily 10:00  - academy "pick up where you left off"
 *   daily 19:00  - campaign owners' daily summary
 *   Mon 08:00    - cohort weekly digest
 *
 * Every email has a dedupe key, so restarts or running more
 * than one server never sends the same email twice.
 * Turn all of this off with EMAIL_JOBS_ENABLED=false
 * ============================================================
 */

const cron = require("node-cron");

const { queueBulk } = require("./index");
const { getConfig } = require("./config");
const notify = require("./notify");

const TZ = process.env.COHORT_TIMEZONE || "Africa/Lagos";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const M = {
    get CohortClass() { return require("../../models/CohortClass"); },
    get CohortRegistration() { return require("../../models/Cohort"); },
    get CohortAnnouncement() { return require("../../models/CohortAnnouncement"); },
    get LiveSession() { return require("../../models/LiveSession"); },
    get Campaign() { return require("../../models/Campaign"); },
    get CampaignParticipant() { return require("../../models/CampaignParticipant"); },
    get CampaignSubmission() { return require("../../models/CampaignSubmission"); },
    get Enrollment() { return require("../../models/Enrollment"); },
    get User() { return require("../../models/user"); },
};

function dayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

/** Users (with email) from a list of ids */
async function contactsFor(userIds) {
    if (!userIds.length) return [];
    const users = await M.User.find({ _id: { $in: userIds }, email: { $nin: [null, ""] } })
        .select("_id fullName email")
        .lean();
    return users.map((u) => ({ userId: String(u._id), email: u.email, name: u.fullName }));
}

/* ------------------------------------------------------------
   1. Class reminders - 1 hour before
------------------------------------------------------------ */
async function classReminders() {
    const now = Date.now();
    // startDate is stored as a calendar date, so look at yesterday..tomorrow
    const classes = await M.CohortClass.find({
        status: { $in: ["scheduled", "ongoing"] },
        emailStudents: { $ne: false }, // tutor turned emails off (test class)
        startDate: { $gte: new Date(now - 2 * DAY), $lte: new Date(now + 2 * DAY) },
    }).lean();

    for (const classDoc of classes) {
        const cls = notify.classInfo(classDoc);
        if (!cls.startsAt) continue;
        const msUntil = cls.startsAt.getTime() - now;
        if (msUntil <= 50 * 60 * 1000 || msUntil > 65 * 60 * 1000) continue;

        const session = await M.LiveSession.findOne({
            cohortClass: classDoc._id,
            status: { $ne: "ended" },
        })
            .select("code")
            .lean();

        const students = await notify.trackStudents(classDoc.cohort, classDoc.track);
        queueBulk(students, {
            template: "class_reminder",
            category: "classUpdates",
            dedupePrefix: `class-reminder:${classDoc._id}:${cls.startsAt.getTime()}`,
            data: {
                track: classDoc.track,
                cls,
                joinUrl: session ? `${getConfig().frontendUrl}/class/${session.code}` : null,
            },
        });
    }
}

/* ------------------------------------------------------------
   2. Weekly cohort digest - Monday morning
------------------------------------------------------------ */
async function weeklyDigest() {
    const now = Date.now();
    const weekKey = dayKey();

    const groups = await M.CohortRegistration.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        { $group: { _id: { cohort: "$cohort", track: "$track" } } },
    ]);

    for (const { _id: group } of groups) {
        if (!group?.track) continue;

        const classes = (
            await M.CohortClass.find({
                cohort: group.cohort,
                track: group.track,
                status: { $in: ["scheduled", "ongoing"] },
                emailStudents: { $ne: false },
                startDate: { $gte: new Date(now - DAY), $lte: new Date(now + 8 * DAY) },
            })
                .sort({ startDate: 1 })
                .lean()
        )
            .map((c) => notify.classInfo(c))
            .filter((c) => c.startsAt && c.startsAt.getTime() >= now && c.startsAt.getTime() <= now + 7 * DAY);

        const announcements = await M.CohortAnnouncement.find({
            cohort: group.cohort,
            track: group.track,
            createdAt: { $gte: new Date(now - 7 * DAY) },
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        if (!classes.length && !announcements.length) continue;

        const students = await notify.trackStudents(group.cohort, group.track);
        queueBulk(students, {
            template: "weekly_digest",
            category: "digest",
            dedupePrefix: `digest:${weekKey}:${group.track}`,
            data: {
                track: group.track,
                classes,
                announcements: announcements.map((a) => ({ title: a.title, message: a.message })),
            },
        });
    }
}

/* ------------------------------------------------------------
   3. New campaign live -> people who've done GrindFi before
------------------------------------------------------------ */
async function campaignsWentLive() {
    const now = Date.now();
    const campaigns = await M.Campaign.find({
        status: { $nin: ["cancelled", "paused", "completed"] },
        startDate: { $lte: new Date(now), $gte: new Date(now - 6 * HOUR) },
        endDate: { $gt: new Date(now) },
    }).lean();

    if (!campaigns.length) return;

    // Audience: anyone who has joined a GrindFi campaign before
    const pastUserIds = await M.CampaignParticipant.distinct("user");

    for (const campaign of campaigns) {
        const alreadyIn = new Set(
            (await M.CampaignParticipant.distinct("user", { campaign: campaign._id })).map(String)
        );
        const ids = pastUserIds.filter((id) => !alreadyIn.has(String(id)) && String(id) !== String(campaign.owner));
        const recipients = await contactsFor(ids);

        queueBulk(recipients, {
            template: "campaign_live",
            category: "campaigns",
            dedupePrefix: `campaign-live:${campaign._id}`,
            data: { campaign: notify.campaignInfo(campaign) },
        });
    }
}

/* ------------------------------------------------------------
   4. Campaign ending in ~24h -> participants with unfinished tasks
------------------------------------------------------------ */
async function campaignsEndingSoon() {
    const now = Date.now();
    const campaigns = await M.Campaign.find({
        status: { $nin: ["cancelled", "completed"] },
        endDate: { $gt: new Date(now + 23 * HOUR), $lte: new Date(now + 24 * HOUR) },
    }).lean();

    for (const campaign of campaigns) {
        const participants = await M.CampaignParticipant.find({ campaign: campaign._id }).lean();
        const unfinished = participants.filter((p) => (p.completedTasks || 0) < (p.totalTasks || 0));
        const contacts = await contactsFor(unfinished.map((p) => p.user));
        const byUser = new Map(unfinished.map((p) => [String(p.user), p]));

        queueBulk(
            contacts.map((c) => {
                const p = byUser.get(c.userId);
                return { ...c, data: { remainingTasks: Math.max(1, (p.totalTasks || 0) - (p.completedTasks || 0)) } };
            }),
            {
                template: "campaign_ending_soon",
                category: "campaigns",
                dedupePrefix: `campaign-ending:${campaign._id}`,
                data: { campaign: notify.campaignInfo(campaign) },
            }
        );
    }
}

/* ------------------------------------------------------------
   5. Campaign ended -> all participants
------------------------------------------------------------ */
async function campaignsEnded() {
    const now = Date.now();
    const campaigns = await M.Campaign.find({
        status: { $ne: "cancelled" },
        endDate: { $gt: new Date(now - 3 * HOUR), $lte: new Date(now) },
    }).lean();

    for (const campaign of campaigns) {
        const participants = await M.CampaignParticipant.find({ campaign: campaign._id }).lean();
        const contacts = await contactsFor(participants.map((p) => p.user));
        const byUser = new Map(participants.map((p) => [String(p.user), p]));

        queueBulk(
            contacts.map((c) => {
                const p = byUser.get(c.userId);
                return { ...c, data: { completedTasks: p.completedTasks || 0, totalTasks: p.totalTasks || 0 } };
            }),
            {
                template: "campaign_ended",
                category: "campaigns",
                dedupePrefix: `campaign-ended:${campaign._id}`,
                data: { campaign: notify.campaignInfo(campaign) },
            }
        );
    }
}

/* ------------------------------------------------------------
   6. Daily summary for campaign owners
------------------------------------------------------------ */
async function ownerDailySummary() {
    const now = Date.now();
    const since = new Date(now - DAY);

    const campaigns = await M.Campaign.find({
        status: { $ne: "cancelled" },
        startDate: { $lte: new Date(now) },
        endDate: { $gte: since },
    })
        .select("_id title owner stats")
        .lean();

    const byOwner = new Map();

    for (const campaign of campaigns) {
        const [newParticipants, newSubmissions, totalParticipants] = await Promise.all([
            M.CampaignParticipant.countDocuments({ campaign: campaign._id, createdAt: { $gte: since } }),
            M.CampaignSubmission.countDocuments({ campaign: campaign._id, createdAt: { $gte: since } }),
            M.CampaignParticipant.countDocuments({ campaign: campaign._id }),
        ]);
        if (!newParticipants && !newSubmissions) continue;

        const key = String(campaign.owner);
        if (!byOwner.has(key)) byOwner.set(key, []);
        byOwner.get(key).push({ title: campaign.title, newParticipants, newSubmissions, totalParticipants });
    }

    if (!byOwner.size) return;
    const owners = await contactsFor([...byOwner.keys()]);

    queueBulk(
        owners.map((o) => ({ ...o, data: { campaigns: byOwner.get(o.userId) } })),
        {
            template: "campaign_owner_daily",
            category: "campaigns",
            dedupePrefix: `owner-daily:${dayKey()}`,
        }
    );
}

/* ------------------------------------------------------------
   7. Academy nudge - inactive for 7 days mid-course
------------------------------------------------------------ */
async function courseNudges() {
    const now = Date.now();
    const enrollments = await M.Enrollment.find({
        completed: false,
        lastAccessedAt: { $gte: new Date(now - 8 * DAY), $lt: new Date(now - 7 * DAY) },
    })
        .populate("course", "_id name")
        .lean();

    if (!enrollments.length) return;
    const contacts = await contactsFor(enrollments.map((e) => e.user));
    const byUser = new Map(contacts.map((c) => [c.userId, c]));

    for (const e of enrollments) {
        const contact = byUser.get(String(e.user));
        if (!contact || !e.course) continue;
        queueBulk([{ ...contact, data: { progress: Math.round(e.progress || 0) } }], {
            template: "course_nudge",
            category: "learning",
            dedupePrefix: `nudge:${e._id}:${dayKey()}`,
            data: { course: { id: String(e.course._id), name: e.course.name } },
        });
    }
}

/* ------------------------------------------------------------
   Start
------------------------------------------------------------ */

/* ------------------------------------------------------------
   BlockHub Meetings - reminder 1 hour before
------------------------------------------------------------ */
async function meetingReminders() {
    await require("../meetings/notify").reminders();
}

function wrap(name, fn) {
    return async () => {
        try {
            await fn();
        } catch (error) {
            console.error(`[email-job:${name}]`, error?.message || error);
        }
    };
}

let started = false;

function startEmailJobs() {
    if (started) return;
    if (!getConfig().jobsEnabled) {
        console.log("[email] scheduled emails are OFF (EMAIL_JOBS_ENABLED=false)");
        return;
    }
    started = true;

    const opts = { timezone: TZ };
    cron.schedule("*/5 * * * *", wrap("classReminders", classReminders), opts);
    cron.schedule("2-59/5 * * * *", wrap("meetingReminders", meetingReminders), opts);
    cron.schedule("*/30 * * * *", wrap("campaignsWentLive", campaignsWentLive), opts);
    cron.schedule("5 * * * *", wrap("campaignsEndingSoon", campaignsEndingSoon), opts);
    cron.schedule("10 * * * *", wrap("campaignsEnded", campaignsEnded), opts);
    cron.schedule("0 10 * * *", wrap("courseNudges", courseNudges), opts);
    cron.schedule("0 19 * * *", wrap("ownerDailySummary", ownerDailySummary), opts);
    cron.schedule("0 8 * * 1", wrap("weeklyDigest", weeklyDigest), opts);

    console.log("[email] scheduled emails started");
}

module.exports = {
    startEmailJobs,
    // exported so an admin can trigger them manually / for testing
    jobs: {
        classReminders,
        meetingReminders,
        weeklyDigest,
        campaignsWentLive,
        campaignsEndingSoon,
        campaignsEnded,
        ownerDailySummary,
        courseNudges,
    },
};
