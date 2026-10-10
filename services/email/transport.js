const nodemailer = require("nodemailer");
const { getConfig } = require("./config");

/*
 * One shared mail transport + the TEST MODE redirect.
 * Everything that sends email in BlockHub goes through deliver().
 */

let transporter = null;
let transporterKey = "";

function getTransporter() {
    const config = getConfig();
    const key = JSON.stringify(config.smtp || config.gmail.user || "");
    if (transporter && key === transporterKey) return transporter;

    transporter = config.smtp
        ? nodemailer.createTransport({ ...config.smtp, pool: true, maxConnections: 3 })
        : nodemailer.createTransport({
            service: "gmail",
            pool: true,
            maxConnections: 2,
            auth: { user: config.gmail.user, pass: config.gmail.pass },
        });

    transporterKey = key;
    return transporter;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Who should actually receive this email right now?
 * Returns { recipients: [...], testMode, reason? }
 */
function resolveRecipients(to) {
    const config = getConfig();
    const original = Array.isArray(to) ? to : [to];

    if (config.disabled) {
        return { recipients: [], testMode: config.testMode, reason: "EMAIL_DISABLED" };
    }

    if (config.testMode) {
        if (!config.testRecipients.length) {
            return { recipients: [], testMode: true, reason: "test mode on but EMAIL_TEST_RECIPIENTS is empty" };
        }
        return { recipients: config.testRecipients, testMode: true };
    }

    return { recipients: original.filter(Boolean), testMode: false };
}

/**
 * Low-level send. Applies test-mode redirect.
 * mail = { to, subject, html, text, headers, attachments, icalEvent, from }
 */
async function deliver(mail) {
    const config = getConfig();
    const { recipients, testMode, reason } = resolveRecipients(mail.to);

    if (!recipients.length) {
        console.log(`[email] not sent (${reason}) -> ${mail.to} | ${mail.subject}`);
        return { delivered: false, recipients: [], testMode, reason };
    }

    let subject = mail.subject;
    let html = mail.html;

    if (testMode) {
        const realTo = Array.isArray(mail.to) ? mail.to.join(", ") : mail.to;
        subject = `[TEST → ${realTo}] ${mail.subject}`;
        if (html) {
            html =
                `<div style="background:#fbbf24;color:#000;font:600 12px/1.4 Arial,sans-serif;padding:8px 12px;text-align:center">` +
                `TEST MODE — this email was meant for ${escapeHtml(realTo)}</div>` +
                html;
        }
    }

    const info = await getTransporter().sendMail({
        from: mail.from || config.from,
        replyTo: mail.replyTo || config.replyTo,
        to: recipients.join(", "),
        subject,
        html,
        text: mail.text,
        headers: mail.headers,
        attachments: mail.attachments,
        icalEvent: mail.icalEvent,
    });

    return { delivered: true, recipients, testMode, messageId: info?.messageId };
}

module.exports = { deliver, resolveRecipients, getTransporter };
