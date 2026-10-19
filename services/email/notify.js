/*
 * ============================================================
 * notify.*  -  "something happened, email the right people"
 * ============================================================
 * Routes call these ONE line, fire-and-forget, e.g.
 *
 *     notify.announcementPosted(announcement, req.user);
 *
 * They never throw and never slow down the API response.
 * ============================================================
 */

const mongoose = require("mongoose");

const { sendEmail, queueEmail, queueBulk, safely } = require("./index");
const { verifyEmailToken } = require("./tokens");
const { getConfig } = require("./config");

// Models are required lazily (avoids circular requires at startup)
const M = {
    get User() { return require("../../models/user"); },
    get CohortRegistration() { return require("../../models/Cohort"); },
    get CohortTutor() { return require("../../models/CohortTutor"); },
    get LiveAttendance() { return require("../../models/LiveAttendance"); },
    get Referral() { return require("../../models/Referral"); },
};

const { getClassStartsAt, getClassEndsAt } = require("../../utils/classTime");

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function formatDuration(minutes) {
    const m = Number(minutes) || 0;
    if (!m) return "";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} hr ${r} min` : `${h} hr`;
}

function classInfo(classDoc) {
    return {
        id: String(classDoc._id),
        title: classDoc.title,
        description: classDoc.description || "",
        classNumber: classDoc.classNumber || null,
        startsAt: getClassStartsAt(classDoc),
        endsAt: getClassEndsAt(classDoc),
        duration: formatDuration(classDoc.durationMinutes),
    };
}

function rewardText(campaign) {
    const r = campaign?.reward || {};
    if (!r.currency) return "";
    if (r.type === "pool" && r.totalPool) return `${Number(r.totalPool).toLocaleString()} ${r.currency} pool`;
    if (r.amount) return `${Number(r.amount).toLocaleString()} ${r.currency}`;
    return "";
}

function campaignInfo(campaign) {
    return {
        id: String(campaign._id),
        title: campaign.title,
        slug: campaign.slug,
        description: campaign.description,
        endDate: campaign.endDate,
        rewardText: rewardText(campaign),
    };
}

async function userContact(userId) {
    if (!userId) return null;
    const user = await M.User.findById(userId).select("_id fullName email").lean();
    if (!user?.email) return null;
    return { userId: String(user._id), email: user.email, name: user.fullName };
}

/** Everyone registered in a cohort track (not rejected) */
async function trackStudents(cohort, track, { excludeUserIds = [] } = {}) {
    const exclude = new Set(excludeUserIds.map(String));
    const regs = await M.CohortRegistration.find({
        cohort,
        track,
        status: { $ne: "rejected" },
    })
        .select("user email fullName")
        .lean();

    return regs
        .filter((r) => !exclude.has(String(r.user)))
        .map((r) => ({ userId: String(r.user), email: r.email, name: r.fullName }));
}

/* ============================================================
   ACCOUNT
============================================================ */

/** Send a "confirm your email" link. Awaitable (route shows result). */
async function sendVerification(user, email) {
    const config = getConfig();
    const token = verifyEmailToken(user._id, email);
    const url = `${config.apiUrl}/email/verify?token=${encodeURIComponent(token)}`;
    return sendEmail({
        to: email,
        template: "verify_email",
        data: { name: user.fullName, url },
        category: "essential",
    });
}

function welcome(user) {
    safely(async () => {
        if (!user?.email) return;
        queueEmail({
            to: user.email,
            template: "welcome",
            data: { name: user.fullName },
            category: "essential",
            user: user._id,
            dedupeKey: `welcome:${user._id}`,
        });
    }, "notify.welcome");
}

function waitlistJoined(email) {
    safely(() => queueEmail({
        to: email,
        template: "waitlist_joined",
        category: "essential",
        dedupeKey: `waitlist:${String(email).toLowerCase()}`,
    }), "notify.waitlist");
}

/* ============================================================
   COHORT
============================================================ */

function cohortLoginLink({ email, name, url }) {
    // Awaited by the route so we can tell the user if it failed
    return sendEmail({
        to: email,
        template: "cohort_login_link",
        data: { name, url },
        category: "essential",
    });
}

function announcementPosted(announcement, tutorUser) {
    safely(async () => {
        const students = await trackStudents(announcement.cohort, announcement.track);
        queueBulk(students, {
            template: "announcement",
            category: "announcements",
            dedupePrefix: `announcement:${announcement._id}`,
            data: {
                tutorName: tutorUser?.fullName,
                track: announcement.track,
                title: announcement.title,
                message: announcement.message,
                type: announcement.type,
            },
        });
    }, "notify.announcement");
}

/** Tutor unticked "Email students" (test class) -> send nothing about it */
const emailsOff = (classDoc) => classDoc?.emailStudents === false;

function classScheduled(classDoc) {
    safely(async () => {
        if (emailsOff(classDoc)) return;
        const cls = classInfo(classDoc);
        if (cls.startsAt && cls.startsAt < new Date()) return; // created in the past - skip
        const students = await trackStudents(classDoc.cohort, classDoc.track);
        queueBulk(students, {
            template: "class_scheduled",
            category: "classUpdates",
            dedupePrefix: `class-new:${classDoc._id}`,
            data: { track: classDoc.track, cls },
        });
    }, "notify.classScheduled");
}

function classUpdated(classDoc, previousStartsAt) {
    safely(async () => {
        if (emailsOff(classDoc)) return;
        const cls = classInfo(classDoc);
        if (!cls.startsAt || cls.startsAt < new Date()) return;
        const students = await trackStudents(classDoc.cohort, classDoc.track);
        queueBulk(students, {
            template: "class_updated",
            category: "classUpdates",
            // new key per new time, so a second change also notifies
            dedupePrefix: `class-moved:${classDoc._id}:${cls.startsAt.getTime()}`,
            data: { track: classDoc.track, cls, changes: { previousStartsAt } },
        });
    }, "notify.classUpdated");
}

function classCancelled(classDoc) {
    safely(async () => {
        if (emailsOff(classDoc)) return;
        const cls = classInfo(classDoc);
        if (cls.startsAt && cls.startsAt < new Date()) return;
        const students = await trackStudents(classDoc.cohort, classDoc.track);
        queueBulk(students, {
            template: "class_cancelled",
            category: "classUpdates",
            dedupePrefix: `class-cancelled:${classDoc._id}`,
            data: { track: classDoc.track, cls },
        });
    }, "notify.classCancelled");
}

/** Tutor started a live class - email students not already in it */
function classLive(session, tutorName) {
    safely(async () => {
        const inCall = await M.LiveAttendance.find({ session: session._id }).select("user").lean();
        const students = await trackStudents(session.cohort, session.track, {
            excludeUserIds: inCall.map((a) => a.user),
        });
        queueBulk(students, {
            template: "class_live",
            category: "classUpdates",
            dedupePrefix: `class-live:${session._id}`,
            data: {
                track: session.track,
                title: session.title,
                tutorName,
                joinUrl: `${getConfig().frontendUrl}/class/${session.code}`,
            },
        });
    }, "notify.classLive");
}

/** After a scheduled class's live session ends: nudge students who never joined */
function missedClass(session) {
    safely(async () => {
        if (!session.cohortClass || !session.startedAt) return;
        const classDoc = await require("../../models/CohortClass").findById(session.cohortClass).select("emailStudents").lean();
        if (emailsOff(classDoc)) return;
        const minutes = (new Date(session.endedAt || Date.now()) - new Date(session.startedAt)) / 60000;
        if (minutes < 10) return; // tutor just tested the room

        const joined = await M.LiveAttendance.find({ session: session._id }).select("user").lean();
        const absent = await trackStudents(session.cohort, session.track, {
            excludeUserIds: joined.map((a) => a.user),
        });

        queueBulk(absent, {
            template: "missed_class",
            category: "classUpdates",
            dedupePrefix: `missed:${session._id}`,
            data: { track: session.track, title: session.title, endedAt: session.endedAt || new Date() },
        });
    }, "notify.missedClass");
}

function tutorAssigned(user, cohortTutor) {
    safely(() => queueEmail({
        to: user.email,
        template: "tutor_assigned",
        category: "essential",
        user: user._id,
        dedupeKey: `tutor-assigned:${cohortTutor._id}`,
        data: { name: user.fullName, track: cohortTutor.track, tutorCode: cohortTutor.tutorCode },
    }), "notify.tutorAssigned");
}

function trackSwitched(registration) {
    safely(() => queueEmail({
        to: registration.email,
        template: "track_switched",
        category: "essential",
        user: registration.user,
        dedupeKey: `track-switch:${registration._id}:${registration.track}:${Date.now()}`,
        data: { name: registration.fullName, track: registration.track },
    }), "notify.trackSwitched");
}

/* ============================================================
   GRINDFI
============================================================ */

function campaignJoined(userId, campaign, totalTasks) {
    safely(async () => {
        const contact = await userContact(userId);
        if (!contact) return;
        queueEmail({
            to: contact.email,
            template: "campaign_joined",
            category: "campaigns",
            user: contact.userId,
            dedupeKey: `campaign-joined:${campaign._id}:${contact.userId}`,
            data: { name: contact.name, campaign: campaignInfo(campaign), totalTasks },
        });
    }, "notify.campaignJoined");
}

function campaignTaskSubmitted(userId, campaign, task, submissionId) {
    safely(async () => {
        const contact = await userContact(userId);
        if (!contact) return;
        queueEmail({
            to: contact.email,
            template: "campaign_task_submitted",
            category: "campaigns",
            user: contact.userId,
            dedupeKey: `campaign-submitted:${submissionId || `${task?._id}:${contact.userId}`}`,
            data: { name: contact.name, campaign: campaignInfo(campaign), taskTitle: task?.title },
        });
    }, "notify.campaignTaskSubmitted");
}

/* ============================================================
   ACADEMY
============================================================ */

function courseEnrolled(userId, course) {
    safely(async () => {
        const contact = await userContact(userId);
        if (!contact) return;
        queueEmail({
            to: contact.email,
            template: "course_enrolled",
            category: "learning",
            user: contact.userId,
            dedupeKey: `enrolled:${course._id}:${contact.userId}`,
            data: {
                name: contact.name,
                course: {
                    id: String(course._id),
                    name: course.name,
                    level: course.level,
                    lessonCount: course.lessons?.length || 0,
                },
            },
        });
    }, "notify.courseEnrolled");
}

function courseCompleted(enrollment) {
    safely(async () => {
        const user = enrollment.user;
        const course = enrollment.course;
        if (!user?.email || !course) return;
        queueEmail({
            to: user.email,
            template: "course_completed",
            category: "essential",
            user: user._id,
            dedupeKey: `course-completed:${enrollment._id}`,
            data: {
                name: user.fullName,
                course: { id: String(course._id), name: course.name },
                certificateUrl: enrollment.certificateUrl,
            },
        });
    }, "notify.courseCompleted");
}

function courseSubmittedForReview(tutor, submission) {
    safely(async () => {
        // tutor can be an academy Tutor doc (has .user) or a User
        const tutorUser = tutor?.user
            ? await M.User.findById(tutor.user).select("fullName").lean()
            : tutor;
        const admins = await M.User.find({ admin: true, email: { $ne: null } }).select("_id fullName email").lean();
        queueBulk(
            admins.map((a) => ({ userId: String(a._id), email: a.email, name: a.fullName })),
            {
                template: "course_submitted_admin",
                category: "essential",
                dedupePrefix: `course-review-request:${submission._id}`,
                data: {
                    tutorName: tutorUser?.fullName || "A tutor",
                    courseTitle: submission.courseTitle,
                    description: submission.description,
                },
            }
        );
    }, "notify.courseSubmitted");
}

function courseReviewed(submission) {
    safely(async () => {
        if (!["approved", "rejected"].includes(submission.status)) return;
        const Tutor = require("../../models/Tutor");
        const tutor = await Tutor.findById(submission.tutor).select("user").lean();
        const contact = await userContact(tutor?.user);
        if (!contact) return;
        queueEmail({
            to: contact.email,
            template: "course_review_result",
            category: "essential",
            user: contact.userId,
            dedupeKey: `course-reviewed:${submission._id}:${submission.status}:${submission.updatedAt?.getTime?.() || Date.now()}`,
            data: {
                name: contact.name,
                courseTitle: submission.courseTitle,
                status: submission.status,
                reason: submission.statusMessage,
            },
        });
    }, "notify.courseReviewed");
}

/* ============================================================
   PAYMENTS & MARKETPLACE
============================================================ */

async function sellerContact(purchase) {
    if (!purchase.seller) return null;
    const Model =
        purchase.sellerType === "Seller"
            ? require("../../models/Seller")
            : require("../../models/Tutor");
    const seller = await Model.findById(purchase.seller).select("user").lean();
    return userContact(seller?.user);
}

/** Paid (or free-claimed) course or product: receipt to buyer + sale alert to seller */
function purchaseCompleted(purchase, item) {
    safely(async () => {
        const buyer = await userContact(purchase.user);
        const isCourse = purchase.itemType === "courses";
        const currency = purchase.currency || "NGN";
        const paidAt = purchase.updatedAt || new Date();

        if (buyer) {
            queueEmail({
                to: buyer.email,
                template: isCourse ? "course_receipt" : "product_receipt",
                category: "essential",
                user: buyer.userId,
                dedupeKey: `receipt:${purchase._id}`,
                data: {
                    name: buyer.name,
                    amount: purchase.amount,
                    currency,
                    reference: purchase.paymentReference || String(purchase._id),
                    paidAt,
                    course: isCourse ? { id: String(item?._id || purchase.item), name: item?.name || "Your course" } : undefined,
                    product: !isCourse ? { title: item?.title || "Your product", slug: item?.slug } : undefined,
                },
            });
        }

        // Free claims don't need a "you made a sale" email
        if (currency === "FREE" || !Number(purchase.amount)) return;

        const seller = await sellerContact(purchase);
        if (seller) {
            queueEmail({
                to: seller.email,
                template: "new_sale",
                category: "sales",
                user: seller.userId,
                dedupeKey: `sale:${purchase._id}`,
                data: {
                    name: seller.name,
                    itemName: isCourse ? item?.name : item?.title,
                    itemKind: isCourse ? "course" : "product",
                    amount: purchase.amount,
                    earning: purchase.sellerAmount ?? purchase.tutorAmount ?? purchase.amount,
                    currency,
                },
            });
        }
    }, "notify.purchaseCompleted");
}

function paymentFailed(purchase, item) {
    safely(async () => {
        const buyer = await userContact(purchase.user);
        if (!buyer) return;
        const isCourse = purchase.itemType === "courses";
        const config = getConfig();
        queueEmail({
            to: buyer.email,
            template: "payment_failed",
            category: "essential",
            user: buyer.userId,
            dedupeKey: `payment-failed:${purchase._id}`,
            data: {
                name: buyer.name,
                itemName: isCourse ? item?.name || "your course" : item?.title || "your product",
                retryUrl: isCourse
                    ? `${config.frontendUrl}/t/${purchase.item}`
                    : `${config.frontendUrl}/market/${item?.slug || ""}`,
            },
        });
    }, "notify.paymentFailed");
}

function productPublished(product, seller) {
    safely(async () => {
        const contact = await userContact(seller?.user);
        if (!contact) return;
        queueEmail({
            to: contact.email,
            template: "product_published",
            category: "sales",
            user: contact.userId,
            dedupeKey: `product-published:${product._id}`,
            data: { name: contact.name, product: { title: product.title, slug: product.slug } },
        });
    }, "notify.productPublished");
}

/* ============================================================
   REFERRALS
============================================================ */

function referralUsed(referrerId, referredUser) {
    safely(async () => {
        const contact = await userContact(referrerId);
        if (!contact) return;
        const totalReferrals = await M.Referral.countDocuments({
            referrer: new mongoose.Types.ObjectId(String(referrerId)),
        });
        queueEmail({
            to: contact.email,
            template: "referral_used",
            category: "referrals",
            user: contact.userId,
            dedupeKey: `referral:${referrerId}:${referredUser?._id}`,
            data: { name: contact.name, referredName: referredUser?.fullName, totalReferrals },
        });
    }, "notify.referralUsed");
}

module.exports = {
    // helpers used by jobs
    trackStudents,
    classInfo,
    campaignInfo,
    userContact,
    // account
    sendVerification,
    welcome,
    waitlistJoined,
    // cohort
    cohortLoginLink,
    announcementPosted,
    classScheduled,
    classUpdated,
    classCancelled,
    classLive,
    missedClass,
    tutorAssigned,
    trackSwitched,
    // grindfi
    campaignJoined,
    campaignTaskSubmitted,
    // academy
    courseEnrolled,
    courseCompleted,
    courseSubmittedForReview,
    courseReviewed,
    // payments
    purchaseCompleted,
    paymentFailed,
    productPublished,
    // referrals
    referralUsed,
};
