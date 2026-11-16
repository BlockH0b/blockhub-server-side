/*
 * Class link safety
 * ------------------------------------------------------------
 * Students click the class link straight from our emails, so a
 * wrong or fake link is a scam risk. Only real meeting sites are
 * accepted. Add more with MEET_LINK_HOSTS=meet.google.com,zoom.us
 */

const DEFAULT_HOSTS = [
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com",
    "teams.live.com",
    "youtube.com",
    "youtu.be",
    "calendar.app.google", // Google Calendar invite links
    "calendar.google.com",
];

function allowedHosts() {
    const extra = String(process.env.MEET_LINK_HOSTS || "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    return [...new Set([...DEFAULT_HOSTS, ...extra])];
}

/** Returns a clean https URL, or null when empty. Throws a friendly Error when not allowed. */
function cleanMeetLink(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    let url;
    try {
        url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
        throw new Error("That doesn't look like a link. Paste the full Google Meet link, e.g. https://meet.google.com/abc-defg-hij");
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const ok = allowedHosts().some((h) => host === h || host.endsWith(`.${h}`));
    if (!ok) {
        throw new Error("Only Google Meet links are allowed (e.g. https://meet.google.com/abc-defg-hij).");
    }

    url.protocol = "https:";
    return url.toString();
}

module.exports = { cleanMeetLink };
