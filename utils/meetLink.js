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
    "meet.app.goo.gl",
];

/** Google links that live on a shared domain: only these paths are allowed */
function isGoogleInvite(host, pathname) {
    if (host === "google.com" && pathname.startsWith("/calendar")) return true; // google.com/calendar/event?eid=...
    if (host === "g.co" && pathname.startsWith("/meet")) return true; // g.co/meet/abc-defg-hij
    return false;
}

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
        throw new Error("That doesn't look like a link. Paste the full Google Meet or Google Calendar invite link.");
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const ok =
        allowedHosts().some((h) => host === h || host.endsWith(`.${h}`)) ||
        isGoogleInvite(host, url.pathname);
    if (!ok) {
        throw new Error(
            "Only meeting links are allowed: a Google Meet link (meet.google.com/...), a Google Calendar invite link (calendar.app.google/...), Zoom or Teams."
        );
    }

    url.protocol = "https:";
    return url.toString();
}

module.exports = { cleanMeetLink };
