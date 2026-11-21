## Before you start

Real products don't build everything themselves. They use specialists: **Cloudinary** for images, an **email provider** for mail, **Paystack** for payments. This week you learn to accept file uploads, send emails, call third-party APIs and take payments, plus how to handle **webhooks** safely.

**What you need**

- Your Week 7 blog API
- `npm install multer cloudinary nodemailer`
- Free accounts: **Cloudinary**, **Paystack** (test mode), and **Mailtrap** or **Ethereal** (fake inboxes for testing)

**Add to `.env`**

```bash
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="My Blog <no-reply@myblog.com>"
PAYSTACK_SECRET_KEY=sk_test_...
CLIENT_URL=http://localhost:5173
```

## 1. How file uploads work

JSON can't carry files efficiently. Browsers send files as **multipart/form-data**: the body is split into parts, one per field or file.

```text
POST /api/users/me/avatar
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="avatar"; filename="me.jpg"
Content-Type: image/jpeg

<binary data>
------X--
```

`express.json()` ignores this. You need **Multer**.

**From a frontend**

```js
const form = new FormData();
form.append("avatar", fileInput.files[0]);

await fetch(`${API}/users/me/avatar`, {
  method: "POST",
  body: form,             // don't set Content-Type yourself; the browser adds the boundary
  credentials: "include",
});
```

**In Thunder Client:** Body → **Form** → tick **Files** → choose a field name and a file.

## 2. Multer

```js
// middleware/upload.js
import multer from "multer";
import { AppError } from "../utils/errors.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const uploadImage = multer({
  storage: multer.memoryStorage(), // file stays in RAM as req.file.buffer
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2 MB, one file
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "Only JPG, PNG or WebP images are allowed"));
  },
});
```

```js
// routes/users.js
router.post("/me/avatar", protect, uploadImage.single("avatar"), users.uploadAvatar);

// several files: uploadImage.array("photos", 5) → req.files
// several fields: uploadImage.fields([{ name: "cover", maxCount: 1 }, { name: "gallery", maxCount: 4 }])
```

**What `req.file` contains**

| Property | Example |
| --- | --- |
| `fieldname` | `"avatar"` |
| `originalname` | `"me.jpg"` |
| `mimetype` | `"image/jpeg"` |
| `size` | `183245` (bytes) |
| `buffer` | The file's bytes (memory storage) |

**Handle Multer's own errors** (e.g. file too large) in your error handler:

```js
import multer from "multer";

if (err instanceof multer.MulterError) {
  const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 2 MB)" : err.message;
  return res.status(400).json({ message: msg });
}
```

## 3. Validating files safely

- **Limit size and count** (Multer `limits`).
- **Allow-list types** you need; never block-list.
- `mimetype` comes from the client and can be faked. For stronger checks, inspect the file's first bytes (the `file-type` package), or let Cloudinary reject non-images.
- **Never use the original filename** as a path on your server (`../../etc/passwd.jpg`).
- Don't store uploads on your server's disk in production: hosts like Render wipe the disk on every deploy, and it doesn't scale to several servers.

## 4. Storing images on Cloudinary

Cloudinary stores, resizes, compresses and serves images from a fast CDN.

```js
// services/cloudinary.js
import { v2 as cloudinary } from "cloudinary"; // reads CLOUDINARY_URL from the environment

export function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(buffer);
  });
}

export const deleteImage = (publicId) => cloudinary.uploader.destroy(publicId);
```

**Controller**

```js
export const uploadAvatar = async (req, res) => {
  if (!req.file) throw badRequest("Please choose an image");

  const { secure_url, public_id } = await uploadBuffer(req.file.buffer, "blog/avatars");

  const old = req.user.avatar?.publicId;
  req.user.avatar = { url: secure_url, publicId: public_id };
  await req.user.save();
  if (old) deleteImage(old).catch(() => {}); // clean up the previous one

  res.json({ avatar: req.user.avatar });
};
```

**Save both** `url` (to display) and `public_id` (to delete or replace later).

**Image transformations in the URL:** `.../upload/w_200,h_200,c_fill,g_face/...` gives a 200×200 face-cropped thumbnail without uploading again.

**Alternative: direct uploads.** For large files or videos, the frontend can upload straight to Cloudinary (or S3) using a **signed** request your API creates. Your server never handles the bytes.

## 5. Sending emails with Nodemailer

```js
// services/email.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // true for port 465
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendEmail({ to, subject, html, text }) {
  return transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
}
```

**Testing without spamming real people**

| Tool | How |
| --- | --- |
| **Mailtrap** | Copy its SMTP settings into `.env`; emails appear in your Mailtrap inbox |
| **Ethereal** | `nodemailer.createTestAccount()` creates a fake account; each email gives a preview URL |

**Production providers**

| Provider | Notes |
| --- | --- |
| Gmail SMTP | Fine for testing; needs an App Password; low daily limit (~500/day) |
| Resend, Brevo, Mailgun, Postmark, Amazon SES | Built for apps: higher limits, better delivery, dashboards |

Set up **SPF, DKIM and DMARC** records on your domain (the provider shows you how), or your emails land in spam.

## 6. Email templates and not blocking requests

**A simple template**

```js
// emails/templates.js
const escapeHtml = (s = "") =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const layout = (body) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
    ${body}
    <p style="color:#888;font-size:12px">You're receiving this because you have an account on My Blog.</p>
  </div>`;

export const welcomeEmail = (user) => ({
  subject: "Welcome to My Blog 👋",
  html: layout(`<h1>Hi ${escapeHtml(user.name)}!</h1><p>Thanks for joining. Start reading or write your first post.</p>`),
  text: `Hi ${user.name}! Thanks for joining My Blog.`,
});

export const resetEmail = (link) => ({
  subject: "Reset your password",
  html: layout(`<p>Click below to reset your password. The link expires in 15 minutes.</p>
    <p><a href="${link}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Reset password</a></p>
    <p>If you didn't ask for this, ignore this email.</p>`),
  text: `Reset your password: ${link}`,
});
```

Always **escape user-provided text** (names, comments) before putting it in HTML.

**Don't make the user wait for the email.** Sending can take seconds or fail.

```js
export const register = async (req, res) => {
  const user = await User.create(req.valid.body);
  setAuthCookie(res, user);
  res.status(201).json({ user: publicUser(user) });

  // after responding: fire and log failures
  sendEmail({ to: user.email, ...welcomeEmail(user) }).catch((err) =>
    req.log.error({ err }, "welcome email failed")
  );
};
```

**For important emails, use a queue.** A job queue (BullMQ with Redis, or Agenda with MongoDB) stores emails, sends them in the background, **retries** failures and survives restarts. An in-memory array of pending emails is lost whenever the server restarts.

## 7. Calling third-party APIs well

```js
// utils/http.js
import { AppError } from "./errors.js";

export async function callApi(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new AppError(504, "The service took too long to respond");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AppError(502, data?.message || "The service returned an error");
  return data;
}
```

**Rules for third-party APIs**

- **Secret keys stay on the server**, in `.env`. Paystack's *public* key can go in the frontend; the *secret* key never.
- **Always set a timeout.** Without one, a slow service ties up your server.
- **Check `res.ok`.** `fetch` doesn't throw on 4xx/5xx.
- **Retry only safe operations** (GETs, or requests with an idempotency key). Never blindly retry "charge this card".
- **Read the docs** for rate limits and test modes.
- **Wrap each service** in its own module (`services/paystack.js`), so swapping providers later is easy.

## 8. Paystack payments

**The flow**

```text
1. Frontend → your API:     POST /api/payments/initialize
2. Your API → Paystack:     POST /transaction/initialize  (secret key, email, amount, reference)
3. Your API → Frontend:     { url: authorization_url }
4. User pays on Paystack's page, is redirected to your callback_url?reference=...
5. Frontend → your API:     GET /api/payments/verify/:reference
6. Your API → Paystack:     GET /transaction/verify/:reference  → mark paid if "success"
7. Paystack → your API:     POST /api/webhooks/paystack  (charge.success): the reliable signal
```

**Payment model**

```js
const paymentSchema = new mongoose.Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // in kobo
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    paidAt: Date,
  },
  { timestamps: true }
);
```

**services/paystack.js**

```js
import { callApi } from "../utils/http.js";

const BASE = "https://api.paystack.co";
const headers = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

export const initialize = (body) =>
  callApi(`${BASE}/transaction/initialize`, { method: "POST", headers: headers(), body: JSON.stringify(body) });

export const verify = (reference) =>
  callApi(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, { headers: headers() });
```

**controllers/payments.js**

```js
import crypto from "node:crypto";
import * as paystack from "../services/paystack.js";
import Payment from "../models/Payment.js";

const AMOUNT = 500000; // ₦5,000 in kobo: decided by the SERVER, not the client

export const initialize = async (req, res) => {
  const reference = `blog_${crypto.randomUUID()}`;
  await Payment.create({ user: req.user._id, reference, amount: AMOUNT });

  const { data } = await paystack.initialize({
    email: req.user.email,
    amount: AMOUNT,
    reference,
    callback_url: `${process.env.CLIENT_URL}/payment/callback`,
  });
  res.json({ url: data.authorization_url, reference });
};

export const verifyPayment = async (req, res) => {
  const payment = await Payment.findOne({ reference: req.params.reference, user: req.user._id });
  if (!payment) throw notFound("Payment");
  if (payment.status === "paid") return res.json({ status: "paid" });

  const { data } = await paystack.verify(payment.reference);
  if (data.status === "success" && data.amount === payment.amount) {
    payment.status = "paid";
    payment.paidAt = new Date(data.paid_at);
    await payment.save();
  }
  res.json({ status: payment.status });
};
```

**Always check the amount** returned by Paystack matches what you expected.

**Test cards:** Paystack's docs list test card numbers for success and failure in test mode.

## 9. Webhooks

A **webhook** is a request **a service sends to you** when something happens (a payment succeeds, an email bounces). It's more reliable than the redirect: users close tabs, lose network, or never come back.

**Three rules**

1. **Verify the signature.** Anyone can POST to your URL. Paystack signs the raw body with your secret key (HMAC SHA-512) in the `x-paystack-signature` header.
2. **Be idempotent.** Services retry webhooks, so the same event can arrive twice. Processing it twice must not double-credit anyone.
3. **Respond 200 quickly.** Do heavy work afterwards or in a queue.

```js
// server.js: register BEFORE app.use(express.json()), because we need the raw bytes
import crypto from "node:crypto";

app.post("/api/webhooks/paystack", express.raw({ type: "application/json" }), async (req, res) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body) // a Buffer, exactly as received
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));

  if (event.event === "charge.success") {
    // only updates if still pending → safe to receive twice
    await Payment.updateOne(
      { reference: event.data.reference, status: "pending", amount: event.data.amount },
      { status: "paid", paidAt: new Date(event.data.paid_at) }
    );
  }

  res.sendStatus(200);
});
```

**Testing webhooks locally:** Paystack can't reach `localhost`. Use a tunnel such as **ngrok** (`ngrok http 5000`) or Cloudflare Tunnel, and paste the public URL into Paystack Dashboard → Settings → API Keys & Webhooks.

## 10. Week 8 build: uploads, emails and payments

**Requirements**

1. **Avatar upload:** `POST /api/users/me/avatar` (2 MB, images only) → Cloudinary; old image deleted.
2. **Post cover image:** `POST /api/posts/:id/cover` (owner only).
3. **Emails:** a welcome email on register and a real password-reset email (from Week 6) via Nodemailer + Mailtrap/Ethereal, sent without blocking the response.
4. **Payments:** a "Support the author" payment of a fixed amount with Paystack test keys: initialize, verify and a signed webhook.
5. All keys in `.env`, documented in `.env.example`.
6. Errors from Multer, Cloudinary, SMTP and Paystack handled with clear messages.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the build above.
2. Record a short screen video: upload an avatar, receive the welcome email in Mailtrap, complete a test payment.
3. Push and submit on BlockHub.

**End-of-week checklist**

- [ ] Explain multipart/form-data and parse files with Multer
- [ ] Limit file size, count and type
- [ ] Upload to Cloudinary and store `url` and `public_id`
- [ ] Send emails with Nodemailer and test them safely
- [ ] Send emails without making users wait; explain why queues help
- [ ] Call third-party APIs with timeouts and proper errors
- [ ] Initialize and verify a Paystack transaction
- [ ] Verify a webhook signature and process events idempotently

**Glossary**

| Term | Meaning |
| --- | --- |
| multipart/form-data | The request format used to upload files |
| Multer | Express middleware that parses file uploads |
| Buffer | Raw bytes in memory |
| CDN | A network of servers that delivers files quickly worldwide |
| public_id | Cloudinary's id for an uploaded file |
| SMTP | The protocol for sending email |
| Transporter | Nodemailer's configured connection for sending mail |
| Queue | A list of background jobs processed with retries |
| Third-party API | A service built by another company that your app calls |
| Kobo | 1/100 of a naira; Paystack amounts are in kobo |
| Webhook | A request a service sends to your API when something happens |
| HMAC | A signature made with a secret key to prove a message is genuine |
| Idempotent | Safe to process more than once with the same result |
| Tunnel | A tool that gives your localhost a public URL |
