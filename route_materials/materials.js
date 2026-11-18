/*
 * Course materials (slides + notes) behind a password.
 *
 *   POST /materials/:track/:week/:type   body: { password }
 *     -> 200 { success, type, ...content }   right password
 *     -> 401                                 wrong password
 *
 * Content lives in Backend/materials/<track>/<week>/ (slides.json, notes.md).
 * It is NOT in the website build, so nobody can read it without the password.
 *
 * Slides and notes each have their own password, set as environment variables
 * (in .env and on Render):
 *   MATERIALS_PASSWORD_BACKEND_SLIDES=slides-password
 *   MATERIALS_PASSWORD_BACKEND_NOTES=notes-password
 *
 * To add a new week: drop its files in materials/backend-development/week-2/.
 * To add another track: add it to TRACKS below with its own env vars.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

const ROOT = path.join(__dirname, "..", "materials");

// track slug -> env var holding the password for each type
const TRACKS = {
    "backend-development": {
        slides: "MATERIALS_PASSWORD_BACKEND_SLIDES",
        notes: "MATERIALS_PASSWORD_BACKEND_NOTES",
    },
};

// type -> file name inside the week folder
const TYPES = {
    slides: "slides.json",
    notes: "notes.md",
};

const SAFE_SLUG = /^[a-z0-9-]{1,40}$/;

/* ---- Lock out password guessing: 10 wrong tries per IP per 15 minutes ---- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_WRONG = 10;
const wrongTries = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of wrongTries) if (entry.reset <= now) wrongTries.delete(ip);
}, 5 * 60 * 1000).unref();

function isLockedOut(ip) {
    const entry = wrongTries.get(ip);
    return entry && entry.reset > Date.now() && entry.count >= MAX_WRONG;
}

function recordWrong(ip) {
    const now = Date.now();
    let entry = wrongTries.get(ip);
    if (!entry || entry.reset <= now) {
        entry = { count: 0, reset: now + WINDOW_MS };
        wrongTries.set(ip, entry);
    }
    entry.count += 1;
}

/* Compare without leaking timing information */
function samePassword(given, expected) {
    const a = crypto.createHash("sha256").update(String(given || "")).digest();
    const b = crypto.createHash("sha256").update(String(expected)).digest();
    return crypto.timingSafeEqual(a, b);
}

router.post("/:track/:week/:type", (req, res) => {
    const { track, week, type } = req.params;

    if (!SAFE_SLUG.test(track) || !SAFE_SLUG.test(week) || !TYPES[type] || !TRACKS[track]) {
        return res.status(404).json({ success: false, message: "Material not found." });
    }

    const ip = req.ip;
    if (isLockedOut(ip)) {
        return res.status(429).json({
            success: false,
            message: "Too many wrong passwords. Please wait 15 minutes and try again.",
        });
    }

    const expected = process.env[TRACKS[track][type]];
    if (!expected) {
        return res.status(503).json({ success: false, message: "These materials are not open yet." });
    }

    const password = req.body && typeof req.body.password === "string" ? req.body.password.trim() : "";
    if (!samePassword(password, expected)) {
        recordWrong(ip);
        return res.status(401).json({ success: false, message: "Wrong password. Check with your tutor." });
    }

    const file = path.join(ROOT, track, week, TYPES[type]);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) {
        return res.status(404).json({ success: false, message: "This week has not been published yet." });
    }

    try {
        const raw = fs.readFileSync(file, "utf8");
        res.set("Cache-Control", "no-store");
        if (type === "slides") {
            return res.json({ success: true, type, ...JSON.parse(raw) });
        }
        return res.json({ success: true, type, content: raw });
    } catch (err) {
        console.error("materials read failed:", err.message);
        return res.status(500).json({ success: false, message: "Could not load this material." });
    }
});

module.exports = router;
