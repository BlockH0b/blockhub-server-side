/*
 * ============================================================
 * /contact  -  website "Contact us" form
 * ============================================================
 *   POST /contact  { name, email, topic?, message, page?, website? }
 *     -> emails the BlockHub inbox (Reply goes straight to the sender)
 *     -> sends the sender a short "we got your message" email
 *
 * .env
 *   CONTACT_TO=block.hub.mailer@gmail.com   (comma-separate for more)
 *
 * "website" is a hidden trap field: real people never fill it,
 * bots usually do. Rate limited in index.js.
 * ============================================================
 */
const express = require("express");
const { sendEmail } = require("../services/email");

const router = express.Router();

const TOPICS = ["General", "Cohort / classes", "Partnership", "Campaigns / GrindFi", "Academy", "Marketplace", "Support"];
const clean = (value, max) => String(value || "").trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

router.post("/", async (req, res) => {
    try {
        // Trap field: pretend it worked so bots don't retry
        if (req.body?.website) return res.json({ success: true, message: "Thanks! We'll be in touch." });

        const name = clean(req.body?.name, 80);
        const email = clean(req.body?.email, 160).toLowerCase();
        const topic = TOPICS.includes(req.body?.topic) ? req.body.topic : "General";
        const message = clean(req.body?.message, 4000);
        const page = clean(req.body?.page, 200);

        if (name.length < 2) return res.status(400).json({ success: false, message: "Please enter your name." });
        if (!isEmail(email)) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        if (message.length < 10) {
            return res.status(400).json({ success: false, message: "Your message is a bit short. Tell us a little more." });
        }

        const inbox = String(process.env.CONTACT_TO || "block.hub.mailer@gmail.com")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);

        const stamp = Date.now();
        const results = await Promise.all(
            inbox.map((to, i) =>
                sendEmail({
                    to,
                    template: "contact_message",
                    category: "essential",
                    data: { name, email, topic, message, page },
                    replyTo: `"${name.replace(/["<>]/g, "")}" <${email}>`,
                    dedupeKey: `contact:${email}:${stamp}:${i}`,
                    _skipTestLimit: true,
                })
            )
        );

        if (!results.some((r) => r.status === "sent" || r.status === "retry")) {
            console.error("[contact] not delivered", results);
            return res.status(502).json({
                success: false,
                message: "We couldn't send your message right now. Please email block.hub.mailer@gmail.com directly.",
            });
        }

        // Confirmation to the sender (don't fail the request if this one doesn't go)
        sendEmail({
            to: email,
            template: "contact_received",
            category: "essential",
            data: { name, message },
            dedupeKey: `contact-ack:${email}:${stamp}`,
        }).catch(() => null);

        return res.json({ success: true, message: "Message sent. We'll reply to your email soon." });
    } catch (error) {
        console.error("[contact]", error);
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
});

module.exports = router;
