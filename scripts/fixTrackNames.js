/*
 * ============================================================
 * Fix cohort track names everywhere - without losing anything
 * ============================================================
 *
 *   node scripts/fixTrackNames.js           -> PREVIEW only (changes nothing)
 *   node scripts/fixTrackNames.js --apply   -> make the changes
 *
 * What it does
 *   - Reads every "track" value in: registrations, tutors, classes,
 *     live classes and announcements.
 *   - Maps old/misspelled names to the official ones in
 *     config/cohortTracks.js (e.g. "Backend Developmentt" -> "Backend Development").
 *   - With --apply: first saves a backup JSON of every document it
 *     will touch (scripts/backups/tracks-<date>.json), then ONLY
 *     updates the "track" field. Students, tutors, classes, emails,
 *     referrals, payments... are all untouched.
 *   - Names it doesn't recognise are listed and left alone.
 *
 * Needs MONGODB_URI in .env (same as the server).
 * ============================================================
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// ===============================
// DNS Configuration (optional)
// ===============================
const dnsPromises = require("node:dns/promises");
const dns = require("dns");
dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");


const { COHORT_TRACKS, normalizeTrack } = require("../config/cohortTracks");

const APPLY = process.argv.includes("--apply");

const COLLECTIONS = [
    { name: "cohortregistrations", label: "Student registrations" },
    { name: "cohorttutors", label: "Tutors" },
    { name: "cohortclasses", label: "Classes" },
    { name: "livesessions", label: "Live classes" },
    { name: "cohortannouncements", label: "Announcements" },
];

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI is missing from .env");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log(`\n${APPLY ? "APPLYING" : "PREVIEW (nothing will change)"} - official tracks:`);
    COHORT_TRACKS.forEach((t) => console.log(`   • ${t}`));
    console.log("");

    const backup = {};
    const unknown = new Map();
    let totalToChange = 0;

    for (const { name, label } of COLLECTIONS) {
        const exists = await db.listCollections({ name }).hasNext();
        if (!exists) continue;

        const col = db.collection(name);
        const values = await col.distinct("track");

        const plan = [];
        for (const value of values) {
            if (!value) continue;
            const correct = normalizeTrack(value);
            if (!correct) {
                unknown.set(`${label}: "${value}"`, await col.countDocuments({ track: value }));
                continue;
            }
            if (correct !== value) {
                plan.push({ from: value, to: correct, count: await col.countDocuments({ track: value }) });
            }
        }

        if (!plan.length) {
            console.log(`✓ ${label}: all track names already correct`);
            continue;
        }

        console.log(`→ ${label}:`);
        plan.forEach((p) => console.log(`     "${p.from}"  →  "${p.to}"   (${p.count} document${p.count === 1 ? "" : "s"})`));
        totalToChange += plan.reduce((sum, p) => sum + p.count, 0);

        if (APPLY) {
            backup[name] = await col
                .find({ track: { $in: plan.map((p) => p.from) } }, { projection: { _id: 1, track: 1 } })
                .toArray();
        }
    }

    if (unknown.size) {
        console.log("\n⚠ Track names not recognised (left unchanged - add them to TRACK_ALIASES if they're typos):");
        for (const [key, count] of unknown) console.log(`     ${key}  (${count})`);
    }

    if (!APPLY) {
        console.log(`\n${totalToChange} document(s) would be updated. Run again with --apply to save.\n`);
        await mongoose.disconnect();
        return;
    }

    if (!totalToChange) {
        console.log("\nNothing to change.\n");
        await mongoose.disconnect();
        return;
    }

    // Backup first
    const backupDir = path.join(__dirname, "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `tracks-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n💾 Backup saved: ${backupFile}`);

    // Apply - only the "track" field changes
    for (const { name, label } of COLLECTIONS) {
        const docs = backup[name];
        if (!docs?.length) continue;
        const col = db.collection(name);
        const values = [...new Set(docs.map((d) => d.track))];
        for (const from of values) {
            const to = normalizeTrack(from);
            const result = await col.updateMany({ track: from }, { $set: { track: to } });
            console.log(`✓ ${label}: "${from}" → "${to}"  (${result.modifiedCount} updated)`);
        }
    }

    console.log("\nDone. Students, tutors and classes keep all their data - only the track name changed.\n");
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
