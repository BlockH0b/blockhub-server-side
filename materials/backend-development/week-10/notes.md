## Before you start

This is the final week. You'll build a **capstone API** that brings together everything from the course, put it **live on the internet**, and **present** it. A live, tested, documented API is the strongest thing you can show an employer or client as a backend developer.

**What you need**

- Everything from Weeks 2–9
- GitHub, Render and MongoDB Atlas accounts
- Optional: Sentry and UptimeRobot (free) for monitoring

## 1. Choosing your capstone

Extend your blog API or build something new. Pick a problem you understand; you'll make better decisions and present it better.

| Idea | Resources | Integration |
| --- | --- | --- |
| E-commerce API | Users, products, carts, orders | Paystack + webhook, product images |
| Booking API | Providers, services, time slots, bookings | Confirmation emails, no double bookings |
| Event ticketing API | Events, ticket types, tickets, check-ins | Paystack, QR codes, emails |
| School/cohort API | Courses, classes, enrolments, assignments | File uploads, reminders |
| Delivery API | Customers, riders, orders, status updates | Webhooks, notifications |

**Minimum requirements**

1. Auth with httpOnly-cookie JWTs and **at least two roles**.
2. **Three or more related resources**, with ownership checks.
3. Zod validation and a central error handler.
4. Pagination and filtering on at least one list.
5. **One third-party integration**: uploads, emails or payments.
6. **10+ tests** with Jest and Supertest.
7. **Swagger docs** at `/api/docs`.
8. **Deployed** on Render with Atlas.

## 2. Planning the API

**1. Draw the data model**

```text
User 1 ── * Order 1 ── * OrderItem * ── 1 Product
  │                                         │
  └ role: customer | admin                  └ images (Cloudinary)
```

**2. Write the endpoint table before coding**

| Method | URL | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | |
| GET | `/api/products?category=&q=&page=` | Public | Paginated |
| POST | `/api/products` | Admin | Image upload |
| POST | `/api/orders` | Customer | Price calculated on the server |
| POST | `/api/orders/:id/pay` | Owner | Paystack initialize |
| POST | `/api/webhooks/paystack` | Paystack | Signed, idempotent |
| GET | `/api/orders/mine` | Customer | Own orders only |
| PATCH | `/api/orders/:id/status` | Admin | |

**3. Scope.** Must-haves first; nice-to-haves only after the must-haves are deployed.

**4. Plan your week**

| Day | Goal |
| --- | --- |
| 1 | Data model, endpoint table, repo, `/api/health` **deployed** |
| 2–3 | Auth and main resources, with tests as you go |
| 4 | Integration (payments/uploads/emails), docs |
| 5 | Hardening, more tests, README, seed data |
| 6 | Final checks on the live URL, rehearse, present |

## 3. Production readiness

**Validate configuration at startup.** If a variable is missing, crash immediately with a clear message, not hours later when a user hits that code.

```js
// src/config.js
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CLIENT_URL: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
```

**Production checklist**

- [ ] `"start": "node src/server.js"` in `package.json`; `"engines": { "node": ">=20" }`
- [ ] `app.set("trust proxy", 1)` (Render is a proxy; needed for rate limits and secure cookies)
- [ ] Cookies: `secure: true`, `sameSite: "none"` if the frontend is on another domain
- [ ] CORS allows only your real frontend URL(s)
- [ ] helmet, body limits, rate limits on
- [ ] Error handler hides stack traces in production
- [ ] `.env` not in Git; `.env.example` complete
- [ ] `npm audit` clean (or understood)
- [ ] Indexes defined for your main queries

## 4. Health checks and graceful shutdown

```js
// src/app.js
import mongoose from "mongoose";

app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    uptime: Math.round(process.uptime()),
    version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || "dev",
  });
});
```

**Graceful shutdown:** when Render deploys a new version, it sends `SIGTERM` to the old one. Finish in-flight requests before exiting.

```js
// src/server.js
import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config.js";

await mongoose.connect(env.MONGO_URI);
const server = app.listen(env.PORT, () => console.log(`API running on port ${env.PORT}`));

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // force exit after 10s
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

## 5. Deploying on Render

1. Push to GitHub (check `.env` isn't there).
2. **render.com → New → Web Service** → connect the repo.
3. Settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci` |
| Start command | `npm start` |
| Instance type | Free (or Starter to avoid sleeping) |
| Health check path | `/api/health` |

4. **Environment variables:**

```text
NODE_ENV             production
MONGO_URI            mongodb+srv://.../capstone-prod
JWT_SECRET           (64+ random characters, different from development)
CLIENT_URL           https://your-frontend.netlify.app
PAYSTACK_SECRET_KEY  sk_test_...   (test keys until you're truly live)
CLOUDINARY_URL       cloudinary://...
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM
```

5. **Create Web Service** and watch the **Logs** tab until you see "API running".
6. Open `https://your-api.onrender.com/api/health` and `/api/docs`.
7. Update the `servers` URL in `openapi.yaml` to include the live URL.
8. Point your Paystack webhook URL at `https://your-api.onrender.com/api/webhooks/paystack`.

**Every push to the main branch redeploys automatically.** Use **Manual Deploy → Clear build cache & deploy** if a build behaves strangely.

**Free tier sleeps** after ~15 minutes of no traffic; the next request takes up to a minute. For demos, wake it a few minutes early. Background jobs and in-memory queues stop while it sleeps, so important emails need a persistent queue or a paid instance.

## 6. MongoDB Atlas in production

- **Separate database** for production (`capstone-prod`). Never test against production data.
- **A dedicated database user** with `readWrite` on that database only, and a long random password.
- **Network access:** Render's free tier doesn't have fixed outbound IPs, so you usually allow `0.0.0.0/0`. That makes the strong password essential. Paid plans offer static IPs you can allow-list instead.
- **Backups:** the free M0 tier has limited backup options. Export important data with `mongodump` or upgrade when real users depend on it.
- **Indexes:** in production Mongoose's `autoIndex` still builds them on start, but for big collections create them deliberately and check with `explain()`.

**Seed demo data** so reviewers see a working app:

```bash
MONGO_URI="mongodb+srv://.../capstone-prod" node scripts/seed.js
```

Create a **demo account** for each role and put the logins in your README.

## 7. Monitoring a live API

| What | Tool | Why |
| --- | --- | --- |
| **Logs** | Render → Logs (your pino JSON logs) | See what happened, search by request id |
| **Errors** | Sentry (free tier) | Get an alert with the stack trace when something crashes |
| **Uptime** | UptimeRobot or Better Stack | Ping `/api/health` every 5 minutes; get an email when it's down |
| **Database** | Atlas → Metrics / Performance Advisor | Slow queries and index suggestions |

**Sentry in Express (outline)**

```js
// instrument.js, imported first in server.js
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });

// in app.js, after routes and before your own error handler
Sentry.setupExpressErrorHandler(app);
```

Follow the current Sentry Node docs for exact setup, since it changes between versions.

**When something breaks in production**

1. Check `/api/health`.
2. Read the Render logs around the time of the error.
3. Reproduce it locally with the same input.
4. Write a failing test, fix the bug, push. Render redeploys.

## 8. Documentation and README

**Your README is your API's front door.**

```markdown
# ShopAPI

REST API for a small online store: products, carts, orders and Paystack payments.

**Live API:** https://shopapi.onrender.com · **Docs:** https://shopapi.onrender.com/api/docs
**Demo logins:** admin@shopapi.dev / demo12345 · customer@shopapi.dev / demo12345
**Tests:** 42 passing · 81% coverage

## Features
- JWT auth in httpOnly cookies, customer and admin roles
- Products with Cloudinary images, search, filters and pagination
- Orders priced on the server; Paystack payments confirmed by signed webhook
- Order emails with Nodemailer

## Stack
Node 22, Express 5, MongoDB + Mongoose, Zod, Jest + Supertest, Swagger, Render

## Architecture
src/
  config.js      validated environment
  app.js         middleware, routes, errors
  routes/        URL → controller
  controllers/   request handling
  models/        Mongoose schemas
  services/      Cloudinary, email, Paystack
  middleware/    auth, validate, upload, error

## Key decisions
- Prices stored as integers in kobo to avoid floating-point errors
- Orders are marked paid only by the verified webhook, never by the client

## Run locally
npm install
cp .env.example .env   # fill in values
npm run dev
npm test
```

**Also check:**

- Swagger covers every endpoint, with auth and error responses.
- `.env.example` lists every variable.
- Commit history tells a story (not one giant "final" commit).

## 9. Presenting your API

APIs have no UI, so plan how you'll **show** it.

**Five minutes**

1. **Problem (30 seconds):** who it's for and what it solves.
2. **Live demo (2.5 minutes):** use Swagger UI or a Thunder Client collection against the **live** URL. Show a full flow: register → log in → main action → a blocked action (403) → the result in the database or an email.
3. **Under the hood (1.5 minutes):** your data model diagram, how auth and permissions work, and one hard problem you solved (e.g. webhook idempotency, preventing double bookings).
4. **Proof (30 seconds):** run `npm test` (or show the GitHub Actions badge) and say what you'd build next.

**Before you present**

- [ ] Wake the Render service a few minutes early
- [ ] Thunder Client collection pointed at the live URL, with demo logins
- [ ] Seed data loaded so lists aren't empty
- [ ] Notifications off, large font in VS Code and the browser
- [ ] Rehearse once with a timer

## 10. Final checklist and glossary

**Capstone submission (on BlockHub)**

1. Live API URL (`/api/health` returns 200)
2. Docs URL (`/api/docs`)
3. GitHub repo with README, `.env.example` and tests
4. Demo logins for each role
5. Your Thunder Client collection (exported) or a short demo video

**End-of-course checklist**

- [ ] Plan an API: data model, endpoints and permissions
- [ ] Validate configuration at startup
- [ ] Add a health check and graceful shutdown
- [ ] Deploy on Render with environment variables
- [ ] Configure Atlas safely for production
- [ ] Monitor logs, errors and uptime
- [ ] Debug a production issue from the logs
- [ ] Write a portfolio-ready README and docs
- [ ] Present an API clearly in 5 minutes

**Glossary**

| Term | Meaning |
| --- | --- |
| Capstone | A final project that brings together everything you learned |
| Production | The live environment real users depend on |
| Deployment | Putting your code on a server so others can use it |
| Environment variable | Configuration stored on the host, not in code |
| Health check | A route the host and monitors call to confirm the app works |
| Graceful shutdown | Finishing current requests before the process stops |
| SIGTERM | The signal a host sends to ask a process to stop |
| Monitoring | Watching logs, errors and uptime of a live app |
| Uptime | How much of the time a service is available |
| Seed data | Sample data loaded so the app isn't empty |
| Least privilege | Giving each user or service only the access it needs |

**Congratulations on finishing the Backend Development track.** You can now design, build, secure, test, document and deploy real APIs. Keep shipping, and come back to help the next cohort.
