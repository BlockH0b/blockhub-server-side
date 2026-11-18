/*
 * Class numbers per track: the first class of the cohort is Class 1,
 * then 2, 3... in date order. Re-run any time (it's cheap and safe).
 * Classes before the cohort start (old test classes) get no number.
 *
 * Titles made by the timetable ("Week 2 · Class 5") are rewritten to
 * match; titles a tutor typed themselves are left alone.
 */
const CohortClass = require("../models/CohortClass");

const DAY = 86400000;
const AUTO_TITLE = /^\s*(week\s*\d+\s*[·•\-|]\s*)?class\s*\d+\s*$/i;

function classesStart() {
    const raw = process.env.COHORT_CLASSES_START || "2026-11-17";
    const d = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? new Date("2026-11-17T00:00:00.000Z") : d;
}

function minutes(hhmm) {
    const [h, m] = String(hhmm || "0:0").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

async function renumberClasses({ cohort = "cohort-1.0", tracks = null } = {}) {
    const start = classesStart();
    const filter = { cohort };
    if (tracks?.length) filter.track = { $in: tracks };

    const all = await CohortClass.find(filter).select("_id track title startDate startTime classNumber status").lean();
    const byTrack = new Map();
    for (const c of all) {
        const list = byTrack.get(c.track) || [];
        list.push(c);
        byTrack.set(c.track, list);
    }

    const ops = [];
    for (const list of byTrack.values()) {
        list.sort(
            (a, b) =>
                new Date(a.startDate) - new Date(b.startDate) || minutes(a.startTime) - minutes(b.startTime)
        );
        let n = 0;
        for (const c of list) {
            const day = new Date(c.startDate);
            const counted = day >= start && c.status !== "cancelled";
            const classNumber = counted ? ++n : null;
            const set = {};
            if ((c.classNumber || null) !== classNumber) set.classNumber = classNumber;
            if (counted && (!c.title || AUTO_TITLE.test(c.title))) {
                const week = Math.floor((day - start) / (7 * DAY)) + 1;
                const title = `Week ${week} · Class ${classNumber}`;
                if (title !== c.title) set.title = title;
            }
            if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: c._id }, update: { $set: set } } });
        }
    }
    if (ops.length) await CohortClass.bulkWrite(ops, { ordered: false });
    return { changed: ops.length, tracks: byTrack.size };
}

/** Fire-and-forget version for routes */
function renumberSoon(cohort, track) {
    setTimeout(() => {
        renumberClasses({ cohort, tracks: track ? [track] : null }).catch((e) =>
            console.error("[classNumbers]", e?.message)
        );
    }, 300);
}

module.exports = { renumberClasses, renumberSoon, classesStart };
