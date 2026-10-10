const { getConfig } = require("./config");

/*
 * ============================================================
 * BlockHub email layout + building blocks
 * Dark brand look (black / BlockHub green), email-client safe
 * (tables + inline styles, no external CSS).
 * ============================================================
 */

const C = {
    bg: "#030303",
    card: "#0b0b0b",
    border: "#1f1f1f",
    text: "#e8e8e8",
    muted: "#9a9a9a",
    faint: "#6b6b6b",
    green: "#48FF75",
    purple: "#3401CC",
};

const FONT = "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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
        .map((p) => p.replace(/\n/g, "<br/>"))
        .join("<br/><br/>");
}

const h1 = (text) =>
    `<h1 style="margin:0 0 14px;font:700 24px/1.3 ${FONT};color:#ffffff;letter-spacing:-0.3px">${esc(text)}</h1>`;

const p = (html) =>
    `<p style="margin:0 0 14px;font:400 15px/1.65 ${FONT};color:${C.text}">${html}</p>`;

const small = (html) =>
    `<p style="margin:0 0 10px;font:400 13px/1.6 ${FONT};color:${C.muted}">${html}</p>`;

const eyebrow = (text) =>
    `<p style="margin:0 0 10px;font:700 11px/1 ${FONT};color:${C.green};letter-spacing:2px;text-transform:uppercase">${esc(text)}</p>`;

function button(label, url) {
    return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 8px">
  <tr><td style="border-radius:12px;background:${C.green}">
    <a href="${esc(url)}" target="_blank"
       style="display:inline-block;padding:14px 26px;font:700 14px/1 ${FONT};color:#000000;text-decoration:none;border-radius:12px">
       ${esc(label)}
    </a>
  </td></tr>
</table>`;
}

/** Key / value rows, e.g. [["Date","Mon 27 Oct"],["Time","6:00 PM"]] */
function details(rows) {
    const body = rows
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(
            ([label, value]) => `
  <tr>
    <td style="padding:10px 14px;font:400 13px/1.4 ${FONT};color:${C.muted};border-bottom:1px solid ${C.border};width:38%">${esc(label)}</td>
    <td style="padding:10px 14px;font:600 13px/1.4 ${FONT};color:#ffffff;border-bottom:1px solid ${C.border}">${esc(value)}</td>
  </tr>`
        )
        .join("");

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
       style="margin:18px 0;border:1px solid ${C.border};border-radius:12px;border-collapse:separate;overflow:hidden;background:#070707">
  ${body}
</table>`;
}

/** Highlighted quote/message box (e.g. announcement body) */
function quote(html, accent = C.green) {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0">
  <tr><td style="border-left:3px solid ${accent};background:#070707;border-radius:8px;padding:16px 18px;font:400 15px/1.65 ${FONT};color:${C.text}">
    ${html}
  </td></tr>
</table>`;
}

/** Simple list of items: [{title, subtitle}] */
function itemList(items) {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0">
  ${items
            .map(
                (item) => `
  <tr><td style="padding:12px 14px;border:1px solid ${C.border};border-radius:10px;background:#070707">
    <div style="font:600 14px/1.4 ${FONT};color:#ffffff">${esc(item.title)}</div>
    ${item.subtitle ? `<div style="margin-top:3px;font:400 12px/1.5 ${FONT};color:${C.muted}">${esc(item.subtitle)}</div>` : ""}
  </td></tr>
  <tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>`
            )
            .join("")}
</table>`;
}

/**
 * Wrap content in the BlockHub shell.
 * opts: { preheader, footerNote, preferencesUrl, unsubscribeUrl }
 */
function layout(content, opts = {}) {
    const config = getConfig();
    const year = new Date().getFullYear();

    const unsubscribe = opts.unsubscribeUrl
        ? `<a href="${esc(opts.unsubscribeUrl)}" style="color:${C.faint};text-decoration:underline">Unsubscribe</a> &nbsp;·&nbsp; `
        : "";
    const prefs = opts.preferencesUrl
        ? `<a href="${esc(opts.preferencesUrl)}" style="color:${C.faint};text-decoration:underline">Email preferences</a> &nbsp;·&nbsp; `
        : "";

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>BlockHub</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${esc(opts.preheader || "")}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.bg}">
  <tr><td align="center" style="padding:32px 14px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px">

      <tr><td style="padding:0 4px 18px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td style="width:36px;height:36px;border-radius:10px;background:#0d2a14;border:1px solid #1d5a2c;text-align:center;font:900 18px/36px ${FONT};color:${C.green}">B</td>
          <td style="padding-left:10px;font:700 16px/1 ${FONT};color:#ffffff">BlockHub</td>
        </tr></table>
      </td></tr>

      <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:20px;padding:32px 28px">
        ${content}
      </td></tr>

      <tr><td style="padding:22px 6px 0;font:400 12px/1.7 ${FONT};color:${C.faint};text-align:center">
        ${opts.footerNote ? `${esc(opts.footerNote)}<br/>` : ""}
        ${unsubscribe}${prefs}<a href="${esc(config.frontendUrl)}" style="color:${C.faint};text-decoration:underline">blockhubglobal.xyz</a>
        <br/>© ${year} BlockHub. Learn, build and grow in Web3.
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

module.exports = { layout, h1, p, small, eyebrow, button, details, quote, itemList, esc, textToHtml, C };
