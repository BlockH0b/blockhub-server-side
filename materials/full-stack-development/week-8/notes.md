## Before you start

Last week your API kept data in an array, so everything disappeared when the server restarted, and anyone could delete anything. This week you fix both: data goes into **MongoDB**, and users **sign up and log in** so only the right people can change things.

**What you need**

- Your Week 7 API
- A free MongoDB Atlas account (mongodb.com/atlas)
- Packages: `npm install mongoose bcryptjs jsonwebtoken dotenv helmet express-rate-limit`

## 1. Databases and MongoDB

A **database** stores data permanently, so it survives restarts and can be shared by many users.

**MongoDB** is a *document* database. It stores data as JSON-like objects, which feels natural for JavaScript developers.

| MongoDB | Like in a spreadsheet | Example |
| --- | --- | --- |
| Database | The whole file | `jobboard` |
| Collection | One sheet | `jobs`, `users` |
| Document | One row | `{ _id: "...", title: "Dev", company: "BlockHub" }` |
| Field | One column | `title` |

Every document gets a unique `_id` automatically.

## 2. Setting up MongoDB Atlas

Atlas is MongoDB in the cloud, with a free tier.

1. Sign up at mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** → add a database user with a username and password. (Avoid symbols like `@` in the password; they break the connection string.)
3. **Network Access** → add your current IP address. For class you can use `0.0.0.0/0` (anywhere), but tighten it for real apps.
4. **Connect → Drivers** → copy the connection string:

```text
mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/jobboard
```

Replace `<username>` and `<password>`, and add the database name (`jobboard`) before any `?`.

## 3. Environment variables

**Never put secrets in your code.** Anyone who sees your GitHub repo would see them. Put them in a `.env` file instead:

```bash
# .env
PORT=5000
MONGO_URI=mongodb+srv://daniel:mypassword@cluster0.abcde.mongodb.net/jobboard
JWT_SECRET=change-this-to-a-long-random-string
```

Load them at the very top of `server.js`:

```js
import "dotenv/config";

console.log(process.env.PORT); // "5000"
```

**Rules**

- `.env` goes in `.gitignore`. Always.
- Commit a `.env.example` with the names but **no real values**, so others know what to set.
- If you ever push a secret by accident, change it immediately. Deleting the commit isn't enough.

## 4. Connecting with Mongoose and defining models

**Mongoose** makes MongoDB easier: it gives you schemas (rules for your data) and models (objects you query with).

**Connect** (in `server.js`, before `app.listen`):

```js
import mongoose from "mongoose";

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
  app.listen(process.env.PORT, () => console.log("Server running"));
} catch (err) {
  console.error("Could not connect to MongoDB", err.message);
  process.exit(1);
}
```

**A model** (`models/Job.js`):

```js
import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },
    company: { type: String, required: true },
    location: { type: String, default: "Remote" },
    salary: { type: Number, min: 0 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

export default mongoose.model("Job", jobSchema); // collection: "jobs"
```

| Option | Meaning |
| --- | --- |
| `type` | String, Number, Boolean, Date, ObjectId, arrays… |
| `required` | Must be present (with an optional error message) |
| `default` | Value used if none is given |
| `trim` | Removes spaces at the start and end |
| `unique` | No two documents can share this value (creates an index) |
| `min` / `max`, `enum` | Allowed numbers or a fixed list of values |
| `ref` | Which model an ObjectId points to |

## 5. CRUD with Mongoose

Every Mongoose call returns a Promise, so use `async/await`.

```js
import Job from "../models/Job.js";

export const list = async (req, res) => {
  const { q, location } = req.query;
  const filter = {};
  if (q) filter.title = { $regex: q, $options: "i" }; // case-insensitive search
  if (location) filter.location = location;

  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json(jobs);
};

export const getOne = async (req, res) => {
  const job = await Job.findById(req.params.id).populate("owner", "name");
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json(job);
};

export const create = async (req, res) => {
  const { title, company, location, salary } = req.body;
  const job = await Job.create({ title, company, location, salary, owner: req.user.id });
  res.status(201).json(job);
};
```

| Task | Mongoose |
| --- | --- |
| Find many | `Job.find({ location: "Lagos" })` |
| Find one | `Job.findOne({ email })` / `Job.findById(id)` |
| Create | `Job.create({...})` |
| Update | `Job.findByIdAndUpdate(id, changes, { new: true, runValidators: true })` |
| Delete | `Job.findByIdAndDelete(id)` |
| Count | `Job.countDocuments(filter)` |

**Two common errors**

- **ValidationError** (missing required field) → return 400 with the message.
- **CastError** (`/api/jobs/abc` isn't a valid id) → return 404 or 400.

Handle both in your error middleware:

```js
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  if (err.name === "CastError") return res.status(404).json({ message: "Not found" });
  if (err.code === 11000) return res.status(409).json({ message: "That value is already taken" });
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});
```

## 6. Hashing passwords with bcrypt

**Never store plain passwords.** If your database leaks, every user's password leaks too (and people reuse passwords).

A **hash** is a one-way scramble: you can't turn it back into the password, but you can check whether a password matches it.

```js
import bcrypt from "bcryptjs";

const hash = await bcrypt.hash("secret123", 10); // 10 = how much work (salt rounds)
// "$2a$10$Xk9..." — safe to store

await bcrypt.compare("secret123", hash); // true
await bcrypt.compare("wrong", hash);     // false
```

**User model** (`models/User.js`):

```js
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
```

`select: false` means the password is **not** returned by queries unless you ask for it with `.select("+password")`.

## 7. Sign-up and login with JWT

A **JSON Web Token (JWT)** is a signed string that proves who someone is. After login, the client stores it and sends it with each request.

```text
eyJhbGciOi...   .   eyJpZCI6IjY1...   .   SflKxwRJSM...
   header             payload (id)          signature
```

**Anyone can read the payload**, so never put passwords or secrets in it. The **signature** (made with your `JWT_SECRET`) proves the server created it and nobody changed it.

**controllers/auth.js**

```js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ message: "Name, email and an 8+ character password are required" });
  }
  if (await User.findOne({ email })) {
    return res.status(409).json({ message: "Email already registered" });
  }
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user), user: { id: user._id, name, email } });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Wrong email or password" });
  }
  res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email } });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user);
};
```

**Why the same message for a wrong email and a wrong password?** So attackers can't find out which emails are registered.

## 8. Protecting routes

**middleware/auth.js**

```js
import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (!token) return res.status(401).json({ message: "Please log in" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, iat, exp }
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
};
```

**Use it**

```js
// routes/auth.js
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);

// routes/jobs.js
router.get("/", jobs.list);                 // public
router.get("/:id", jobs.getOne);            // public
router.post("/", protect, jobs.create);     // logged in
router.patch("/:id", protect, jobs.update); // logged in + owner
router.delete("/:id", protect, jobs.remove);
```

**Authentication vs authorization**

| | Question | Status if it fails |
| --- | --- | --- |
| Authentication | *Who are you?* (valid token) | 401 |
| Authorization | *Are you allowed?* (owner, admin) | 403 |

**Ownership check**

```js
export const update = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found" });
  if (job.owner.toString() !== req.user.id) {
    return res.status(403).json({ message: "You can only edit your own job posts" });
  }
  const { title, company, location, salary } = req.body; // only allowed fields
  Object.assign(job, { title, company, location, salary });
  await job.save();
  res.json(job);
};
```

**Testing in Thunder Client:** log in, copy the `token`, then on protected requests go to **Auth → Bearer** and paste it.

## 9. API security basics

```js
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

app.use(helmet()); // safer HTTP headers
app.use(cors({ origin: ["http://localhost:5173", "https://myjobboard.netlify.app"] }));
app.use(express.json({ limit: "100kb" })); // reject huge bodies

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/auth", authLimiter); // stop password guessing
```

**Security checklist**

- [ ] Passwords hashed with bcrypt, never returned in responses
- [ ] Secrets in `.env`, `.env` in `.gitignore`
- [ ] Protected routes check the token; edits check ownership
- [ ] Only pick allowed fields from `req.body` (never `Job.create(req.body)` with an `owner` field from the user)
- [ ] Rate limit on login and register
- [ ] CORS limited to your frontend's URL in production
- [ ] Error messages don't reveal stack traces

## 10. Week 8 build: a secure API with real users

Upgrade your Week 7 API:

1. Connect to MongoDB Atlas with Mongoose; secrets in `.env`.
2. A `Job` (or your resource) model with validation and `timestamps`.
3. A `User` model; `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
4. Passwords hashed with bcrypt.
5. `protect` middleware on create, update and delete.
6. Ownership checks: 403 if a user edits someone else's item.
7. Error middleware for ValidationError, CastError and duplicate keys.
8. `helmet`, CORS and a rate limit on auth routes.
9. A Thunder Client collection testing: register → login → create → edit someone else's (expect 403).
10. A README with every endpoint and which ones need a token, plus a `.env.example`.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the secure API above.
2. Push to GitHub. Double-check that `.env` is **not** in the repo.
3. Submit the link on BlockHub.

**End-of-week checklist**

- [ ] Explain databases, collections and documents
- [ ] Create an Atlas cluster and connect with Mongoose
- [ ] Define a schema with validation and do CRUD with a model
- [ ] Hash and compare passwords with bcrypt
- [ ] Build register and login routes that return a JWT
- [ ] Protect routes with middleware and check ownership
- [ ] Explain the difference between 401 and 403
- [ ] Keep secrets in `.env` and add helmet, CORS and rate limiting

**Glossary**

| Term | Meaning |
| --- | --- |
| MongoDB | A document database that stores JSON-like data |
| Atlas | MongoDB's cloud hosting service |
| Mongoose | A library for defining models and querying MongoDB from Node |
| Schema | The shape and rules of a document |
| Model | The object you use to query a collection |
| ObjectId | MongoDB's unique id type |
| Hash | A one-way scramble of a password |
| JWT | A signed token that proves who a user is |
| Authentication | Checking who someone is |
| Authorization | Checking what someone is allowed to do |
| Environment variable | A setting or secret stored outside your code |
| Rate limiting | Limiting how many requests one client can make |
