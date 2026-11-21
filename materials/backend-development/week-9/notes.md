## Before you start

Your blog API now has auth, validation, uploads, emails and payments. But how do you **know** it all still works after you change something? And how does a frontend developer learn how to use it without messaging you? This week: **automated tests** with Jest and Supertest, **API documentation** with Swagger, and how to use **AI** to speed both up.

**What you need**

- Your Week 8 blog API
- `npm install -D jest supertest mongodb-memory-server`
- `npm install swagger-ui-express yaml`

## 1. Why test?

| Without tests | With tests |
| --- | --- |
| You click through Thunder Client after every change | `npm test` checks everything in seconds |
| Fixing one bug quietly breaks another feature | The broken test tells you exactly what broke |
| You're scared to refactor | You refactor and the tests confirm nothing changed |
| "It works on my machine" | Tests run the same everywhere, including GitHub |

Employers look for tests in portfolio projects. It's one of the clearest signs of a professional backend developer.

## 2. Types of tests

| Type | Tests | Speed | Example |
| --- | --- | --- | --- |
| **Unit** | One function on its own | Very fast | `slugify("Hello World")` → `"hello-world"` |
| **Integration** | Several parts together: routes, middleware, database | Fast | `POST /api/posts` as a reader → 403 |
| **End-to-end (E2E)** | The whole system through a browser | Slow | Sign up, write a post, see it on the homepage |

**The testing pyramid:** many unit tests, a good number of integration tests, a few E2E tests. For APIs, **integration tests give the most value**: they test what clients actually experience.

## 3. Jest basics

```js
// src/utils/slugify.js
export const slugify = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
```

```js
// tests/slugify.test.js
import { slugify } from "../src/utils/slugify.js";

describe("slugify", () => {
  test("lowercases and joins words with dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("removes symbols and trims dashes", () => {
    expect(slugify("  Node.js & Express!  ")).toBe("node-js-express");
  });

  test("returns an empty string for only symbols", () => {
    expect(slugify("!!!")).toBe("");
  });
});
```

**Common matchers**

| Matcher | Checks |
| --- | --- |
| `toBe(x)` | Exactly equal (numbers, strings, booleans) |
| `toEqual(obj)` | Same contents (objects, arrays) |
| `toMatchObject(obj)` | Contains at least these fields |
| `toBeTruthy()`, `toBeNull()`, `toBeUndefined()` | Truthiness |
| `toContain(x)` | Array or string includes x |
| `toHaveLength(n)` | Length |
| `toThrow()` | Function throws |
| `await expect(promise).rejects.toThrow()` | Promise rejects |

**Arrange, Act, Assert:** set up the data, do the action, check the result. Keep each test focused on one behaviour, with a name that reads like a sentence.

## 4. Setting up Jest for an Express app

**Jest and ES modules.** Jest needs a Node flag to understand `import`:

```json
"scripts": {
  "dev": "node --watch --env-file=.env src/server.js",
  "start": "node src/server.js",
  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand",
  "test:watch": "npm test -- --watch",
  "coverage": "npm test -- --coverage"
},
"jest": {
  "testEnvironment": "node",
  "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"]
}
```

`--runInBand` runs test files one at a time, which avoids database clashes.

**Split the app from the server.** Tests need the Express app **without** connecting to Atlas or listening on a port.

```js
// src/app.js: builds the app, exports it
import express from "express";
// ... middleware, routes, error handler
const app = express();
// ...
export default app;
```

```js
// src/server.js: the only file that connects and listens
import mongoose from "mongoose";
import app from "./app.js";

await mongoose.connect(process.env.MONGO_URI);
app.listen(process.env.PORT || 5000, () => console.log("API running"));
```

## 5. A test database

**Never run tests against your real database.** Tests create and delete data.

`mongodb-memory-server` starts a real MongoDB in memory, just for the tests.

```js
// tests/setup.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  // a clean database for every test
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
```

The first run downloads a MongoDB binary, so it can take a minute.

**Turn off side effects in tests:** emails, payments and uploads should not run for real. Skip rate limits too:

```js
if (process.env.NODE_ENV !== "test") app.use("/api/auth/login", authLimiter);
```

## 6. Integration tests with Supertest

Supertest sends real HTTP requests to your app without starting a server.

```js
// tests/posts.test.js
import request from "supertest";
import app from "../src/app.js";
import { loggedInAgent, validPost } from "./helpers.js";

describe("GET /api/posts", () => {
  test("returns an empty page when there are no posts", async () => {
    const res = await request(app).get("/api/posts");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], page: 1, total: 0 });
  });

  test("rejects a limit above 50", async () => {
    await request(app).get("/api/posts?limit=500").expect(400);
  });
});

describe("POST /api/posts", () => {
  test("creates a post for an author", async () => {
    const agent = await loggedInAgent("author");

    const res = await agent.post("/api/posts").send(validPost).expect(201);

    expect(res.body.title).toBe(validPost.title);
    expect(res.body.slug).toBeTruthy();
  });

  test("rejects a post without a title", async () => {
    const agent = await loggedInAgent("author");

    const res = await agent.post("/api/posts").send({ ...validPost, title: undefined });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "title")).toBe(true);
  });
});
```

**Test the response contract,** not internal details: status, body shape, and side effects in the database.

```js
const saved = await Post.findOne({ title: validPost.title });
expect(saved.author.toString()).toBe(user.id);
```

## 7. Testing auth, roles and errors

**A helper that logs in**

```js
// tests/helpers.js
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";

export const validPost = {
  title: "Testing with Supertest",
  body: "Supertest makes integration testing an Express API pleasant and quick.",
  tags: ["testing"],
  status: "published",
};

let counter = 0;

export async function loggedInAgent(role = "reader") {
  const agent = request.agent(app); // keeps cookies between requests
  const email = `${role}${++counter}@test.dev`;
  const user = await User.create({ name: "Tester", email, password: "password123", role });
  await agent.post("/api/auth/login").send({ email, password: "password123" }).expect(200);
  agent.user = user;
  return agent;
}
```

**What to test for every protected route**

| Case | Expect |
| --- | --- |
| No login | 401 |
| Logged in, wrong role | 403 |
| Logged in, someone else's item | 403 |
| Invalid input | 400 with field errors |
| Item doesn't exist | 404 |
| Happy path | 200/201/204 and the right data |

```js
test("authors can't edit someone else's post", async () => {
  const ada = await loggedInAgent("author");
  const ben = await loggedInAgent("author");
  const { body: post } = await ada.post("/api/posts").send(validPost).expect(201);

  await ben.patch(`/api/posts/${post._id}`).send({ title: "Hacked" }).expect(403);
});

test("login fails with the wrong password", async () => {
  await User.create({ name: "Ada", email: "ada@test.dev", password: "password123" });
  await request(app)
    .post("/api/auth/login")
    .send({ email: "ada@test.dev", password: "nope12345" })
    .expect(401);
});
```

**Mocking external services** so tests never send real emails or charge cards:

```js
import { jest } from "@jest/globals";

jest.unstable_mockModule("../src/services/email.js", () => ({
  sendEmail: jest.fn().mockResolvedValue({}),
}));
const { sendEmail } = await import("../src/services/email.js");
const { default: app } = await import("../src/app.js"); // import AFTER mocking

// later
expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@test.dev" }));
```

**Coverage**

```bash
npm run coverage
```

Shows which lines your tests run. Aim for 70%+ on controllers and middleware. 100% isn't the goal; testing the important behaviour is.

**A test that can't fail is useless.** After writing a test, break the code on purpose and check the test goes red.

## 8. Documenting your API with Swagger (OpenAPI)

**OpenAPI** is a standard format describing every endpoint: URL, method, inputs, responses and auth. **Swagger UI** turns it into an interactive page where people can try requests.

**openapi.yaml** (in the project root)

```yaml
openapi: 3.0.3
info:
  title: Blog API
  version: 1.0.0
  description: Posts, comments, users and payments for the BlockHub blog project.
servers:
  - url: http://localhost:5000
components:
  securitySchemes:
    cookieAuth: { type: apiKey, in: cookie, name: token }
  schemas:
    Post:
      type: object
      properties:
        _id: { type: string }
        title: { type: string }
        slug: { type: string }
        tags: { type: array, items: { type: string } }
        status: { type: string, enum: [draft, published] }
        author: { type: object, properties: { _id: { type: string }, name: { type: string } } }
    NewPost:
      type: object
      required: [title, body]
      properties:
        title: { type: string, minLength: 3, maxLength: 150 }
        body: { type: string, minLength: 20 }
        tags: { type: array, items: { type: string }, maxItems: 5 }
        status: { type: string, enum: [draft, published] }
    Error:
      type: object
      properties:
        message: { type: string }
        errors: { type: array, items: { type: object } }
paths:
  /api/posts:
    get:
      tags: [Posts]
      summary: List published posts
      parameters:
        - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
        - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50, default: 10 } }
        - { in: query, name: tag, schema: { type: string } }
        - { in: query, name: q, schema: { type: string } }
      responses:
        "200": { description: A page of posts }
        "400": { description: Invalid query, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }
    post:
      tags: [Posts]
      summary: Create a post (authors and admins)
      security: [{ cookieAuth: [] }]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/NewPost" } } }
      responses:
        "201": { description: Created, content: { application/json: { schema: { $ref: "#/components/schemas/Post" } } } }
        "400": { description: Validation failed }
        "401": { description: Not logged in }
        "403": { description: Not an author }
```

**Serve it**

```js
// src/app.js
import fs from "node:fs";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";

const spec = YAML.parse(fs.readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
```

Open `http://localhost:5000/api/docs`.

**Keep docs honest:** update `openapi.yaml` in the same commit as the code change. Some teams generate the spec from their Zod schemas (e.g. `zod-to-openapi`) so it can't drift.

## 9. AI in the backend workflow

AI is a fast assistant. You are still the engineer responsible for every line.

**Where AI helps most**

| Task | Example prompt |
| --- | --- |
| Draft tests | "Here's my posts controller and routes. Write Supertest tests for 401, 403, 400, 404 and success cases. Use my `loggedInAgent` helper." |
| Draft docs | "Write OpenAPI 3 YAML for these Express routes and Zod schemas." |
| Debugging | "Here's the full error, the code, what I expected and what happened. Explain the cause first." |
| Review | "Review this controller for security issues: missing auth, IDOR, mass assignment, injection." |
| Boilerplate | Seed scripts, Zod schemas from a Mongoose model, regex, migration scripts |

**Rules**

- **Never paste secrets** (`.env`, keys, tokens) or real user data.
- **Read and run everything.** AI invents functions, package options and outdated APIs.
- **Make AI-written tests fail first.** A test that passes against broken code proves nothing.
- **Ask "why?"** Understanding the fix is how you stop making the same mistake.
- **Check the official docs** for anything security- or money-related (auth, Paystack, webhooks).

## 10. Week 9 build: a tested, documented API

**Requirements**

1. `src/app.js` and `src/server.js` split; tests use `mongodb-memory-server`.
2. At least **15 tests**, including:
   - unit tests for 2 helpers (`slugify`, `paging`),
   - register, login (success and wrong password), `/me` without login,
   - create post: reader 403, author 201, invalid 400,
   - edit someone else's post 403, delete as admin 204,
   - pagination and `limit` validation.
3. Emails and payments mocked in tests.
4. `npm run coverage` at 70%+ for controllers.
5. Swagger UI at `/api/docs` documenting every endpoint, with auth and error responses.
6. README: how to run the tests, and a link to the docs.

**Bonus: run tests on every push** with GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
```

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the tested, documented API.
2. Pick your capstone idea and write a one-paragraph description for next class.
3. Push and submit on BlockHub.

**End-of-week checklist**

- [ ] Explain unit, integration and E2E tests and the testing pyramid
- [ ] Write Jest tests with `describe`, `test`, `expect` and matchers
- [ ] Split `app.js` from `server.js`
- [ ] Use `mongodb-memory-server` and clean data between tests
- [ ] Write Supertest tests for success, 400, 401, 403 and 404
- [ ] Mock external services
- [ ] Read a coverage report
- [ ] Document endpoints in OpenAPI and serve Swagger UI
- [ ] Use AI to draft tests and docs, and verify them

**Glossary**

| Term | Meaning |
| --- | --- |
| Unit test | Tests one function on its own |
| Integration test | Tests several parts working together |
| E2E test | Tests the whole app like a real user |
| Jest | A JavaScript testing framework |
| Supertest | A library for sending HTTP requests to an Express app in tests |
| Matcher | A function like `toBe` that checks a value |
| Mock | A fake version of a module or function used in tests |
| Coverage | How much of your code the tests run |
| Fixture | Prepared test data |
| OpenAPI | A standard format for describing APIs |
| Swagger UI | An interactive web page generated from an OpenAPI spec |
| CI | Continuous integration: running tests automatically on every push |
