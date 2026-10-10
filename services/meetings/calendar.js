/*
 * ============================================================
 * Calendar invites for BlockHub Meetings
 * ============================================================
 *   buildIcs(meeting, { method, attendee, status })
 *     -> iCalendar (.ics) text. Sent with the RSVP email so the
 *        meeting lands in Gmail / Google Calendar / Outlook / Apple
 *        Calendar automatically.
 *
 *        method "REQUEST" + attendee PARTSTAT=ACCEPTED
 *            = "you're booked" (Gmail adds it to the calendar)
 *        method "CANCEL"
 *            = removes it from their calendar
 *        method "PUBLISH"
 *            = plain "add to calendar" download
 *
 *   The UID never changes for a meeting and SEQUENCE goes up on
 *   every change, so calendars UPDATE the event instead of adding
 *   a second copy.
 *
 *   calendarLinks(meeting) -> { google, outlook, ics }
 * ============================================================
 */

const { getConfig } = require("../email/config");

function pad(n) {
    return String(n).padStart(2, "0");
}

/** Date -> 20261010T130000Z */
function icsDate(date) {
    const d = new Date(date);
    return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        "T" +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        "Z"
    );
}

/** Escape TEXT values (RFC 5545 3.3.11) */
function icsText(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
}

/** Parameter values (CN=...) can't contain quotes; wrap in quotes if they have : ; , */
function icsParam(value) {
    const clean = String(value ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ").trim();
    return /[:;,]/.test(clean) ? `"${clean}"` : clean;
}

/** Fold lines longer than 75 octets (RFC 5545 3.1) */
function fold(line) {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;

    const parts = [];
    let current = "";
    let currentBytes = 0;
    for (const char of line) {
        const size = Buffer.byteLength(char, "utf8");
        const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
        if (currentBytes + size > limit) {
            parts.push(current);
            current = "";
            currentBytes = 0;
        }
        current += char;
        currentBytes += size;
    }
    if (current) parts.push(current);
    return parts.join("\r\n ");
}

function organizerEmail() {
    const from = getConfig().from || "";
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).trim() || "no-reply@blockhubglobal.xyz";
}

function meetingUrl(meeting) {
    return `${getConfig().frontendUrl}/meet/${meeting.code}`;
}

function endsAtOf(meeting) {
    return new Date(new Date(meeting.startsAt).getTime() + (meeting.durationMinutes || 60) * 60000);
}

function uidOf(meeting) {
    return `meeting-${meeting._id}@blockhubglobal.xyz`;
}

/**
 * @param meeting  Meeting doc (code, title, description, startsAt, durationMinutes, sequence, _id)
 * @param options.method    "REQUEST" | "CANCEL" | "PUBLISH"
 * @param options.attendee  { name, email } (REQUEST / CANCEL)
 */
function buildIcs(meeting, { method = "REQUEST", attendee = null } = {}) {
    const url = meetingUrl(meeting);
    const cancelled = method === "CANCEL" || meeting.status === "cancelled";

    const description = [
        meeting.description ? String(meeting.description).trim() : "",
        `Join the call: ${url}`,
        "Hosted on BlockHub Live.",
    ]
        .filter(Boolean)
        .join("\n\n");

    const lines = [
        "BEGIN:VCALENDAR",
        "PRODID:-//BlockHub//Meetings//EN",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        `METHOD:${method}`,
        "BEGIN:VEVENT",
        `UID:${uidOf(meeting)}`,
        `DTSTAMP:${icsDate(new Date())}`,
        `DTSTART:${icsDate(meeting.startsAt)}`,
        `DTEND:${icsDate(endsAtOf(meeting))}`,
        `SEQUENCE:${Number(meeting.sequence) || 0}`,
        `SUMMARY:${icsText(meeting.title)}`,
        `DESCRIPTION:${icsText(description)}`,
        `LOCATION:${icsText(url)}`,
        `URL:${url}`,
        `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
        "TRANSP:OPAQUE",
    ];

    if (method !== "PUBLISH") {
        lines.push(`ORGANIZER;CN=${icsParam(meeting.hostName || "BlockHub")}:mailto:${organizerEmail()}`);
    }

    if (attendee?.email && method !== "PUBLISH") {
        lines.push(
            `ATTENDEE;CN=${icsParam(attendee.name || attendee.email)};ROLE=REQ-PARTICIPANT;` +
            `PARTSTAT=${cancelled ? "DECLINED" : "ACCEPTED"};RSVP=FALSE:mailto:${String(attendee.email).toLowerCase()}`
        );
    }

    if (!cancelled) {
        lines.push(
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${icsText(meeting.title)} starts in 15 minutes`,
            "TRIGGER:-PT15M",
            "END:VALARM"
        );
    }

    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.map(fold).join("\r\n") + "\r\n";
}

/** For nodemailer: adds the invite as a proper calendar part (Gmail shows the event card) */
function icalEventFor(meeting, options) {
    const method = options?.method || "REQUEST";
    return {
        method,
        filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
        content: buildIcs(meeting, options),
    };
}

/** "Add to calendar" links for buttons and the meeting page */
function calendarLinks(meeting) {
    const url = meetingUrl(meeting);
    const start = new Date(meeting.startsAt);
    const end = endsAtOf(meeting);
    const details = `${meeting.description ? `${String(meeting.description).trim()}\n\n` : ""}Join the call: ${url}`;

    const google =
        "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        `&text=${encodeURIComponent(meeting.title)}` +
        `&dates=${icsDate(start)}/${icsDate(end)}` +
        `&details=${encodeURIComponent(details)}` +
        `&location=${encodeURIComponent(url)}`;

    const outlook =
        "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
        `&subject=${encodeURIComponent(meeting.title)}` +
        `&startdt=${encodeURIComponent(start.toISOString())}` +
        `&enddt=${encodeURIComponent(end.toISOString())}` +
        `&body=${encodeURIComponent(details)}` +
        `&location=${encodeURIComponent(url)}`;

    const ics = `${getConfig().apiUrl}/meetings/public/${meeting.code}/calendar.ics`;

    return { google, outlook, ics };
}

module.exports = { buildIcs, icalEventFor, calendarLinks, meetingUrl, endsAtOf };
