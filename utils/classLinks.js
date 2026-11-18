/*
 * Extra class links (Part 2, Part 3).
 * Free Google Meet ends group calls after 60 minutes, so a tutor can
 * add a new link for the rest of the class. Max 3 links per class.
 */
const { cleanMeetLink } = require("./meetLink");
const notify = require("../services/email/notify");

const MAX_LINKS = 3;

function linksOf(classItem) {
    const main = classItem.meetingStatus === "available" && classItem.meetingLink ? [classItem.meetingLink] : [];
    return [...main, ...(classItem.extraLinks || []).map((l) => l.url)];
}

function formatExtraLinks(classItem) {
    return (classItem.extraLinks || []).map((l, i) => ({
        url: l.url,
        label: l.label || `Part ${i + 2}`,
        addedAt: l.addedAt || null,
    }));
}

/** Adds a link to a class doc (mongoose doc) and saves. Throws friendly errors. */
async function addClassLink(classItem, { link, label, notifyStudents = true }) {
    const url = cleanMeetLink(link);
    if (!url) throw new Error("Paste the meeting link first.");
    if (classItem.status === "cancelled") throw new Error("This class is cancelled.");

    const existing = linksOf(classItem);
    if (existing.includes(url)) throw new Error("That link is already on this class.");
    if (existing.length >= MAX_LINKS) throw new Error(`A class can have up to ${MAX_LINKS} links.`);

    // No main link yet -> this becomes the main link
    if (!existing.length) {
        classItem.meetingLink = url;
        classItem.meetingStatus = "available";
        classItem.meetSource = "manual";
        await classItem.save();
        if (notifyStudents) notify.classLinkReady(classItem, { changed: false });
        return { url, label: "Part 1", main: true };
    }

    const partLabel = String(label || "").trim().slice(0, 40) || `Part ${existing.length + 1}`;
    classItem.extraLinks = [...(classItem.extraLinks || []), { url, label: partLabel, addedAt: new Date() }];
    await classItem.save();
    if (notifyStudents) notify.classExtraLink(classItem, { url, label: partLabel });
    return { url, label: partLabel, main: false };
}

async function removeClassLink(classItem, index) {
    const i = Number(index);
    const list = classItem.extraLinks || [];
    if (!Number.isInteger(i) || i < 0 || i >= list.length) throw new Error("Link not found.");
    classItem.extraLinks = list.filter((_, j) => j !== i);
    await classItem.save();
}

module.exports = { addClassLink, removeClassLink, formatExtraLinks, MAX_LINKS };
