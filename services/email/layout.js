const { getConfig } = require("./config");

/*
 * ============================================================
 * BlockHub email layout + building blocks
 * Clean white look (black text, BlockHub green accents), email-client safe
 * (tables + inline styles, no external CSS).
 * ============================================================
 */

const C = {
    page: "#f4f4f1",      // outside the card
    card: "#ffffff",
    border: "#e9e9e6",
    line: "#efefec",
    ink: "#0a0a0a",       // headings, strong text, buttons
    text: "#3b3b3b",      // body copy
    muted: "#7a7a76",
    faint: "#a3a3a0",
    green: "#48FF75",     // BlockHub green - accents only (bar, dot, borders)
    greenText: "#0b8f3a", // readable green for small text on white
    amber: "#f59e0b",
};

// Kept for templates that pass colours by name
C.bg = C.page;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Plus Jakarta Sans',Roboto,Helvetica,Arial,sans-serif";

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Plain text -> safe HTML paragraphs (keeps line breaks) */
function textToHtml(text) {
    return esc(text)
        .split(/\n{2,}/)
        .map((para) => para.replace(/\n/g, "<br/>"))
        .join("<br/><br/>");
}

/* ------------------------------------------------------------
   Building blocks (white, minimal)
------------------------------------------------------------ */

const h1 = (text) =>
    `<h1 style="margin:0 0 16px;font:700 26px/1.25 ${FONT};color:${C.ink};letter-spacing:-0.4px">${esc(text)}</h1>`;

const p = (html) =>
    `<p style="margin:0 0 16px;font:400 15px/1.7 ${FONT};color:${C.text}">${html}</p>`;

const small = (html) =>
    `<p style="margin:0 0 10px;font:400 13px/1.6 ${FONT};color:${C.muted}">${html}</p>`;

/** Small green label above the title, e.g. "COHORT · REMINDER" */
const eyebrow = (text) =>
    `<p style="margin:0 0 12px;font:700 11px/1 ${FONT};color:${C.greenText};letter-spacing:1.6px;text-transform:uppercase">${esc(text)}</p>`;

/** Solid black button */
function button(label, url) {
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 10px">
  <tr><td style="border-radius:10px;background:${C.ink}">
    <a href="${esc(url)}" target="_blank"
       style="display:inline-block;padding:14px 24px;font:600 14px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">
       ${esc(label)} &nbsp;&rarr;
    </a>
  </td></tr>
</table>`;
}

/** Key / value rows with thin dividers, e.g. [["Date","Mon 27 Oct"],["Time","6:00 PM"]] */
function details(rows) {
    const visible = rows.filter(([, value]) => value !== undefined && value !== null && value !== "");
    const body = visible
        .map(
            ([label, value], i) => `
  <tr>
    <td style="padding:11px 0;font:400 13px/1.4 ${FONT};color:${C.muted};width:38%;${i < visible.length - 1 ? `border-bottom:1px solid ${C.line};` : ""}">${esc(label)}</td>
    <td style="padding:11px 0;font:600 14px/1.4 ${FONT};color:${C.ink};${i < visible.length - 1 ? `border-bottom:1px solid ${C.line};` : ""}">${esc(value)}</td>
  </tr>`
        )
        .join("");

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
       style="margin:20px 0;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border}">
  ${body}
</table>`;
}

/** Message with a thin coloured line on the left (announcements, notes) */
function quote(html, accent = C.green) {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0">
  <tr><td style="border-left:3px solid ${accent};padding:4px 0 4px 16px;font:400 15px/1.7 ${FONT};color:${C.text}">
    ${html}
  </td></tr>
</table>`;
}

/** Simple list: [{title, subtitle}] */
function itemList(items) {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 18px">
  ${items
        .map(
            (item, i) => `
  <tr><td style="padding:12px 0;${i < items.length - 1 ? `border-bottom:1px solid ${C.line};` : ""}">
    <div style="font:600 14px/1.4 ${FONT};color:${C.ink}">${esc(item.title)}</div>
    ${item.subtitle ? `<div style="margin-top:3px;font:400 13px/1.5 ${FONT};color:${C.muted}">${esc(item.subtitle)}</div>` : ""}
  </td></tr>`
        )
        .join("")}
</table>`;
}

/** Row of small outline links, e.g. calendar buttons: [["Google Calendar", url], ...] */
function linkRow(links) {
    const cells = links
        .filter(([, url]) => url)
        .map(
            ([label, url]) => `
    <td style="padding:0 8px 8px 0">
      <a href="${esc(url)}" target="_blank"
         style="display:inline-block;padding:9px 14px;border:1px solid ${C.border};border-radius:999px;background:#ffffff;font:600 12px/1 ${FONT};color:${C.ink};text-decoration:none">
         ${esc(label)}
      </a>
    </td>`
        )
        .join("");
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 12px">
  <tr>${cells}</tr>
</table>`;
}

/** Big code box (OTPs, codes) */
function codeBox(code) {
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0">
  <tr><td style="padding:16px 22px;border:1px solid ${C.border};border-radius:12px;background:#fafaf8;font:700 30px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:8px;color:${C.ink}">
    ${esc(code)}
  </td></tr>
</table>`;
}

/* ------------------------------------------------------------
   Shell: white card, thin green bar on top, "BlockHub." wordmark
------------------------------------------------------------ */

/**
 * opts: { preheader, footerNote, preferencesUrl, unsubscribeUrl, banner }
 *   banner: optional image URL shown full-width at the top of the card
 */
function layout(content, opts = {}) {
    const config = getConfig();
    const year = new Date().getFullYear();

    const links = [
        opts.unsubscribeUrl ? `<a href="${esc(opts.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline">Unsubscribe</a>` : "",
        opts.preferencesUrl ? `<a href="${esc(opts.preferencesUrl)}" style="color:${C.muted};text-decoration:underline">Email preferences</a>` : "",
        `<a href="${esc(config.frontendUrl)}" style="color:${C.muted};text-decoration:underline">blockhubglobal.xyz</a>`,
    ]
        .filter(Boolean)
        .join(" &nbsp;·&nbsp; ");

    const banner = opts.banner
        ? `<tr><td style="padding:0;line-height:0;font-size:0"><img src="${esc(opts.banner)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"/></td></tr>`
        : "";

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>BlockHub</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${esc(opts.preheader || "")}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.page}">
  <tr><td align="center" style="padding:36px 14px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
           style="max-width:560px;background:${C.card};border:1px solid ${C.border};border-radius:16px;border-collapse:separate;overflow:hidden">

      <tr><td style="height:4px;line-height:4px;font-size:0;background:${C.green}">&nbsp;</td></tr>
      ${banner}

      <tr><td style="padding:28px 32px 0">
        <span style="font:800 17px/1 ${FONT};color:${C.ink};letter-spacing:-0.3px">BlockHub<span style="color:${C.green}">.</span></span>
      </td></tr>

      <tr><td style="padding:26px 32px 30px">
        ${content}
      </td></tr>

      <tr><td style="padding:18px 32px 22px;border-top:1px solid ${C.line};font:400 12px/1.7 ${FONT};color:${C.faint}">
        ${opts.footerNote ? `${esc(opts.footerNote)}<br/>` : ""}
        ${links}
        <br/>© ${year} BlockHub · Learn, build and grow in Web3.
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { layout, h1, p, small, eyebrow, button, details, quote, itemList, linkRow, codeBox, esc, textToHtml, C, FONT };
