## Before you start

Last week Node read and wrote files. This week it answers **HTTP requests**. You'll use **Express**, the most popular Node framework, to build a REST API that any website, app or phone can talk to. By the end you'll have a working **task manager API**.

**What you need**

- Node.js LTS and VS Code
- The **Thunder Client** extension in VS Code (or Postman)
- A new folder: `mkdir task-api && cd task-api && npm init -y`
- Packages: `npm install express cors` and add `"type": "module"` to `package.json`

## 1. HTTP requests and responses

Every time an app talks to a server, it sends a **request** and gets a **response**.

```text
POST /api/tasks HTTP/1.1                  ← method + path
Host: localhost:5000
Content-Type: application/json            ← headers
Authorization: Bearer eyJhbGci...

{ "title": "Read Express docs" }          ← body
```

```text
HTTP/1.1 201 Created                      ← status code
Content-Type: application/json

{ "id": 1, "title": "Read Express docs", "done": false }
```

| Part | Meaning |
| --- | --- |
| Method | What to do: GET, POST, PATCH, PUT, DELETE |
| Path | Which resource: `/api/tasks/1` |
| Headers | Extra information: content type, auth token, etc. |
| Body | The data (for POST, PATCH and PUT) |
| Status code | Did it work? 200, 201, 400, 404, 500… |

## 2. Your first Express server

```js
// server.js
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());          // allow browsers on other sites to call this API
app.use(express.json());  // turn JSON request bodies into req.body

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
```

Add a dev script to `package.json` and run it:

```json
"scripts": { "dev": "node --watch server.js", "start": "node server.js" }
```

```bash
npm run dev
```

Open `http://localhost:5000/api/health` in your browser.

**The response object**

| Method | What it does |
| --- | --- |
| `res.json(data)` | Send JSON (status 200 unless set) |
| `res.status(201).json(data)` | Set the status, then send |
| `res.status(204).end()` | Send no body (used after DELETE) |
| `res.send("text")` | Send text or HTML |
| `res.set("X-Header", "value")` | Set a response header |

## 3. REST and HTTP methods

**REST** is a set of conventions. Resources are **nouns** in the URL; the **method** is the verb.

| Method | URL | Action | Success |
| --- | --- | --- | --- |
| GET | `/api/tasks` | List tasks | 200 |
| GET | `/api/tasks/:id` | Get one task | 200 |
| POST | `/api/tasks` | Create a task | 201 |
| PATCH | `/api/tasks/:id` | Update some fields | 200 |
| PUT | `/api/tasks/:id` | Replace the whole task | 200 |
| DELETE | `/api/tasks/:id` | Delete a task | 204 |

**Good:** `DELETE /api/tasks/5` · **Avoid:** `POST /deleteTask?id=5`, `GET /getAllTasks`

**Conventions**

- Plural nouns: `/tasks`.
- Prefix with `/api` (and later a version: `/api/v1`).
- Nested resources when there's a clear owner: `/api/projects/3/tasks`.
- Always respond with JSON, errors included: `{ "message": "Task not found" }`.

**Idempotent** means doing it twice has the same effect as once. GET, PUT and DELETE are idempotent; POST isn't (two POSTs create two tasks).

## 4. Status codes

| Code | Name | Use it when |
| --- | --- | --- |
| 200 | OK | A normal successful response |
| 201 | Created | Something new was created (POST) |
| 204 | No Content | Success with nothing to return (DELETE) |
| 400 | Bad Request | The input is missing or invalid |
| 401 | Unauthorized | Not logged in (or bad token) |
| 403 | Forbidden | Logged in, but not allowed |
| 404 | Not Found | The resource or route doesn't exist |
| 409 | Conflict | Duplicate, e.g. email already registered |
| 422 | Unprocessable | Valid JSON, but fails business rules (some APIs use 400) |
| 429 | Too Many Requests | Rate limit hit |
| 500 | Server Error | Your code crashed or something unexpected happened |

**Rule of thumb:** 4xx = the client did something wrong; 5xx = the server did.

## 5. Route parameters, query strings and request bodies

| Where | Example | Read it with |
| --- | --- | --- |
| Route params | `GET /api/tasks/42` (route `/:id`) | `req.params.id` → `"42"` |
| Query string | `GET /api/tasks?done=true&q=read` | `req.query.done` → `"true"` |
| Body | `POST /api/tasks` with `{ "title": "..." }` | `req.body.title` |
| Headers | `Authorization: Bearer abc` | `req.headers.authorization` or `req.get("authorization")` |

**Params and query values are always strings.**

```js
const id = Number(req.params.id);       // "42" → 42
const done = req.query.done === "true"; // "true" → true
const page = Number(req.query.page) || 1;
```

`req.body` is `undefined` if you forgot `app.use(express.json())`, or if the client didn't send `Content-Type: application/json`.

## 6. Middleware

**Middleware** is a function `(req, res, next)` that runs before your route handler. It can:

- read or change `req` (e.g. attach `req.user`),
- send a response and stop (e.g. a 400 or 401),
- or call `next()` to continue.

```js
// runs for every request
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});
```

```js
// runs only on one route
const requireTitle = (req, res, next) => {
  if (!req.body.title?.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }
  next();
};

app.post("/api/tasks", requireTitle, createTask);
```

**Order matters.** `app.use(express.json())` must come before routes that read `req.body`. The 404 and error handlers come **last**.

**Common third-party middleware:** `cors` (cross-origin requests), `helmet` (security headers), `morgan` (request logging), `express-rate-limit`.

## 7. Routers and controllers

As the API grows, split it up:

```text
task-api/
  server.js              app setup, middleware, mounts routers
  routes/tasks.js        URL + method → controller function
  controllers/tasks.js   the logic for each route
```

**routes/tasks.js**

```js
import { Router } from "express";
import * as tasks from "../controllers/tasks.js";

const router = Router();

router.get("/", tasks.list);
router.get("/:id", tasks.getOne);
router.post("/", tasks.create);
router.patch("/:id", tasks.update);
router.delete("/:id", tasks.remove);

export default router;
```

**server.js**

```js
import tasksRouter from "./routes/tasks.js";

app.use("/api/tasks", tasksRouter); // every route above starts with /api/tasks
```

## 8. Error handling

**Expected errors** (bad input, not found): return the right 4xx in the controller.

**Unexpected errors:** let them reach one error handler at the end.

```js
// after all routers: unknown routes
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// error handler: must have FOUR parameters
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? "Something went wrong" : err.message,
  });
});
```

**Throwing your own errors** with a status:

```js
const error = new Error("Task not found");
error.status = 404;
throw error;
```

**Async errors:** Express 5 sends rejected promises from async handlers to the error handler automatically. In Express 4 you need `try/catch` and `next(err)`. Check which version you have in `package.json`.

**Never** send `err.stack` to clients: it reveals how your code works.

## 9. Testing APIs with Thunder Client

1. Install **Thunder Client** from the VS Code Extensions tab and click the ⚡ icon.
2. **New Request** → method and URL → **Send**.
3. For POST/PATCH: **Body → JSON**.
4. Check the status code, response body and time.
5. Save requests into a **Collection** so you can re-run them all with one click.

**Test the unhappy paths as much as the happy ones**

| Request | Expect |
| --- | --- |
| `POST /api/tasks` with `{}` | 400 |
| `GET /api/tasks/999` | 404 |
| `GET /api/nothing` | 404 |
| `PATCH /api/tasks/1` with `{ "done": "yes" }` | 400 (done must be true/false) |

**curl** works too, straight from the terminal:

```bash
curl -X POST http://localhost:5000/api/tasks -H "Content-Type: application/json" -d '{"title":"Learn curl"}'
```

## 10. Week 3 build: an in-memory task manager API

**controllers/tasks.js**

```js
let tasks = [];
let nextId = 1;

const findTask = (id) => tasks.find((t) => t.id === Number(id));

export const list = (req, res) => {
  const { done, q } = req.query;
  let result = tasks;
  if (done !== undefined) result = result.filter((t) => t.done === (done === "true"));
  if (q) result = result.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
  res.json(result);
};

export const getOne = (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json(task);
};

export const create = (req, res) => {
  const title = req.body.title?.trim();
  if (!title) return res.status(400).json({ message: "Title is required" });
  if (title.length > 200) return res.status(400).json({ message: "Title is too long" });

  const task = { id: nextId++, title, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  res.status(201).json(task);
};

export const update = (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const { title, done } = req.body;
  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: "Title can't be empty" });
    task.title = title.trim();
  }
  if (done !== undefined) {
    if (typeof done !== "boolean") return res.status(400).json({ message: "done must be true or false" });
    task.done = done;
  }
  res.json(task);
};

export const remove = (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  tasks = tasks.filter((t) => t !== task);
  res.status(204).end();
};
```

Notice the update only copies **allowed fields** (`title`, `done`). Never do `Object.assign(task, req.body)`: users could overwrite `id` or `createdAt`.

**Requirements**

1. All five routes, with routers and controllers.
2. `?done=` and `?q=` filters.
3. Logger middleware, 404 handler and error handler.
4. Validation with clear 400 messages.
5. A saved Thunder Client collection covering happy and unhappy paths.
6. README with an endpoints table.

**Remember:** data resets whenever the server restarts. That's next week's problem.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the task manager API.
2. Add a `GET /api/tasks/stats` route returning `{ total, done, pending }`. (Put it **before** `/:id`, or Express will treat "stats" as an id!)
3. Push to GitHub and submit the link on BlockHub.

**End-of-week checklist**

- [ ] Describe the parts of an HTTP request and response
- [ ] Create an Express server that returns JSON
- [ ] Design REST endpoints with the right methods
- [ ] Choose the right status code for each situation
- [ ] Read `req.params`, `req.query`, `req.body` and headers
- [ ] Write global and route-level middleware
- [ ] Organise code into routers and controllers
- [ ] Add 404 and error handlers
- [ ] Test every route, including failures, in Thunder Client

**Glossary**

| Term | Meaning |
| --- | --- |
| HTTP | The protocol browsers and apps use to talk to servers |
| Express | A minimal framework for building servers in Node |
| Endpoint | A method + URL, like `GET /api/tasks` |
| REST | Conventions for designing APIs around resources |
| Status code | A number saying how the request went |
| Middleware | A function that runs before a route handler |
| Router | A group of related routes |
| Controller | A function with the logic for a route |
| Idempotent | Doing it twice has the same effect as once |
| JSON | The text format APIs use to send data |
