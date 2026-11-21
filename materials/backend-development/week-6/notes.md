## Before you start

Right now anyone can create, edit or delete posts on your blog API. This week you add **authentication** (who are you?) and **authorization** (what are you allowed to do?). These are the most important security features in any backend, and the topic interviewers ask about most.

**What you need**

- Your Week 5 blog API
- `npm install bcryptjs jsonwebtoken cookie-parser`
- A long random `JWT_SECRET` in `.env`. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 1. Authentication vs authorization

| | Authentication | Authorization |
| --- | --- | --- |
| Question | Who are you? | What are you allowed to do? |
| Examples | Email + password, Google login, a token | Roles (admin), ownership (your post) |
| Fails with | **401 Unauthorized** | **403 Forbidden** |
| Happens | First | After authentication |

**The golden rule:** the frontend can hide buttons for convenience, but **only the backend enforces** access. Anyone can call your API directly with Thunder Client or curl.

## 2. Hashing passwords

**Never store plain passwords.** If your database leaks, attackers get every password, and people reuse passwords across sites.

| | Encryption | Hashing |
| --- | --- | --- |
| Reversible? | Yes, with a key | No |
| Use for passwords? | No | **Yes** |

**bcrypt** is a hashing algorithm built for passwords:

- It adds a random **salt**, so two users with the same password get different hashes.
- It's deliberately **slow** (the cost factor), so guessing billions of passwords is impractical.

```js
import bcrypt from "bcryptjs";

const hash = await bcrypt.hash("mypassword123", 12); // cost 12
// "$2a$12$Lk3...": algorithm, cost, salt and hash in one string

await bcrypt.compare("mypassword123", hash); // true
await bcrypt.compare("wrongpassword", hash); // false
```

**The User model**

```js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["reader", "author", "admin"], default: "reader" },
    passwordResetHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// hash whenever the password is set or changed
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("User", userSchema);
```

- `select: false` hides the password from every query unless you ask with `.select("+password")`.
- The hook only hashes when the password changed, so updating a name doesn't double-hash it.

## 3. JSON Web Tokens (JWT)

HTTP is **stateless**: each request is separate, and the server doesn't remember who you are. After login, the client must prove its identity on every request. A **JWT** is a signed proof.

```text
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI2NzVhIiwicm9sZSI6ImF1dGhvciJ9 . 4f9Kx2...
       header                         payload                      signature
```

| Part | Contains |
| --- | --- |
| Header | The algorithm, e.g. HS256 |
| Payload | Claims: `sub` (user id), `role`, `iat` (issued at), `exp` (expiry) |
| Signature | Made with your `JWT_SECRET`. Changing anything breaks it. |

**The payload is only base64-encoded, not encrypted.** Anyone can decode it at jwt.io. Never put passwords or private data in it.

```js
import jwt from "jsonwebtoken";

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

const payload = jwt.verify(token, process.env.JWT_SECRET);
// throws if the signature is wrong or the token expired
```

**JWT vs sessions:** with sessions, the server stores session data (in memory, Redis or a database) and gives the client a session id cookie. With JWTs, the token itself carries the data, so the server stores nothing. Trade-off: a JWT can't easily be cancelled before it expires, so keep expiry short.

## 4. Where to keep the token: cookies vs headers

| Option | Pros | Cons |
| --- | --- | --- |
| **httpOnly cookie** | JavaScript can't read it, so injected scripts (XSS) can't steal it; the browser sends it automatically | Needs CORS `credentials` set up; consider CSRF |
| **Authorization header** (`Bearer`) | Simple; great for mobile apps and API clients | The client must store it somewhere |
| **localStorage** | Easiest for beginners | Any script on the page can read it |

**For browser apps, use an httpOnly cookie.** That's what BlockHub does. Support the header too, for mobile apps and Thunder Client.

**Setting the cookie**

```js
const isProd = process.env.NODE_ENV === "production";

export function setAuthCookie(res, user) {
  res.cookie("token", signToken(user), {
    httpOnly: true,                       // JS can't read it
    secure: isProd,                       // HTTPS only in production
    sameSite: isProd ? "none" : "lax",    // "none" if frontend and API are on different domains
    maxAge: 24 * 60 * 60 * 1000,          // 1 day, matches the JWT
  });
}
```

**server.js**

```js
import cookieParser from "cookie-parser";
import cors from "cors";

app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
```

The frontend must send cookies with `fetch(url, { credentials: "include" })`.

**CSRF:** because browsers send cookies automatically, another site could trigger requests. `sameSite: "lax"` blocks most of this. For cross-site setups (`sameSite: "none"`), keep CORS strict and require JSON bodies.

## 5. Register, login, logout and me

**controllers/auth.js**

```js
import User from "../models/User.js";
import { setAuthCookie } from "../utils/auth.js";

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ message: "Name, email and an 8+ character password are required" });
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    return res.status(409).json({ message: "Email already registered" });
  }
  // role is NOT taken from req.body: users can't make themselves admin
  const user = await User.create({ name, email, password });
  setAuthCookie(res, user);
  res.status(201).json({ user: publicUser(user) });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");
  if (!user || !(await user.checkPassword(password || ""))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  setAuthCookie(res, user);
  res.json({ user: publicUser(user) });
};

export const logout = (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  res.status(204).end();
};

export const me = (req, res) => res.json({ user: publicUser(req.user) });
```

**Why "Invalid email or password" for both cases?** If you said "email not found", attackers could check which emails have accounts (account enumeration).

## 6. Protecting routes

**middleware/auth.js**

```js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const bearer = (req) => {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};

export const protect = async (req, res, next) => {
  const token = req.cookies?.token || bearer(req);
  if (!token) return res.status(401).json({ message: "Please log in" });

  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(sub);
    if (!req.user) throw new Error("User no longer exists");
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
};
```

Loading the user from the database on every request means deleted users and role changes take effect immediately.

**routes/auth.js**

```js
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, me);
```

## 7. Roles and permissions

```js
export const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You don't have permission to do that" });
  }
  next();
};
```

```js
// routes/posts.js
router.get("/", posts.list);                                       // public
router.post("/", protect, allow("author", "admin"), posts.create); // authors and admins
router.patch("/:id", protect, posts.update);                       // owner or admin (in controller)
router.delete("/:id", protect, posts.remove);

// routes/users.js
router.patch("/:id/role", protect, allow("admin"), users.setRole); // only admins change roles
```

| Role | Can |
| --- | --- |
| reader | Read posts, comment, edit own comments |
| author | Everything a reader can + write and manage own posts |
| admin | Everything, including others' content and roles |

**How does the first admin get created?** With a one-off script or directly in Atlas, never through a public route.

## 8. Ownership checks

Roles answer "what kind of user are you?". Ownership answers "is this **yours**?".

```js
export const update = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const isOwner = post.author.equals(req.user._id); // compare ObjectIds with .equals()
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only edit your own posts" });
  }

  const { title, body, tags, status } = req.body; // never accept author from the body
  Object.assign(post, { title, body, tags, status });
  res.json(await post.save());
};

export const create = async (req, res) => {
  const { title, body, tags, status } = req.body;
  const post = await Post.create({ title, body, tags, status, author: req.user._id });
  res.status(201).json(post);
};
```

**Insecure Direct Object Reference (IDOR)** is one of the most common API bugs: checking that a user is logged in, but not that the item belongs to them. Always check ownership.

## 9. Password reset flow

1. **Request:** `POST /api/auth/forgot { email }`. Always respond the same way: *"If that email is registered, we've sent a reset link."*
2. **Create a token:** a random string, stored **hashed** with a short expiry.

```js
import crypto from "node:crypto";

const token = crypto.randomBytes(32).toString("hex");
user.passwordResetHash = crypto.createHash("sha256").update(token).digest("hex");
user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
await user.save();
// email: `${CLIENT_URL}/reset-password?token=${token}`   (you'll send emails in Week 8)
```

3. **Reset:** `POST /api/auth/reset { token, password }`

```js
const hash = crypto.createHash("sha256").update(req.body.token).digest("hex");
const user = await User.findOne({
  passwordResetHash: hash,
  passwordResetExpires: { $gt: Date.now() },
});
if (!user) return res.status(400).json({ message: "Reset link is invalid or has expired" });

user.password = req.body.password; // hashed by the pre-save hook
user.passwordResetHash = undefined;
user.passwordResetExpires = undefined;
await user.save();
```

Store the reset token hashed for the same reason as passwords: if the database leaks, the tokens are useless.

## 10. Week 6 build: auth for your blog API

**Requirements**

1. User model with hashed passwords, `select: false` and roles.
2. `POST /register`, `POST /login`, `POST /logout`, `GET /me`.
3. JWT in an httpOnly cookie, plus `Authorization: Bearer` support.
4. `protect` and `allow(...roles)` middleware.
5. Post `author` and comment `author` come from `req.user`.
6. Only owners or admins can edit or delete posts and comments (403 otherwise).
7. An admin-only route to change a user's role.
8. Bonus: forgot and reset password routes (log the link to the console for now).

**Test plan in Thunder Client**

| Step | Expect |
| --- | --- |
| Register Ada | 201, cookie set |
| Create a post as Ada (reader) | 403 |
| Make Ada an author (via admin or Atlas), create a post | 201 |
| Register Ben, try to edit Ada's post | 403 |
| Log out, try to create a post | 401 |
| Log in with the wrong password | 401 |

Thunder Client keeps cookies between requests automatically.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish auth for your blog API.
2. Write the test plan above as a Thunder Client collection.
3. Push (no `.env`!) and submit on BlockHub.

**End-of-week checklist**

- [ ] Explain authentication vs authorization, 401 vs 403
- [ ] Hash passwords with bcrypt in a pre-save hook
- [ ] Explain the three parts of a JWT and why the payload isn't secret
- [ ] Sign and verify JWTs with an expiry
- [ ] Compare httpOnly cookies, headers and localStorage
- [ ] Write register, login, logout and me
- [ ] Protect routes and attach `req.user`
- [ ] Restrict routes by role and check ownership
- [ ] Describe a safe password reset flow

**Glossary**

| Term | Meaning |
| --- | --- |
| Authentication | Proving who a user is |
| Authorization | Deciding what a user may do |
| Hash | A one-way transformation of data |
| Salt | Random data added before hashing so equal inputs differ |
| bcrypt | A slow, salted hashing algorithm for passwords |
| JWT | A signed token carrying claims about a user |
| Claim | A piece of information in a JWT, like `sub` or `exp` |
| httpOnly cookie | A cookie JavaScript can't read |
| XSS | Cross-site scripting: injected scripts running on your site |
| CSRF | Cross-site request forgery: tricking a browser into sending a request |
| RBAC | Role-based access control |
| IDOR | Accessing someone else's data by changing an id |
| Account enumeration | Finding out which emails have accounts |
