/*
 * ============================================================
 * Emails for BlockHub Meetings
 * ============================================================
 * Every email that says "you're booked" or "the time changed"
 * carries a calendar invite (.ics), so the meeting appears in -
 * and stays in sync with - the person's Google / Outlook / Apple
 * calendar.
 *
 * All of them go through the normal email service, so TEST MODE,
 * the email log and dedupe all apply.
 * ============================================================
 */

const { sendEmail, queueEmail, safely, isValidEmail } = require("../email");
const { getConfig } = require("../email/config");
const { icalEventFor, calendarLinks, meetingUrl, endsAtOf } = require("./calendar");
const { meetingAccessToken, meetingInviteToken } = require("./tokens");

function meetingInfo(meeting) {
    return {
        code: meeting.code,
        title: meeting.title,
        description: meeting.description || "",
        startsAt: meeting.startsAt,
        endsAt: endsAtOf(meeting),
        durationMinutes: meeting.durationMinutes,
        hostName: meeting.hostName || "BlockHub",
        url: meetingUrl(meeting),
    };
}

/** Personal links: open the meeting page already "signed in" as this RSVP */
function personalLinks(meeting, rsvp) {
    const token = encodeURIComponent(meetingAccessToken(meeting, rsvp._id));
    const base = meetingUrl(meeting);
    return {
        joinUrl: `${base}?t=${token}`,
        declineUrl: `${base}?t=${token}&action=decline`,
    };
}

function goingRsvps(meeting) {
    return (meeting.rsvps || []).filter((r) => r.status === "going" && isValidEmail(r.email));
}

/** Queue one email per person, respecting the TEST MODE batch limit */
function queueEach(people, build) {
    const config = getConfig();
    let count = 0;
    for (const person of people) {
        count += 1;
        const job = build(person);
        if (!job) continue;
        queueEmail({ ...job, _skipTestLimit: config.testMode && count > config.testMaxPerBatch });
    }
    if (count) {
        console.log(`[email] queued ${count} meeting emails${config.testMode ? " (TEST MODE)" : ""}`);
    }
    return count;
}

/* ------------------------------------------------------------ */

/** Someone said "I'll attend" -> confirmation + calendar invite */
function rsvpConfirmed(meeting, rsvp) {
    return sendEmail({
        to: rsvp.email,
        template: "meeting_rsvp_confirmed",
        category: "essential",
        user: rsvp.user || null,
        dedupeKey: `meeting-rsvp:${meeting._id}:${rsvp.email}:s${meeting.sequence || 0}:${new Date(rsvp.respondedAt).getTime()}`,
        icalEvent: icalEventFor(meeting, { method: "REQUEST", attendee: rsvp }),
        data: {
            name: rsvp.name,
            meeting: meetingInfo(meeting),
            links: calendarLinks(meeting),
            ...personalLinks(meeting, rsvp),
        },
    }).catch((error) => console.error("[meetings] rsvp email:", error?.message));
}

/** Someone cancelled their spot -> remove from their calendar */
function rsvpDeclined(meeting, rsvp) {
    return sendEmail({
        to: rsvp.email,
        template: "meeting_rsvp_declined",
        category: "essential",
        user: rsvp.user || null,
        dedupeKey: `meeting-decline:${meeting._id}:${rsvp.email}:${new Date(rsvp.respondedAt).getTime()}`,
        icalEvent: icalEventFor(meeting, { method: "CANCEL", attendee: rsvp }),
        data: {
            name: rsvp.name,
            meeting: meetingInfo(meeting),
            joinUrl: meetingUrl(meeting),
        },
    }).catch((error) => console.error("[meetings] decline email:", error?.message));
}

/** Admin invited people by email */
function invite(meeting, people, { message = "", invitedBy = "", resend = false } = {}) {
    const stamp = resend ? `:${Date.now()}` : "";
    return queueEach(people, (person) => {
        const token = encodeURIComponent(meetingInviteToken(meeting, person.email, person.name || ""));
        const base = meetingUrl(meeting);
        return {
            to: person.email,
            template: "meeting_invite",
            category: "essential",
            dedupeKey: `meeting-invite:${meeting._id}:${person.email}${stamp}`,
            data: {
                name: person.name || "",
                meeting: meetingInfo(meeting),
                message,
                invitedBy,
                acceptUrl: `${base}?invite=${token}`,
                declineUrl: `${base}?invite=${token}&action=decline`,
            },
        };
    });
}

/** Time / title changed -> everyone booked gets the updated invite */
function updated(meeting, previousStartsAt) {
    safely(() => {
        const links = calendarLinks(meeting);
        queueEach(goingRsvps(meeting), (rsvp) => ({
            to: rsvp.email,
            template: "meeting_updated",
            category: "essential",
            user: rsvp.user || null,
            dedupeKey: `meeting-update:${meeting._id}:s${meeting.sequence}:${rsvp.email}`,
            icalEvent: icalEventFor(meeting, { method: "REQUEST", attendee: rsvp }),
            data: {
                name: rsvp.name,
                meeting: meetingInfo(meeting),
                previousStartsAt,
                links,
                joinUrl: personalLinks(meeting, rsvp).joinUrl,
            },
        }));
    }, "meetings.updated");
}

/** Cancelled -> tell everyone booked and remove it from their calendars */
function cancelled(meeting, reason) {
    safely(() => {
        queueEach(goingRsvps(meeting), (rsvp) => ({
            to: rsvp.email,
            template: "meeting_cancelled",
            category: "essential",
            user: rsvp.user || null,
            dedupeKey: `meeting-cancel:${meeting._id}:${rsvp.email}`,
            icalEvent: icalEventFor(meeting, { method: "CANCEL", attendee: rsvp }),
            data: { name: rsvp.name, meeting: meetingInfo(meeting), reason },
        }));
    }, "meetings.cancelled");
}

/** Host started the call -> nudge people who booked but aren't in yet */
function live(meeting, liveSession) {
    safely(async () => {
        if (meeting.settings?.notifyOnStart === false) return;

        const LiveAttendance = require("../../models/LiveAttendance");
        const inCall = await LiveAttendance.find({ session: liveSession._id }).select("user").lean();
        const inCallIds = new Set(inCall.map((row) => String(row.user)));

        const people = goingRsvps(meeting).filter(
            (r) => !inCallIds.has(String(r._id)) && !(r.user && inCallIds.has(String(r.user)))
        );

        const startedKey = new Date(liveSession.startedAt || Date.now()).getTime();
        queueEach(people, (rsvp) => ({
            to: rsvp.email,
            template: "meeting_live",
            category: "essential",
            user: rsvp.user || null,
            dedupeKey: `meeting-live:${meeting._id}:${startedKey}:${rsvp.email}`,
            data: {
                name: rsvp.name,
                meeting: meetingInfo(meeting),
                joinUrl: personalLinks(meeting, rsvp).joinUrl,
            },
        }));
    }, "meetings.live");
}

/* ------------------------------------------------------------
   Scheduled: reminder 1 hour before (run every 5 minutes)
------------------------------------------------------------ */
async function reminders() {
    const Meeting = require("../../models/Meeting");
    const now = Date.now();

    const meetings = await Meeting.find({
        status: { $in: ["scheduled", "live"] },
        startsAt: { $gt: new Date(now + 5 * 60000), $lte: new Date(now + 65 * 60000) },
    });

    for (const meeting of meetings) {
        const startKey = new Date(meeting.startsAt).getTime();
        // Don't remind someone who booked in the last 30 minutes
        const people = goingRsvps(meeting).filter(
            (r) => new Date(r.respondedAt).getTime() < now - 30 * 60000
        );

        queueEach(people, (rsvp) => ({
            to: rsvp.email,
            template: "meeting_reminder",
            category: "essential",
            user: rsvp.user || null,
            dedupeKey: `meeting-reminder:${meeting._id}:${startKey}:${rsvp.email}`,
            data: {
                name: rsvp.name,
                meeting: meetingInfo(meeting),
                joinUrl: personalLinks(meeting, rsvp).joinUrl,
            },
        }));
    }
}

module.exports = {
    meetingInfo,
    personalLinks,
    rsvpConfirmed,
    rsvpDeclined,
    invite,
    updated,
    cancelled,
    live,
    reminders,
};
