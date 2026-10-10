/*
 * Private data files for scripts live in scripts/data/ (git-ignored).
 * Personal emails / customer lists must NEVER be written in code
 * or pushed to GitHub. See scripts/data.example/ for the format.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");

function loadJson(name, fallback = []) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) {
        console.warn(`⚠ scripts/data/${name} not found - using empty list`);
        return fallback;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveJson(name, value) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, name);
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    return file;
}

/** List of emails from a JSON file of strings or {email} objects */
function loadEmailList(name) {
    return loadJson(name, [])
        .map((item) => (typeof item === "string" ? item : item?.email))
        .filter(Boolean)
        .map((email) => email.trim().toLowerCase());
}

module.exports = { loadJson, saveJson, loadEmailList, DATA_DIR };
