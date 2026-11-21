## Before you start

Your Week 3 task API keeps tasks in an array. Restart the server and they're gone. This week you connect it to a real database, **MongoDB**, using **Mongoose**. By the end your data survives restarts and you can search and filter it properly.

**What you need**

- Your Week 3 task API
- A free MongoDB Atlas account (mongodb.com/atlas)
- `npm install mongoose`

## 1. Why apps need databases

| Problem with arrays or files | What a database gives you |
| --- | --- |
| Data disappears when the server restarts | Data is stored permanently |
| Two servers can't share an array | Many servers can share one database |
| Searching a big file is slow | Indexes make searches fast |
| Two writes at once can corrupt a file | Safe concurrent reads and writes |
| No rules about the data | Validation and unique constraints |
| Hard to back up | Built-in backups (Atlas) |

## 2. SQL vs NoSQL

| | SQL (relational) | NoSQL (document) |
| --- | --- | --- |
| Examples | PostgreSQL, MySQL, SQLite | MongoDB, Firestore |
| Data is stored in | Tables with fixed columns | Flexible JSON-like documents |
| Structure | Strict schema, decided up front | Flexible (Mongoose adds rules) |
| Relationships | Joins between tables | Embedding or references (Week 5) |
| Query language | SQL: `SELECT * FROM tasks WHERE done = false` | JavaScript objects: `Task.find({ done: false })` |
| Great for | Finance, complex relationships, reports | Fast development, changing data, JS apps |

Neither is "better". Many companies use both. We use MongoDB because it fits naturally with JavaScript and JSON.

## 3. MongoDB concepts

| MongoDB | SQL equivalent | Example |
| --- | --- | --- |
| Database | Database | `taskdb` |
| Collection | Table | `tasks`, `users` |
| Document | Row | One task |
| Field | Column | `title` |
| `_id` | Primary key | `ObjectId("6750a1f2...")` |

A document:

```js
{
  _id: ObjectId("6750a1f2c3d4e5f6a7b8c9d0"),
  title: "Learn MongoDB",
  done: false,
  tags: ["backend", "week4"],          // arrays are fine
  owner: { name: "Ada", level: 2 },    // so are nested objects
  createdAt: ISODate("2026-11-21T10:00:00Z")
}
```

MongoDB stores documents as **BSON** (binary JSON), which adds types like `ObjectId` and `Date`.

**ObjectId:** a unique 24-character hex id that also contains the time it was created.

## 4. Setting up MongoDB Atlas

1. Sign up at mongodb.com/atlas and create a free **M0** cluster (choose a region close to you).
2. **Database Access → Add New Database User.** Use a password without `@`, `:` or `/` (those break the connection string), or URL-encode it.
3. **Network Access → Add IP Address.** Add your current IP. For class (and for Render later) you can allow `0.0.0.0/0`.
4. **Connect → Drivers** → copy the connection string:

```text
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

5. Put your password in and add a **database name** before the `?`:

```text
mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/taskdb?retryWrites=true&w=majority
```

**Browse your data:** Atlas → **Browse Collections**, or install **MongoDB Compass** (desktop app) or the **MongoDB for VS Code** extension.

## 5. Environment variables

The connection string contains your password. **It must never be in your code or on GitHub.**

```bash
# .env
PORT=5000
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/taskdb
```

```text
# .gitignore
node_modules
.env
```

```bash
# .env.example (commit this one)
PORT=5000
MONGO_URI=
```

**Loading `.env`**: two options.

```json
// Option A (Node 20.6+): no package needed
"scripts": {
  "dev": "node --watch --env-file=.env server.js",
  "start": "node server.js"
}
```

```js
// Option B: the dotenv package (npm install dotenv), first line of server.js
import "dotenv/config";
```

In production (Render, etc.) you set the variables in the host's dashboard instead of a `.env` file.

**If a secret is ever pushed to GitHub, change it immediately.** It's in the history even if you delete the file.

## 6. Connecting with Mongoose

**Mongoose** sits between Express and MongoDB. It adds schemas, validation and an easy query API.

```js
// server.js
import express from "express";
import mongoose from "mongoose";
import tasksRouter from "./routes/tasks.js";

const app = express();
app.use(express.json());
app.use("/api/tasks", tasksRouter);
// ... 404 and error handlers

const PORT = process.env.PORT || 5000;

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
} catch (err) {
  console.error("❌ MongoDB connection failed:", err.message);
  process.exit(1);
}
```

**Connection problems?**

| Error | Usual cause |
| --- | --- |
| `MongoServerSelectionError` / timeout | Your IP isn't in Network Access |
| `bad auth : authentication failed` | Wrong username or password |
| `MONGO_URI is undefined` | `.env` not loaded or misspelled |
| `querySrv ENOTFOUND` | Typo in the cluster address, or no internet |

## 7. Schemas and models

```js
// models/Task.js
import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be 200 characters or fewer"],
    },
    done: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: Date,
    tags: [String],
  },
  { timestamps: true } // createdAt and updatedAt, managed for you
);

export default mongoose.model("Task", taskSchema); // collection name: "tasks"
```

**Schema types:** `String`, `Number`, `Boolean`, `Date`, `[String]` (array), `mongoose.Schema.Types.ObjectId`, nested objects.

**Validators**

| Option | Applies to | Example |
| --- | --- | --- |
| `required` | any | `required: [true, "Title is required"]` |
| `default` | any | `default: false` |
| `unique` | any | `unique: true` (creates an index; not a validator) |
| `trim`, `lowercase`, `uppercase` | String | `lowercase: true` for emails |
| `minlength`, `maxlength`, `match` | String | `match: /^\S+@\S+\.\S+$/` |
| `enum` | String | `enum: ["low", "medium", "high"]` |
| `min`, `max` | Number, Date | `min: 0` |

## 8. CRUD with Mongoose

| Operation | Mongoose |
| --- | --- |
| Create | `Task.create({ title })` |
| Read many | `Task.find(filter)` |
| Read one | `Task.findById(id)` / `Task.findOne({ title })` |
| Update | `Task.findByIdAndUpdate(id, changes, { new: true, runValidators: true })` |
| Delete | `Task.findByIdAndDelete(id)` |
| Count | `Task.countDocuments(filter)` |
| Exists | `Task.exists({ title })` |

- `{ new: true }` returns the document **after** the update (default is before).
- `{ runValidators: true }` checks schema rules on updates too (off by default!).

**Query helpers you can chain**

```js
await Task.find({ done: false })
  .sort({ dueDate: 1, createdAt: -1 }) // 1 = ascending, -1 = descending
  .select("title priority dueDate")    // only these fields
  .skip(20)
  .limit(10);
```

**Query operators**

| Operator | Meaning | Example |
| --- | --- | --- |
| `$eq`, `$ne` | equal, not equal | `{ priority: { $ne: "low" } }` |
| `$gt`, `$gte`, `$lt`, `$lte` | greater / less than | `{ dueDate: { $lt: new Date() } }` |
| `$in`, `$nin` | in / not in a list | `{ priority: { $in: ["high", "medium"] } }` |
| `$regex` | pattern match | `{ title: { $regex: "mongo", $options: "i" } }` |
| `$or`, `$and` | combine conditions | `{ $or: [{ done: true }, { priority: "low" }] }` |
| `$exists` | field present or not | `{ dueDate: { $exists: true } }` |

**Updates with operators**

```js
await Task.updateMany({ dueDate: { $lt: new Date() } }, { $set: { priority: "high" } });
await Task.findByIdAndUpdate(id, { $push: { tags: "urgent" } });
await Task.findByIdAndUpdate(id, { $inc: { views: 1 } });
```

## 9. Validation and error handling

Mongoose throws specific errors. Map them to status codes in your error handler:

```js
app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: "Validation failed", errors });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `${field} already exists` });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});
```

**Check ids early** to give a clean 404 instead of a CastError:

```js
if (!mongoose.isValidObjectId(req.params.id)) {
  return res.status(404).json({ message: "Task not found" });
}
```

## 10. Week 4 build: your task API on MongoDB

**controllers/tasks.js**

```js
import mongoose from "mongoose";
import Task from "../models/Task.js";

const notFound = (res) => res.status(404).json({ message: "Task not found" });

export const list = async (req, res) => {
  const { done, q, priority, overdue } = req.query;
  const filter = {};
  if (done !== undefined) filter.done = done === "true";
  if (priority) filter.priority = priority;
  if (q) filter.title = { $regex: q, $options: "i" };
  if (overdue === "true") {
    filter.dueDate = { $lt: new Date() };
    filter.done = false;
  }
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.json(tasks);
};

export const getOne = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const task = await Task.findById(req.params.id);
  if (!task) return notFound(res);
  res.json(task);
};

export const create = async (req, res) => {
  const { title, priority, dueDate, tags } = req.body; // only allowed fields
  const task = await Task.create({ title, priority, dueDate, tags });
  res.status(201).json(task);
};

export const update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const { title, done, priority, dueDate, tags } = req.body;
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { title, done, priority, dueDate, tags }, // undefined fields are ignored
    { new: true, runValidators: true }
  );
  if (!task) return notFound(res);
  res.json(task);
};

export const remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) return notFound(res);
  res.status(204).end();
};
```

**Note:** tasks now have `_id` (a string like `"6750a1f2..."`), not a number `id`.

**Requirements**

1. Connect to Atlas with the URI in `.env`; `.env.example` committed; `.env` ignored.
2. A `Task` model with validation, `priority`, `dueDate` and timestamps.
3. All CRUD routes rewritten with Mongoose.
4. Filters: `done`, `priority`, `q` and `overdue`.
5. Error handler for ValidationError, CastError and duplicates.
6. Restart the server and confirm the data is still there.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the MongoDB task API.
2. Update `GET /api/tasks/stats` to use `countDocuments` for `total`, `done`, `pending` and `overdue`.
3. Push to GitHub (check `.env` is **not** there) and submit on BlockHub.

**End-of-week checklist**

- [ ] Explain why apps need databases
- [ ] Compare SQL and NoSQL databases
- [ ] Describe databases, collections, documents and `_id`
- [ ] Create an Atlas cluster, user and network rule
- [ ] Keep secrets in `.env` and load them
- [ ] Connect with Mongoose before starting the server
- [ ] Define a schema with validators and timestamps
- [ ] Create, read, update and delete with a model
- [ ] Filter with query operators, sort, select and limit
- [ ] Turn Mongoose errors into 400, 404 and 409 responses

**Glossary**

| Term | Meaning |
| --- | --- |
| Database | Software that stores data permanently and safely |
| SQL | Relational databases with tables, and the language to query them |
| NoSQL | Databases that don't use tables, like MongoDB |
| Collection | A group of documents in MongoDB |
| Document | One record, stored like a JSON object |
| BSON | Binary JSON, how MongoDB stores documents |
| ObjectId | MongoDB's unique id type |
| Atlas | MongoDB's cloud service |
| ODM | Object Document Mapper, like Mongoose |
| Schema | The shape and rules of a document |
| Model | The object you use to query a collection |
| Connection string | The URL (with credentials) used to connect to a database |
