/*
 * ============================================================
 * Cohort tracks - ONE place for the official names
 * ============================================================
 * The frontend has the same list in src/data/cohortTracks.ts.
 * If you rename a track:
 *   1. change it here AND in the frontend file
 *   2. add the old name to TRACK_ALIASES
 *   3. run:  node scripts/fixTrackNames.js          (preview)
 *            node scripts/fixTrackNames.js --apply  (save)
 * ============================================================
 */

const COHORT_TRACKS = [
    "Vibecoding & Front-end Development",
    "Backend Development",
    "DevOps Engineering",
    "Data Analytics",
    "Project Management",
    "2D Design & Animation",
    "AI Video & Content Creation",
    "Crypto Trading (Degen)",
    "Full Stack Web Development",
];

// Old / misspelled name  ->  correct name
const TRACK_ALIASES = {
    "Backend Developmentt": "Backend Development",
    "Crypto Trading ( Degan )": "Crypto Trading (Degen)",
    "Crypto Trading (Degan)": "Crypto Trading (Degen)",
    "Crypto Trading ( Degen )": "Crypto Trading (Degen)",
    "3D Design & Animation": "2D Design & Animation",
};

// Compare names ignoring case, spaces and punctuation
const squash = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const lookup = new Map();
COHORT_TRACKS.forEach((track) => lookup.set(squash(track), track));
Object.entries(TRACK_ALIASES).forEach(([from, to]) => lookup.set(squash(from), to));

/** Returns the official track name, or null if it isn't a known track */
function normalizeTrack(value) {
    if (!value) return null;
    return lookup.get(squash(value)) || null;
}

module.exports = { COHORT_TRACKS, TRACK_ALIASES, normalizeTrack };
