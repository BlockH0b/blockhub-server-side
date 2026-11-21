## Before you start

Your blog API works and has auth. But what happens if someone sends a 10 MB title, a price of `"free"`, `{"$gt": ""}` as a password, or tries to log in a million times? This week you make your API **robust and secure**: validate every input, handle every error the same way, log what happens, and block the most common attacks.

**What you need**

- Your Week 6 blog API
- `npm install zod helmet express-rate-limit pino pino-http`
- `npm install -D pino-pretty` (readable logs in development)

## 1. Why validate input?

**Never trust anything from the client.** Requests can come from your app, a buggy app, a script or an attacker.

| Without validation | What can happen |
| --- | --- |
| Missing or wrong types | Crashes, `undefined` saved, broken pages |
| Huge strings or arrays | Slow server, huge database, out of memory |
| Objects where you expect strings | **NoSQL injection**: `{ "email": { "$ne": "" } }` matches any user |
| Extra fields | **Mass assignment**: `{ "role": "admin" }` slips into an update |
| Unexpected values | `sort=password` or `limit=1000000` |

Mongoose validation helps, but it runs **only when saving**, and doesn't cover queries, params, or fields that don't exist in the schema. Validate at the **edge**, as soon as the request arrives.

## 2. Validating with Zod

**Zod** lets you describe the shape of data once and check it.

```js
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(20),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(5).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const updatePostSchema = createPostSchema.partial(); // every field optional
```

**Using it**

```js
const result = createPostSchema.safeParse(req.body);

if (!result.success) {
  console.log(result.error.issues);
  // [{ path: ["title"], message: "String must contain at least 3 character(s)" }, ...]
} else {
  console.log(result.data); // cleaned: trimmed, lowercased, defaults filled, unknown keys removed
}
```

**Useful Zod pieces**

| Code | Checks |
| --- | --- |
| `z.string().min(1).max(100)` | Length |
| `z.string().email()`, `.url()` | Format |
| `z.string().regex(/^[a-f0-9]{24}$/)` | Pattern (e.g. an ObjectId) |
| `z.number().int().positive()` | Numbers |
| `z.coerce.number()` | Converts `"5"` → `5` (for query strings) |
| `z.enum(["a", "b"])` | One of a list |
| `z.array(z.string()).max(5)` | Arrays |
| `.optional()`, `.default(x)` | Optional or defaulted |
| `.partial()` | Make every field optional (for PATCH) |
| `.strict()` | Reject unknown keys instead of stripping them |

**Note:** `password.max(72)`: bcrypt only uses the first 72 bytes, so very long passwords give a false sense of security.

## 3. A reusable validate middleware

```js
// middleware/validate.js
export const validate = (schema, where = "body") => (req, res, next) => {
  const result = schema.safeParse(req[where]);
  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  req.valid = { ...req.valid, [where]: result.data };
  next();
};
```

**Using it**

```js
import { z } from "zod";

const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, "Invalid id") });

router.get("/", validate(listPostsQuery, "query"), posts.list);
router.post("/", protect, validate(createPostSchema), posts.create);
router.patch("/:id", protect, validate(idParam, "params"), validate(updatePostSchema), posts.update);
```

**In the controller, use only validated data:**

```js
export const create = async (req, res) => {
  const post = await Post.create({ ...req.valid.body, author: req.user._id });
  res.status(201).json(post);
};
```

We store results in `req.valid` because in Express 5 `req.query` is read-only.

**Query strings with coercion**

```js
export const listPostsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  tag: z.string().trim().toLowerCase().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
});
```

Now `?limit=100000` gets a 400 instead of loading your whole database, and `?q[$ne]=` can't sneak an object in.

## 4. Custom error classes

Instead of writing `res.status(404).json(...)` everywhere, **throw** errors and handle them in one place.

```js
// utils/errors.js
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isOperational = true; // an expected error, safe to show the message
  }
}

export const badRequest = (msg = "Bad request", details) => new AppError(400, msg, details);
export const unauthorized = (msg = "Please log in") => new AppError(401, msg);
export const forbidden = (msg = "You don't have permission") => new AppError(403, msg);
export const notFound = (what = "Resource") => new AppError(404, `${what} not found`);
export const conflict = (msg) => new AppError(409, msg);
```

**Controllers become shorter**

```js
export const update = async (req, res) => {
  const post = await Post.findById(req.valid.params.id);
  if (!post) throw notFound("Post");
  if (!post.author.equals(req.user._id) && req.user.role !== "admin") throw forbidden();

  Object.assign(post, req.valid.body);
  res.json(await post.save());
};
```

**Operational vs programmer errors**

| Operational (expected) | Programmer (bugs) |
| --- | --- |
| Not found, invalid input, wrong password | `undefined is not a function`, typos |
| Show the message to the user | Log it, show a generic message, fix the bug |

## 5. A central error handler

```js
// middleware/error.js
export function notFoundRoute(req, res) {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  // our own errors
  if (err.isOperational) {
    return res.status(err.status).json({ message: err.message, errors: err.details });
  }
  // known library errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err.name === "CastError") return res.status(400).json({ message: `Invalid ${err.path}` });
  if (err.code === 11000) {
    return res.status(409).json({ message: `${Object.keys(err.keyValue)[0]} already exists` });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large" });
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  // unknown: a bug
  req.log ? req.log.error({ err }, "unhandled error") : console.error(err);
  res.status(500).json({ message: "Something went wrong" });
}
```

```js
// server.js, after all routes
app.use(notFoundRoute);
app.use(errorHandler);
```

**Every error response has the same shape:** `{ message, errors? }`. Frontends love this.

**Crashes outside requests:** log them and exit, so your host restarts the app in a clean state.

```js
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandled rejection");
  process.exit(1);
});
```

## 6. Logging

`console.log` is fine for learning. Real APIs use **structured logs** (JSON) that can be searched.

```js
// logger.js
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password"],
  transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
});
```

```js
// server.js
import pinoHttp from "pino-http";
import { logger } from "./logger.js";

app.use(pinoHttp({ logger })); // logs every request with method, url, status, time and an id

// inside any handler
req.log.info({ postId: post.id }, "post created");
```

**Log levels:** `fatal` > `error` > `warn` > `info` > `debug`. Production usually logs `info` and above.

**Never log:** passwords, tokens, cookies, card details, or full personal data. `redact` hides them automatically.

## 7. Security headers, CORS and body limits

```js
import helmet from "helmet";
import cors from "cors";

app.disable("x-powered-by");   // don't advertise "Express"
app.use(helmet());             // ~a dozen security headers

app.use(
  cors({
    origin: process.env.CLIENT_URL.split(","), // e.g. "https://myblog.com,http://localhost:5173"
    credentials: true,                          // allow cookies
  })
);

app.use(express.json({ limit: "100kb" })); // reject huge bodies (413)
app.use(cookieParser());
```

**What helmet sets (examples)**

| Header | Protects against |
| --- | --- |
| `Content-Security-Policy` | Injected scripts (XSS) |
| `Strict-Transport-Security` | Downgrading to HTTP |
| `X-Content-Type-Options: nosniff` | Browsers guessing file types |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking |

**CORS is not authentication.** It only tells browsers which sites may read responses. Scripts and Postman ignore it. Always protect routes with auth too.

## 8. Rate limiting

```js
import rateLimit from "express-rate-limit";

// strict limit on login and password reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in 15 minutes." },
});
app.use(["/api/auth/login", "/api/auth/forgot"], authLimiter);

// general limit on the whole API
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 120 }));
```

**Behind a proxy** (Render, Heroku, Nginx), add `app.set("trust proxy", 1)` so the real client IP is used, not the proxy's.

**Notes**

- The default store is in memory: fine for one server. With several servers, use a shared store like Redis.
- Expensive routes (AI, emails, uploads) deserve their own tighter limits.

## 9. OWASP API Security risks

**OWASP** publishes the most common API security problems. Here are the ones you've now covered, and how.

| Risk | Example | Defence |
| --- | --- | --- |
| Broken object-level authorization (IDOR) | `GET /api/orders/123` shows another user's order | Ownership checks (Week 6) |
| Broken authentication | No rate limit on login, weak secrets | bcrypt, JWT expiry, rate limits, `.env` |
| Broken property-level authorization | Users set `role`, or responses include `password` | Validate with Zod, `select: false`, return only safe fields |
| Unrestricted resource consumption | `limit=1000000`, 50 MB bodies | Validation limits, body limits, rate limits |
| Broken function-level authorization | Readers can call admin routes | `allow("admin")` |
| Security misconfiguration | Stack traces in responses, open CORS | Central error handler, helmet, strict CORS |
| Injection | `{ "$ne": "" }` in a login | Validate types; Mongoose `sanitizeFilter` option |

**Extra protection against NoSQL injection:**

```js
mongoose.set("sanitizeFilter", true); // wraps query values so $-operators from users are treated as values
```

**Keep dependencies updated:** run `npm audit` regularly and update packages with known vulnerabilities.

## 10. Week 7 build: a hardened blog API

**Requirements**

1. Zod schemas for every route's body, query and params; controllers use only `req.valid`.
2. `AppError` helpers; no `res.status(4xx)` left in controllers.
3. One `notFoundRoute` and one `errorHandler` with a consistent `{ message, errors? }` shape.
4. pino + pino-http logging with redaction.
5. `helmet`, strict CORS from `CLIENT_URL`, `express.json({ limit: "100kb" })`, `x-powered-by` off.
6. Rate limits on login/forgot and on the whole API; `trust proxy` set for deployment.
7. Responses never include passwords or reset tokens.

**Attack yourself** and save these in Thunder Client:

| Attack | Expect |
| --- | --- |
| Login with `{ "email": { "$ne": "" }, "password": { "$ne": "" } }` | 400 |
| Register with `"role": "admin"` | 201, but role stays `reader` |
| POST a post with a 200 KB body | 413 |
| `GET /api/posts?limit=100000` | 400 |
| `GET /api/posts/not-an-id` | 400 |
| 11 wrong logins in a row | 429 |
| Broken JSON (`{ "title": `) | 400 "Invalid JSON body" |

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the hardened blog API.
2. Run `npm audit` and fix what you can.
3. Push and submit on BlockHub with your attack collection.

**End-of-week checklist**

- [ ] Explain why validation must happen on the server
- [ ] Write Zod schemas with limits, formats, enums and defaults
- [ ] Validate body, query and params with one middleware
- [ ] Throw `AppError`s and handle all errors in one place
- [ ] Map Mongoose, JSON and JWT errors to the right status codes
- [ ] Log with pino and redact secrets
- [ ] Add helmet, strict CORS and body limits
- [ ] Add rate limits and explain `trust proxy`
- [ ] Name five OWASP API risks and how you defend against each

**Glossary**

| Term | Meaning |
| --- | --- |
| Validation | Checking input has the right shape, types and limits |
| Schema | A description of what valid data looks like |
| Coercion | Converting a value to another type, like `"5"` → `5` |
| Mass assignment | Users setting fields they shouldn't, by adding them to the body |
| NoSQL injection | Sending database operators as input to change a query |
| Operational error | An expected failure, like not found or bad input |
| Structured logging | Logging JSON objects instead of plain text |
| Redaction | Hiding sensitive values in logs |
| helmet | Middleware that sets security headers |
| Rate limiting | Capping how many requests a client can make |
| 413 | Payload Too Large |
| 429 | Too Many Requests |
| OWASP | A non-profit that publishes web and API security guidance |
