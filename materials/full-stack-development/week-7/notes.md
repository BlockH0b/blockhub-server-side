## Before you start

Until now, your React apps have used other people's APIs. This week you build **your own API** with Node.js and Express: the server your frontend talks to. By the end you'll have a working REST API with full create, read, update and delete (CRUD) routes.

**What you need**

- Node.js LTS (`node -v`)
- VS Code with the **Thunder Client** extension (or Postman)
- Your JavaScript skills from Weeks 2 and 5, especially arrays, objects and `async/await`

## 1. How servers and the client–server model work

| Part | What it does | Example |
| --- | --- | --- |
| **Client** | Shows the UI and sends requests | Your React app in the browser |
| **Server** | Receives requests, checks them, runs logic, sends responses | Node.js + Express |
| **Database** | Stores data permanently | MongoDB (next week) |

**The flow when a user adds a job**

1. The user fills in a form in React and clicks Save.
2. React sends `POST /api/jobs` with the job as JSON.
3. Express receives it, checks the data is valid and saves it.
4. Express replies `201 Created` with the new job.
5. React adds the job to the list on screen.

**Why not do everything in the browser?** Anything in the browser can be seen and changed by users. Secrets (database passwords, payment keys) and rules (who can delete what) must live on the server.

## 2. Setting up Node.js and npm

**Node.js** runs JavaScript outside the browser, on your computer or a server. **npm** installs packages (code other people wrote) into your project.

```bash
mkdir jobs-api
cd jobs-api
npm init -y                     # creates package.json
npm install express cors        # packages your app needs
npm install --save-dev nodemon  # restarts the server when you save
```

**package.json**: add `"type": "module"` (so you can use `import`) and two scripts:

```json
{
  "name": "jobs-api",
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

Run `npm run dev` while developing.

**`node_modules`** holds installed packages. Never commit it. Add a `.gitignore`:

```text
node_modules
.env
```

Anyone can recreate `node_modules` by running `npm install`.

## 3. Creating a server with Express

**Express** is the most popular Node.js framework for building APIs.

```js
// server.js
import express from "express";

const app = express();
app.use(express.json()); // lets Express read JSON request bodies

app.get("/", (req, res) => {
  res.json({ message: "Jobs API is running 🚀" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Run `npm run dev` and open `http://localhost:5000`. You'll see the JSON.

| Piece | Meaning |
| --- | --- |
| `app.get(path, handler)` | Run `handler` for GET requests to `path` |
| `req` | The incoming request: body, params, query, headers |
| `res` | The response you send back |
| `res.json(data)` | Send JSON (with status 200 by default) |
| `res.status(201).json(data)` | Send JSON with a specific status code |

## 4. REST API design and HTTP methods

**REST** is a set of conventions for designing APIs. Resources are **nouns** in the URL; the HTTP **method** says what to do.

| Method | URL | Action | Success status |
| --- | --- | --- | --- |
| GET | `/api/jobs` | List all jobs | 200 |
| GET | `/api/jobs/:id` | Get one job | 200 (404 if missing) |
| POST | `/api/jobs` | Create a job | 201 |
| PATCH | `/api/jobs/:id` | Update some fields | 200 |
| PUT | `/api/jobs/:id` | Replace the whole job | 200 |
| DELETE | `/api/jobs/:id` | Delete a job | 204 |

**Good:** `GET /api/jobs/42` · **Not REST-y:** `GET /getJobById?id=42`, `POST /deleteJob`

**Conventions**

- Use plural nouns: `/jobs`, not `/job`.
- Start with `/api` so it's clear which routes are the API.
- Always return JSON, including for errors: `{ "message": "Job not found" }`.

## 5. Organising routes and controllers

Putting every route in `server.js` gets messy. Split them:

```text
jobs-api/
  server.js            creates the app, middleware, mounts routes
  routes/
    jobs.js            which URL goes to which function
  controllers/
    jobs.js            what each route actually does
```

**controllers/jobs.js**

```js
let jobs = [
  { id: 1, title: "Frontend Developer", company: "BlockHub", location: "Remote" },
];

export const list = (req, res) => {
  res.json(jobs);
};

export const getOne = (req, res) => {
  const job = jobs.find((j) => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json(job);
};

export const create = (req, res) => {
  const { title, company, location } = req.body;
  if (!title || !company) {
    return res.status(400).json({ message: "Title and company are required" });
  }
  const job = { id: Date.now(), title, company, location: location || "Remote" };
  jobs.push(job);
  res.status(201).json(job);
};

export const update = (req, res) => {
  const job = jobs.find((j) => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ message: "Job not found" });
  const { title, company, location } = req.body;
  Object.assign(job, { ...(title && { title }), ...(company && { company }), ...(location && { location }) });
  res.json(job);
};

export const remove = (req, res) => {
  const before = jobs.length;
  jobs = jobs.filter((j) => j.id !== Number(req.params.id));
  if (jobs.length === before) return res.status(404).json({ message: "Job not found" });
  res.status(204).end();
};
```

**routes/jobs.js**

```js
import { Router } from "express";
import * as jobs from "../controllers/jobs.js";

const router = Router();

router.get("/", jobs.list);
router.get("/:id", jobs.getOne);
router.post("/", jobs.create);
router.patch("/:id", jobs.update);
router.delete("/:id", jobs.remove);

export default router;
```

**server.js**

```js
import jobsRouter from "./routes/jobs.js";

app.use("/api/jobs", jobsRouter);
```

Now `GET /api/jobs` runs `jobs.list`, and `DELETE /api/jobs/5` runs `jobs.remove`.

**Note:** this data lives in a variable, so it resets when the server restarts. Next week you'll save it in MongoDB.

## 6. Middleware

**Middleware** is a function that runs between the request arriving and your route handler. It can read the request, change it, send a response, or pass it on with `next()`.

```js
import cors from "cors";

app.use(express.json());  // built-in: parse JSON bodies into req.body
app.use(cors());          // third-party: let your React app (another port) call the API

// your own: log every request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next(); // continue to the next middleware or route
});
```

**Order matters.** Middleware runs top to bottom, so put it before the routes that need it.

**Middleware for one route** (you'll use this for login checks next week):

```js
const requireApiKey = (req, res, next) => {
  if (req.headers["x-api-key"] !== "demo-key") {
    return res.status(401).json({ message: "Missing or wrong API key" });
  }
  next();
};

router.delete("/:id", requireApiKey, jobs.remove);
```

## 7. Handling request bodies, URL params and query strings

| Where | Example request | How to read it |
| --- | --- | --- |
| Body (JSON) | `POST /api/jobs` with `{ "title": "Dev" }` | `req.body.title` |
| URL params | `GET /api/jobs/42` with route `/:id` | `req.params.id` → `"42"` |
| Query string | `GET /api/jobs?location=Lagos&page=2` | `req.query.location` → `"Lagos"` |

**Params and query values are always strings.** Convert numbers with `Number(req.params.id)`.

**Search and filter with a query string**

```js
export const list = (req, res) => {
  const { q, location } = req.query;
  let result = jobs;

  if (q) {
    result = result.filter((j) => j.title.toLowerCase().includes(q.toLowerCase()));
  }
  if (location) {
    result = result.filter((j) => j.location === location);
  }

  res.json(result);
};
```

Now `GET /api/jobs?q=dev&location=Remote` searches and filters.

## 8. Error handling

**Expected problems:** handle them in the controller with the right status.

| Situation | Status |
| --- | --- |
| Missing or invalid input | 400 Bad Request |
| Not logged in | 401 Unauthorized |
| Not allowed | 403 Forbidden |
| Item doesn't exist | 404 Not Found |

**Unexpected problems:** one error-handling middleware at the end catches them. It has **four** parameters:

```js
// after all routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on our side" });
});
```

Never send `err.stack` to users: it reveals how your server works.

**Async errors.** In Express 5, errors thrown in async handlers reach your error middleware automatically. In Express 4, wrap your code in `try/catch` and call `next(error)`.

## 9. Testing APIs with Thunder Client

You can test GET requests in the browser, but POST, PATCH and DELETE need a tool.

1. Install **Thunder Client** from the VS Code Extensions tab.
2. Click the ⚡ icon, then **New Request**.
3. Choose the method and URL, e.g. `GET http://localhost:5000/api/jobs`, and click **Send**.
4. For POST/PATCH: go to **Body → JSON** and type:

```json
{ "title": "Backend Developer", "company": "BlockHub", "location": "Lagos" }
```

5. Check the **status code**, the **response body** and the time.

**Test the unhappy paths too:** a POST with no title (expect 400), a GET for an id that doesn't exist (expect 404).

Save your requests in a **collection** so you can re-run them all later.

## 10. Week 7 build: a functional backend API

Build a CRUD API for **one** resource: jobs, tasks, books or products.

**Requirements**

1. `GET`, `GET /:id`, `POST`, `PATCH /:id` and `DELETE /:id` routes.
2. Folder structure: `server.js`, `routes/`, `controllers/`.
3. Middleware: `express.json()`, `cors()` and a request logger.
4. Validation: 400 with a clear message for missing required fields.
5. 404 for missing items and unknown routes; a 500 error handler.
6. Search with `?q=` and at least one filter.
7. Every route tested in Thunder Client (save the collection).
8. A README listing every endpoint, like this:

```markdown
## Endpoints

| Method | URL | Body | Description |
| --- | --- | --- | --- |
| GET | /api/jobs?q=&location= | | List jobs, with search and filter |
| GET | /api/jobs/:id | | Get one job |
| POST | /api/jobs | { title, company, location } | Create a job |
| PATCH | /api/jobs/:id | any fields | Update a job |
| DELETE | /api/jobs/:id | | Delete a job |
```

**Bonus:** connect your Week 4 React job board to this API with `fetch` instead of `localStorage`.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the CRUD API with every requirement above.
2. Push it to GitHub (without `node_modules`).
3. Submit your GitHub link on BlockHub.

**End-of-week checklist**

- [ ] Explain what the client, server and database each do
- [ ] Set up a Node project with npm, scripts and nodemon
- [ ] Create an Express server that returns JSON
- [ ] Design REST endpoints with the right methods and status codes
- [ ] Split code into routes and controllers
- [ ] Write and use middleware, and explain `next()`
- [ ] Read `req.body`, `req.params` and `req.query`
- [ ] Return 400/404 for expected errors and catch the rest with error middleware
- [ ] Test every route with Thunder Client

**Glossary**

| Term | Meaning |
| --- | --- |
| Node.js | Runs JavaScript outside the browser |
| npm | Installs and manages packages |
| Express | A framework for building servers and APIs in Node |
| API | A set of URLs a program can call to get or change data |
| REST | Conventions for designing APIs around resources and HTTP methods |
| Endpoint | One URL + method, like `GET /api/jobs` |
| Route | Code that handles one endpoint |
| Controller | A function with the logic for a route |
| Middleware | A function that runs before your route handler |
| CRUD | Create, Read, Update, Delete |
| CORS | Browser rules about which sites can call your API |
