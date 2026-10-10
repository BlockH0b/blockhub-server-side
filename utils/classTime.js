/*
 * Class time helpers
 * ------------------------------------------------------------
 * CohortClass stores `startDate` as a DATE (midnight UTC) and the
 * time separately as "HH:mm" strings (startTime / endTime) entered
 * by the tutor in their local time.
 *
 * Comparing `startDate` with "now" therefore treated a 6pm class as
 * starting at 00:00, which made it vanish from "upcoming" early and
 * made countdowns point at midnight.
 *
 * These helpers combine the date + time into a real moment, using
 * the cohort timezone offset (default Lagos, +01:00).
 *   COHORT_UTC_OFFSET=+01:00
 */

const DEFAULT_OFFSET = process.env.COHORT_UTC_OFFSET || "+01:00";

function pad(value) {
    return String(value).padStart(2, "0");
}

function normaliseTime(time) {
    if (!time || typeof time !== "string") return null;
    const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${pad(hours)}:${pad(minutes)}`;
}

function combineDateAndTime(date, time, offset = DEFAULT_OFFSET) {
    if (!date) return null;
    const base = new Date(date);
    if (Number.isNaN(base.getTime())) return null;

    const hhmm = normaliseTime(time);
    if (!hhmm) return base;

    const ymd = `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
    const combined = new Date(`${ymd}T${hhmm}:00${offset}`);
    return Number.isNaN(combined.getTime()) ? base : combined;
}

/** Real start moment of a class. */
function getClassStartsAt(classItem) {
    return combineDateAndTime(classItem?.startDate, classItem?.startTime);
}

/** Real end moment of a class (endTime, else start + duration, else +1h). */
function getClassEndsAt(classItem) {
    const start = getClassStartsAt(classItem);
    if (!start) return null;

    let end = combineDateAndTime(classItem?.startDate, classItem?.endTime);
    if (end && end > start) return end;

    const minutes = Number(classItem?.durationMinutes) || 60;
    end = new Date(start.getTime() + minutes * 60 * 1000);
    return end;
}

module.exports = {
    combineDateAndTime,
    getClassStartsAt,
    getClassEndsAt,
};
