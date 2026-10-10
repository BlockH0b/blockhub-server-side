/*
 * Single list of frontends allowed to call this API (HTTP + Socket.io).
 * Add extra origins without touching code via:
 *   EXTRA_CORS_ORIGINS=https://foo.com,https://bar.com
 */
const baseOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://admin.blockhubglobal.xyz',
    'https://app.blockhubglobal.xyz',
    'https://dashboard.blockhubglobal.xyz',
    'https://blockhubglobal.xyz',
    'https://www.blockhubglobal.xyz',
    'https://hk-launch-timecount.netlify.app',
    'http://172.20.10.4:5173',
];

const extraOrigins = (process.env.EXTRA_CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = [...new Set([...baseOrigins, ...extraOrigins])];

module.exports = { allowedOrigins };
