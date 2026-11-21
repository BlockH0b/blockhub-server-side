## Before you start

Last week you stored one kind of thing (tasks) in MongoDB. Real apps have many kinds of things that **connect**: users write posts, posts have comments, comments have authors. This week you learn to **model related data** and write the queries real APIs need: pagination, search, populate and aggregation. You'll build a **blog API**.

**What you need**

- Your Week 4 setup (Atlas, Mongoose, `.env`)
- A new project: `blog-api` with `express` and `mongoose`

## 1. Designing data models

Don't start with code. Start with what the app **shows** and **asks for**.

1. **List the nouns.** Blog: User, Post, Comment, (Tag).
2. **Draw the relationships.** A user writes many posts. A post has many comments. A comment is written by one user.
3. **List the common queries.** "Latest published posts with the author's name, 10 per page." "All comments for a post." "Posts with tag `node`."
4. **Pick fields and rules.** Types, `required`, `unique`, defaults, indexes.

```text
User 1 ──── * Post 1 ──── * Comment
  │                           │
  └────────── 1 ─────────── * ┘ (comment.author)
```

**MongoDB tip:** design for how data is **read**. The most common screens should need as few queries as possible.

## 2. Relationships

| Type | Example | Usual MongoDB approach |
| --- | --- | --- |
| One-to-one | User → Profile | Embed the profile in the user |
| One-to-few | Post → a few tags | Embed an array |
| One-to-many | User → Posts | Reference: `post.author = userId` |
| One-to-huge | Post → thousands of comments | Reference from the child: `comment.post = postId` |
| Many-to-many | Students ↔ Courses | Array of ids on one or both sides, or a join collection (`Enrollment`) |

## 3. Embedding vs referencing

**Embedding** stores related data inside the document.

```js
// Post with embedded tags and a small author snapshot
{
  title: "Intro to Express",
  tags: ["node", "express"],
  author: { _id: "675a...", name: "Ada" }
}
```

**Referencing** stores only the id and looks the rest up when needed.

```js
{
  title: "Intro to Express",
  author: ObjectId("675a...")
}
```

| | Embed | Reference |
| --- | --- | --- |
| Reads | One query, very fast | Needs `populate()` or `$lookup` |
| Updates | Copies can go stale (author renames) | One source of truth |
| Size | Document limit is 16 MB | No limit concerns |
| Best for | Small data that belongs to the parent and is read with it | Data that grows, is shared, or changes independently |

**Rule of thumb:** embed things that are small and always read together; reference things that grow without limit (comments) or have their own life (users).

## 4. Building the blog models

**models/User.js**

```js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    bio: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
```

**models/Post.js**

```js
import mongoose from "mongoose";
const { Schema } = mongoose;

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true },
    body: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tags: [{ type: String, lowercase: true, trim: true }],
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ title: "text", body: "text" });

export default mongoose.model("Post", postSchema);
```

**models/Comment.js**

```js
const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
```

Comments reference the post (not the other way round) because a post can have thousands of comments.

## 5. populate()

`populate()` replaces an id with the document it points to.

```js
const post = await Post.findById(id).populate("author", "name bio");
```

```js
// without populate
{ "title": "Hello", "author": "675a1b..." }

// with populate
{ "title": "Hello", "author": { "_id": "675a1b...", "name": "Ada", "bio": "..." } }
```

**More options**

```js
// several paths
Post.find().populate("author", "name").populate("category", "name");

// nested: comments → author
Comment.find({ post: id }).populate({ path: "author", select: "name" });
```

**Be careful:** each populate is an extra query. Populate only the fields you need, and avoid populating inside loops.

**Virtual populate:** show a post's comments without storing comment ids on the post.

```js
postSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
});

await Post.findById(id).populate("comments");
```

## 6. Pagination and sorting

Never return a whole collection. With 50,000 posts, your API (and the user's phone) would crash.

**A reusable helper** (`utils/paging.js`):

```js
export function paging(query, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
```

**Sorting**

```js
Post.find().sort({ createdAt: -1 });     // newest first
Post.find().sort("-likes title");        // string form: most liked, then A–Z
```

Only allow known sort values from users:

```js
const SORTS = { newest: "-createdAt", oldest: "createdAt", popular: "-likes" };
const sort = SORTS[req.query.sort] || SORTS.newest;
```

**Response shape**

```json
{
  "items": [ ... ],
  "page": 2,
  "limit": 10,
  "total": 87,
  "pages": 9
}
```

**Skip vs cursor pagination:** `skip` gets slower on very deep pages. Large feeds use a **cursor** instead: `?after=<lastCreatedAt>` with `find({ createdAt: { $lt: after } })`. Skip is fine for most apps.

## 7. Search and filtering

```js
const filter = { status: "published" };
if (req.query.tag) filter.tags = req.query.tag.toLowerCase();    // matches inside arrays
if (req.query.author) filter.author = req.query.author;
if (req.query.from) filter.createdAt = { $gte: new Date(req.query.from) };
```

**Two ways to search**

| | `$regex` | `$text` |
| --- | --- | --- |
| Setup | None | A text index on the fields |
| Matches | Any part of a word (`"exp"` → "Express") | Whole words, with stemming ("running" → "run") |
| Speed on big data | Slow (no index for "contains") | Fast |
| Example | `{ title: { $regex: q, $options: "i" } }` | `{ $text: { $search: q } }` |

**Escape user input in regex** so characters like `(` or `.` don't break it:

```js
const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
```

## 8. Indexes

Without an index, MongoDB reads **every document** to answer a query (a "collection scan"). An index is like the index at the back of a book.

```js
postSchema.index({ tags: 1 });                     // filter by tag
postSchema.index({ status: 1, createdAt: -1 });    // compound: filter + sort
postSchema.index({ title: "text", body: "text" }); // keyword search
userSchema.index({ email: 1 }, { unique: true });  // same as unique: true on the field
```

**Check a query**

```js
const stats = await Post.find({ tags: "node" }).explain("executionStats");
// look for "IXSCAN" (good) instead of "COLLSCAN" (reads everything)
```

**Guidelines**

- Index fields you filter, sort or look up by often.
- A compound index `{ status: 1, createdAt: -1 }` helps queries that filter by status **and** sort by date.
- Every index slows writes slightly and uses storage. Don't index everything.

## 9. Aggregation pipelines

Aggregation transforms data through **stages**, like an assembly line. Use it for stats, reports and dashboards.

| Stage | Does |
| --- | --- |
| `$match` | Filter (like `find`) |
| `$group` | Group and calculate: `$sum`, `$avg`, `$max` |
| `$sort`, `$limit`, `$skip` | Order and trim |
| `$project` | Choose or compute fields |
| `$unwind` | One document per array item |
| `$lookup` | Join another collection |

**Top tags**

```js
const topTags = await Post.aggregate([
  { $match: { status: "published" } },
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 },
]);
```

**Posts and likes per author, with the author's name**

```js
const authors = await Post.aggregate([
  { $match: { status: "published" } },
  { $group: { _id: "$author", posts: { $sum: 1 }, likes: { $sum: "$likes" } } },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "author" } },
  { $unwind: "$author" },
  { $project: { _id: 0, name: "$author.name", posts: 1, likes: 1 } },
  { $sort: { posts: -1 } },
]);
```

**Note:** `aggregate()` doesn't convert strings to ObjectIds for you. Use `new mongoose.Types.ObjectId(id)` in `$match`.

## 10. Virtuals and hooks

**Virtuals** are computed fields, not stored in the database:

```js
postSchema.virtual("readingTime").get(function () {
  const words = this.body.split(/\s+/).length;
  return `${Math.ceil(words / 200)} min read`;
});
```

Add `toJSON: { virtuals: true }` to the schema options so virtuals appear in API responses.

**Hooks (middleware)** run before or after events like save or delete:

```js
// create a slug from the title before validation
postSchema.pre("validate", function () {
  if (this.isModified("title")) {
    this.slug =
      this.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
      "-" + Date.now().toString(36);
  }
});
```

```js
// delete a post's comments when the post is deleted
postSchema.post("findOneAndDelete", async function (doc) {
  if (doc) await mongoose.model("Comment").deleteMany({ post: doc._id });
});
```

Use a regular `function`, not an arrow function, so `this` is the document. `save` and `validate` hooks **don't run** for `updateOne`, `updateMany` or `findByIdAndUpdate`; those trigger *query* hooks instead. Check the Mongoose docs for which hooks each method triggers.

## 11. Week 5 build: a blog API

**Endpoints**

| Method | URL | Description |
| --- | --- | --- |
| POST | `/api/users` | Create a user |
| GET | `/api/users/:id` | Get a user and their post count |
| GET | `/api/posts?page=&limit=&tag=&author=&q=&sort=` | Paginated published posts |
| GET | `/api/posts/:slug` | One post with author populated |
| POST | `/api/posts` | Create a post (`author` id in the body for now) |
| PATCH | `/api/posts/:id` | Update a post |
| DELETE | `/api/posts/:id` | Delete a post and its comments |
| GET | `/api/posts/:id/comments` | Comments with author names |
| POST | `/api/posts/:id/comments` | Add a comment |
| GET | `/api/stats` | Top tags and top authors (aggregation) |

**controllers/posts.js (list)**

```js
import Post from "../models/Post.js";
import { paging } from "../utils/paging.js";

const SORTS = { newest: "-createdAt", oldest: "createdAt", popular: "-likes" };

export const list = async (req, res) => {
  const { tag, author, q, sort } = req.query;
  const filter = { status: "published" };
  if (tag) filter.tags = tag.toLowerCase();
  if (author) filter.author = author;
  if (q) filter.$text = { $search: q };

  const { page, limit, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    Post.find(filter)
      .populate("author", "name")
      .select("-body") // lists don't need the full text
      .sort(SORTS[sort] || SORTS.newest)
      .skip(skip)
      .limit(limit),
    Post.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
};
```

**Seed some data:** write a `seed.js` script that creates 3 users and 30 posts, so you can test pagination.

```bash
node --env-file=.env seed.js
```

## 12. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the blog API with all the endpoints above.
2. Add indexes and confirm with `.explain()` that the tag filter uses one.
3. Push to GitHub and submit on BlockHub.

**End-of-week checklist**

- [ ] Design models from screens and queries
- [ ] Model one-to-one, one-to-many and many-to-many relationships
- [ ] Decide when to embed and when to reference
- [ ] Use `populate()` with selected fields
- [ ] Paginate with page, limit, total and pages
- [ ] Filter, sort safely and search with `$regex` or `$text`
- [ ] Add indexes and check them with `explain()`
- [ ] Write aggregation pipelines with `$match`, `$group` and `$lookup`
- [ ] Use virtuals and pre/post hooks

**Glossary**

| Term | Meaning |
| --- | --- |
| Data model | How your data is structured and connected |
| Relationship | How two kinds of data are linked |
| Embedding | Storing related data inside a document |
| Referencing | Storing the id of a related document |
| populate | Mongoose's way to replace ids with documents |
| Pagination | Returning results one page at a time |
| Index | A structure that makes queries fast |
| Collection scan | Reading every document to answer a query (slow) |
| Aggregation | Processing data through stages to calculate results |
| `$lookup` | An aggregation stage that joins another collection |
| Virtual | A computed field that isn't stored |
| Hook | Code that runs before or after a model event |
| Slug | A URL-friendly version of a title |
