/*
 * ============================================================
 * Shield - first line of defence for every request
 * ============================================================
 *  1. Security headers (like helmet, no extra package)
 *  2. Global rate limit per IP (stops floods / brute force)
 *  3. Blocks known attack tricks:
 *       - reading server files / internal addresses (file://, /etc/passwd,
 *         169.254.169.254 cloud secrets, localhost ports...)
 *       - MongoDB injection ({"email": {"$ne": null}} to bypass logins)
 *  4. An IP that tries 3 attacks is banned for 24 hours
 *
 * Bans are kept in memory (they reset on deploy). Settings:
 *   SHIELD_RATE_PER_5MIN=400   SHIELD_BAN_HOURS=24   SHIELD_ALLOW_IPS=1.2.3.4
 * ============================================================
 */

const RATE_PER_5MIN = Number(process.env.SHIELD_RATE_PER_5MIN) || 400;
const BAN_HOURS = Number(process.env.SHIELD_BAN_HOURS) || 24;
const ALLOW = new Set(
    String(process.env.SHIELD_ALLOW_IPS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
);

const hits = new Map(); // ip -> { count, reset }
const strikes = new Map(); // ip -> { count, reset }
const banned = new Map(); // ip -> until (ms)

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    for (const [k, v] of strikes) if (v.reset <= now) strikes.delete(k);
    for (const [k, until] of banned) if (until <= now) banned.delete(k);
}, 5 * 60 * 1000).unref();

// Things no real user ever sends to BlockHub
const ATTACK_PATTERNS = [
    /file:\/\//i,
    /\/etc\/(passwd|shadow|hosts)/i,
    /169\.254\.169\.254/,
    /metadata\.google\.internal/i,
    /\b(gopher|dict|ldap|tftp):\/\//i,
    /\/proc\/self\//i,
];

// Internal addresses: an attack when sent as a "picture/link to fetch",
// but students legitimately write "http://localhost:3000" in answers.
const INTERNAL_ADDRESS = [
    /https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1?\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(?=[:/]|$)/i,
    /\.\.\/\.\.\/\.\.\//, // ../../../ path climbing
];

// Where people type free text and code (assignments, questions,
// announcements, emails). We still block Mongo injection here, but
// don't scan the text itself - the server never opens those links.
const FREE_TEXT_ROUTES = /^\/(cohort_student|tutor_work|tutor_cohort|admin_cohort|email|live_class|user_activity|user_profile)\b/i;

// Paths scanners try on every site (we don't have them)
const SCANNER_PATHS = /^\/(wp-admin|wp-login\.php|xmlrpc\.php|\.env|\.git\/|phpmyadmin|vendor\/phpunit|cgi-bin\/|boaform|actuator\/|server-status)/i;

function ipOf(req) {
    return req.ip || req.socket?.remoteAddress || "unknown";
}

function hasMongoOperator(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8) return false;
    for (const key of Object.keys(value)) {
        if (key.startsWith("$")) return true;
        if (hasMongoOperator(value[key], depth + 1)) return true;
    }
    return false;
}

function textOf(req) {
    let body = "";
    try {
        body = req.body && typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || "");
    } catch {
        body = "";
    }
    return `${decodeSafe(req.originalUrl || "")} ${body.slice(0, 50000)}`;
}

function decodeSafe(s) {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
}

function strike(req, reason) {
    const ip = ipOf(req);
    const now = Date.now();
    let s = strikes.get(ip);
    if (!s || s.reset <= now) s = { count: 0, reset: now + 60 * 60 * 1000 };
    s.count += 1;
    strikes.set(ip, s);
    console.warn(`[shield] ${reason} from ${ip} -> ${req.method} ${String(req.originalUrl).slice(0, 120)} (strike ${s.count})`);
    if (s.count >= 3) {
        banned.set(ip, now + BAN_HOURS * 3600 * 1000);
        console.warn(`[shield] BANNED ${ip} for ${BAN_HOURS}h`);
    }
}

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.removeHeader("X-Powered-By");
    next();
}

/** Runs BEFORE body parsing: bans, scanner paths, rate limit */
function shieldEarly(req, res, next) {
    const ip = ipOf(req);
    if (ALLOW.has(ip)) return next();
    const now = Date.now();

    const until = banned.get(ip);
    if (until && until > now) {
        return res.status(403).json({ success: false, message: "Access blocked." });
    }

    if (SCANNER_PATHS.test(req.path)) {
        strike(req, "scanner path");
        return res.status(404).end();
    }

    if (req.method !== "OPTIONS") {
        let h = hits.get(ip);
        if (!h || h.reset <= now) h = { count: 0, reset: now + 5 * 60 * 1000 };
        h.count += 1;
        hits.set(ip, h);
        if (h.count > RATE_PER_5MIN) {
            if (h.count === RATE_PER_5MIN + 1) console.warn(`[shield] rate limit hit by ${ip}`);
            res.setHeader("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
            return res.status(429).json({ success: false, message: "Too many requests. Please slow down and try again shortly." });
        }
    }
    next();
}

/** Runs AFTER body parsing: looks inside the request for attack tricks */
function shieldInspect(req, res, next) {
    if (ALLOW.has(ipOf(req)) || req.method === "OPTIONS") return next();

    if (hasMongoOperator(req.body) || hasMongoOperator(req.query)) {
        strike(req, "MongoDB injection");
        return res.status(400).json({ success: false, message: "Invalid request." });
    }

    if (FREE_TEXT_ROUTES.test(req.path)) {
        // only the address bar is checked on these routes
        const url = decodeSafe(req.originalUrl || "");
        if (ATTACK_PATTERNS.some((re) => re.test(url))) {
            strike(req, "attack pattern");
            return res.status(400).json({ success: false, message: "Invalid request." });
        }
        return next();
    }

    const text = textOf(req);
    if (ATTACK_PATTERNS.some((re) => re.test(text)) || INTERNAL_ADDRESS.some((re) => re.test(text))) {
        strike(req, "attack pattern");
        return res.status(400).json({ success: false, message: "Invalid request." });
    }
    next();
}

/** For an admin page / debugging */
function shieldStats() {
    const now = Date.now();
    return {
        banned: [...banned.entries()].filter(([, u]) => u > now).map(([ip, u]) => ({ ip, until: new Date(u) })),
        watching: [...strikes.entries()].map(([ip, s]) => ({ ip, strikes: s.count })),
    };
}

module.exports = { securityHeaders, shieldEarly, shieldInspect, shieldStats };
