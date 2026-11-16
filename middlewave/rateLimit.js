/*
 * Tiny in-memory rate limiter (no extra package needed).
 * Stops people guessing passwords / OTP codes or spamming sign-ups.
 * Counts per IP address. Resets when the server restarts, which is fine.
 *
 *   app.use("/admin_auth/login", rateLimit({ max: 10, windowMinutes: 15 }));
 */

function rateLimit({ max = 10, windowMinutes = 15, message } = {}) {
    const hits = new Map();
    const windowMs = windowMinutes * 60 * 1000;

    // clean old entries every few minutes
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
    }, 5 * 60 * 1000).unref();

    return (req, res, next) => {
        if (req.method === "OPTIONS" || req.method === "GET") return next();
        const key = `${req.ip}|${req.baseUrl || req.path}`;
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.reset <= now) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            const wait = Math.ceil((entry.reset - now) / 60000);
            res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
            return res.status(429).json({
                success: false,
                message: message || `Too many attempts. Please wait ${wait} minute${wait === 1 ? "" : "s"} and try again.`,
            });
        }
        next();
    };
}

module.exports = rateLimit;
