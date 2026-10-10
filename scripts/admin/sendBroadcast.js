/*
 * ============================================================
 * Send a one-off email to many people (e.g. "Cohort registration
 * is open"). Replaces the old functions/emailSend.js, which had
 * the Gmail password written in the code.
 * ============================================================
 *
 *   node scripts/admin/sendBroadcast.js \
 *        --html scripts/broadcasts/cohort-registration.html \
 *        --subject "🚀 BlockHub Cohort 1.0 Registration Is Now Active!" \
 *        --name cohort-registration
 *        -> PREVIEW: shows how many people would get it
 *
 *   ...add --send to actually send.
 *
 * - Uses the same email settings as the server (.env), including
 *   EMAIL_TEST_MODE: in test mode everything goes to
 *   EMAIL_TEST_RECIPIENTS only.
 * - Never emails the same person twice for the same --name
 *   (safe to re-run after a crash).
 * - {{name}} in the HTML is replaced with each person's name.
 * - Recipients: see admin/allEmailUsers.js. Use --only extra to
 *   send only to scripts/data/extra_emails.json.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { run } = require("../_lib/db");
const { loadEmailList } = require("../_lib/data");
const getAllEmailUsers = require("./allEmailUsers");
const { deliver } = require("../../services/email/transport");
const { getConfig } = require("../../services/email/config");
const EmailLog = require("../../models/EmailLog");

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}

const htmlFile = arg("html");
const subject = arg("subject");
const name = arg("name") || (htmlFile ? path.basename(htmlFile, ".html") : "");
const only = arg("only");
const SEND = process.argv.includes("--send");
const DELAY_MS = Number(arg("delay")) || 1500;

if (!htmlFile || !subject) {
    console.log('Usage: node scripts/admin/sendBroadcast.js --html <file.html> --subject "..." [--name key] [--only extra] [--send]');
    process.exit(1);
}

const html = fs.readFileSync(path.resolve(process.cwd(), htmlFile), "utf8");

run(async () => {
    const config = getConfig();

    const recipients =
        only === "extra"
            ? loadEmailList("extra_emails.json").map((email) => ({ email, name: "BlockHub User" }))
            : await getAllEmailUsers();

    // Skip people who already got this broadcast for real (test sends don't count)
    const already = new Set(
        (await EmailLog.find({ template: `broadcast:${name}`, status: "sent", testMode: { $ne: true } }).select("to").lean()).map((l) => l.to)
    );
    const todo = recipients.filter((r) => !already.has(r.email));

    console.log("==========================================");
    console.log(`Broadcast  : ${name}`);
    console.log(`Subject    : ${subject}`);
    console.log(`Recipients : ${recipients.length} (${already.size} already sent, ${todo.length} to go)`);
    console.log(`Mode       : ${config.testMode ? `TEST -> ${config.testRecipients.join(", ") || "(no test recipients!)"}` : "LIVE - real people"}`);
    console.log("==========================================");

    if (!SEND) {
        console.log("\nPreview only. Add --send to send.");
        return;
    }

    // In test mode, only send a handful
    const list = config.testMode ? todo.slice(0, config.testMaxPerBatch) : todo;
    let sent = 0;
    let failed = 0;

    for (const person of list) {
        try {
            const result = await deliver({
                to: person.email,
                subject,
                html: html.replace(/\{\{name\}\}/g, person.name || "BlockHubber"),
            });

            await EmailLog.create({
                template: `broadcast:${name}`,
                category: "marketing",
                to: person.email,
                subject,
                status: result.delivered ? "sent" : "skipped",
                skipReason: result.delivered ? null : result.reason,
                deliveredTo: result.recipients,
                testMode: config.testMode,
                sentAt: result.delivered ? new Date() : null,
            });

            if (result.delivered) sent += 1;
            console.log(`${result.delivered ? "✅" : "⏭ "} ${person.email}`);
        } catch (error) {
            failed += 1;
            console.error(`❌ ${person.email}: ${error.message}`);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    console.log("==========================================");
    console.log(`✅ Sent: ${sent}   ❌ Failed: ${failed}`);
    console.log("==========================================");
});
