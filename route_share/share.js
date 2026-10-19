/*
 * ==================================================================
 * Link previews  -  /share
 * ==================================================================
 * WhatsApp, X, Telegram, LinkedIn and Slack don't run our React app
 * when someone shares a link. The website (cPanel) asks this
 * endpoint what title / description / image a page should show,
 * and writes them into the page before sending it.
 *
 *   GET /share/meta?path=/grindfi/my-campaign
 *     -> { title, description, image }   (image may be null = use the
 *                                          section's picture)
 *
 * Only public information is returned (published products, live
 * campaigns, approved courses, non-cancelled meetings).
 * ==================================================================
 */

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Campaign = require("../models/Campaign");
const Product = require("../models/Product");
const Course = require("../models/Course");
const Meeting = require("../models/Meeting");

const MAX_DESC = 180;

function clean(text, max = MAX_DESC) {
    const plain = String(text || "")
        .replace(/<[^>]*>/g, " ") // strip any HTML
        .replace(/\s+/g, " ")
        .trim();
    return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function money(amount, currency) {
    const n = Number(amount) || 0;
    if (!n) return "Free";
    if (currency === "NGN") return `₦${n.toLocaleString("en-NG")}`;
    return `${n.toLocaleString("en-US")} ${currency || ""}`.trim();
}

function rewardText(reward = {}) {
    if (!reward.currency) return "";
    if (reward.type === "pool" && reward.totalPool) return `${Number(reward.totalPool).toLocaleString()} ${reward.currency} pool`;
    if (reward.amount) return `${Number(reward.amount).toLocaleString()} ${reward.currency}`;
    return "";
}

function httpsImage(url) {
    if (!url || typeof url !== "string") return null;
    if (!/^https?:\/\//i.test(url)) return null;
    return url.replace(/^http:\/\//i, "https://");
}

async function campaignMeta(slug) {
    const c = await Campaign.findOne({ slug: String(slug).toLowerCase(), status: { $ne: "draft" } })
        .select("title description banner reward endDate")
        .lean();
    if (!c) return null;
    const reward = rewardText(c.reward);
    return {
        title: `${c.title} – GrindFi | BlockHub`,
        description: clean(`${reward ? `Reward: ${reward}. ` : ""}${c.description}`),
        image: httpsImage(c.banner?.url),
    };
}

async function productMeta(slug) {
    const p = await Product.findOne({ slug: String(slug), status: "published", visibility: "public" })
        .select("title shortDescription description thumbnail previewImages pricing")
        .lean();
    if (!p) return null;
    const price = p.pricing?.type === "paid" ? money(p.pricing.amount, p.pricing.currency) : "Free";
    return {
        title: `${p.title} – BlockHub Marketplace`,
        description: clean(`${price}. ${p.shortDescription || p.description}`),
        image: httpsImage(p.thumbnail?.url || p.previewImages?.[0]?.url),
    };
}

async function courseMeta(rawId) {
    // Course links look like /t/<name>-<id> or /t/<id>
    const id = String(rawId).split("-").pop();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const course = await Course.findById(id).select("name overview thumbnail level pricing").lean();
    if (!course) return null;
    const price = course.pricing?.type === "paid" ? money(course.pricing.amount, course.pricing.currency) : "Free";
    return {
        title: `${course.name} – BlockHub Academy`,
        description: clean(`${course.level || "Course"} · ${price}. ${course.overview}`),
        image: httpsImage(course.thumbnail?.url),
    };
}

async function meetingMeta(code) {
    const m = await Meeting.findOne({ code: String(code).toLowerCase(), status: { $ne: "cancelled" } })
        .select("title description startsAt hostName")
        .lean();
    if (!m) return null;
    const when = new Date(m.startsAt).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: process.env.COHORT_TIMEZONE || "Africa/Lagos",
    });
    return {
        title: `${m.title} – BlockHub Meeting`,
        description: clean(`${when} (WAT) · Hosted by ${m.hostName || "BlockHub"}. ${m.description || "Book your spot and join the call."}`),
        image: null, // the meetings picture
    };
}

router.get("/meta", async (req, res) => {
    try {
        const path = String(req.query.path || "").split("?")[0];
        let data = null;
        let match;

        if ((match = path.match(/^\/grindfi\/([a-z0-9-]+)\/?$/i)) && !["register", "edit", "create", "project", "signup", "signinpp", "myproject"].includes(match[1].toLowerCase())) {
            data = await campaignMeta(match[1]);
        } else if ((match = path.match(/^\/market\/([^/]+)\/?$/i))) {
            data = await productMeta(decodeURIComponent(match[1]));
        } else if ((match = path.match(/^\/t\/([^/]+)\/?$/i))) {
            data = await courseMeta(decodeURIComponent(match[1]));
        } else if ((match = path.match(/^\/meet\/([a-z-]+)(?:\/room)?\/?$/i))) {
            data = await meetingMeta(match[1]);
        }

        res.set("Cache-Control", "public, max-age=300");
        return res.json({ success: true, data });
    } catch (error) {
        console.error("share meta error:", error?.message);
        return res.json({ success: true, data: null });
    }
});

module.exports = router;
