## Before you start

This week has two halves. First, you learn how apps really talk to servers: HTTP, JSON, `async/await` and `fetch`. Second, you learn **Git and GitHub**, the tools every developer uses to save their work and collaborate. By the end you'll build a data-driven app and share it on GitHub the professional way.

**What you need**

- Git installed: check with `git --version`. If not, get it from [git-scm.com](https://git-scm.com).
- A GitHub account.
- Set your name and email once:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 1. How HTTP works: methods and status codes

Every time your app needs data, it sends an **HTTP request** to a server and gets an **HTTP response** back.

**A request** has a method, a URL, headers and sometimes a body:

```http
POST /api/tasks HTTP/1.1
Host: api.example.com
Content-Type: application/json

{ "title": "Learn fetch" }
```

**A response** has a status code, headers and usually a body:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{ "id": 7, "title": "Learn fetch" }
```

**Methods**

| Method | Meaning | Example |
| --- | --- | --- |
| GET | Read data | Get all jobs |
| POST | Create something | Add a new job |
| PUT / PATCH | Update something | Edit a job (PUT replaces it all, PATCH changes some fields) |
| DELETE | Remove something | Delete a job |

**Status codes**

| Code | Meaning |
| --- | --- |
| 200 OK | It worked |
| 201 Created | Something new was made |
| 400 Bad Request | You sent something wrong |
| 401 Unauthorized | You're not logged in |
| 403 Forbidden | You're logged in but not allowed |
| 404 Not Found | It doesn't exist |
| 500 Server Error | The server broke |

Rule of thumb: **2xx** worked, **4xx** the client made a mistake, **5xx** the server made a mistake.

**Practice:** open DevTools → Network on any website, refresh, and find one GET request. What status did it return?

## 2. Working with JSON

**JSON** (JavaScript Object Notation) is the text format APIs use to send data. It looks like a JavaScript object, with stricter rules:

- Keys must be in double quotes.
- Strings use double quotes, not single.
- No comments, no trailing commas, no functions.

```json
{
  "name": "Ada",
  "age": 21,
  "skills": ["HTML", "CSS", "React"],
  "isStudent": true,
  "mentor": null
}
```

**Converting**

```js
const text = '{"name":"Ada","skills":["HTML","CSS"]}';

const user = JSON.parse(text);          // text → object
console.log(user.skills[1]);            // "CSS"

const back = JSON.stringify(user);       // object → text
const pretty = JSON.stringify(user, null, 2); // indented, for reading
```

You already used this in Week 4 to save to `localStorage`, which only stores text.

**Practice:** write a JSON object describing yourself, with a nested `address` object and a `projects` array. Check it at [jsonlint.com](https://jsonlint.com).

## 3. Promises and async/await

Network requests take time. JavaScript doesn't stop and wait; it carries on and comes back when the data arrives.

A **Promise** is a value that will arrive later. It is **pending**, then either **fulfilled** (it worked) or **rejected** (it failed).

**Using `.then()`**

```js
fetch("https://jsonplaceholder.typicode.com/users/1")
  .then((res) => res.json())
  .then((user) => console.log(user.name))
  .catch((err) => console.log("Failed:", err));
```

**Using async/await** (easier to read, does the same thing):

```js
async function getUser() {
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/users/1");
    const user = await res.json();
    console.log(user.name);
  } catch (err) {
    console.log("Failed:", err);
  }
}

getUser();
```

- `async` marks a function that uses `await`.
- `await` pauses that function until the promise settles.
- `try/catch` handles errors.

**Running requests at the same time**

```js
const [users, posts] = await Promise.all([
  fetch("/api/users").then((r) => r.json()),
  fetch("/api/posts").then((r) => r.json()),
]);
```

**Practice:** write `async function wait(ms)` that resolves after `ms` milliseconds using `new Promise((resolve) => setTimeout(resolve, ms))`. Use it to log "Ready" after 2 seconds.

## 4. Making requests with fetch

**GET** (the default):

```js
const res = await fetch("https://api.example.com/jobs");
const jobs = await res.json();
```

**POST** (sending data):

```js
const res = await fetch("https://api.example.com/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Frontend Developer", company: "BlockHub" }),
});
const created = await res.json();
```

**DELETE**:

```js
await fetch(`https://api.example.com/jobs/${id}`, { method: "DELETE" });
```

**Important:** `fetch` only throws if the network fails. A 404 or 500 is still a "successful" fetch. Always check `res.ok`:

```js
const res = await fetch(url);
if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
```

**Keep API code in one place.** Put your requests in `src/services/api.js`:

```js
const BASE = "https://jsonplaceholder.typicode.com";

export async function getPosts() {
  const res = await fetch(`${BASE}/posts`);
  if (!res.ok) throw new Error("Could not load posts");
  return res.json();
}

export async function createPost(post) {
  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error("Could not create post");
  return res.json();
}
```

## 5. Handling loading and error states

Every request has three possible states, and your UI should handle all of them.

```jsx
import { useEffect, useState } from "react";
import { getPosts } from "../services/api";

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | done

  const load = async () => {
    setStatus("loading");
    try {
      setPosts(await getPosts());
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (status === "loading") return <p>Loading posts…</p>;
  if (status === "error")
    return (
      <div>
        <p>Couldn't load posts. Check your connection.</p>
        <button onClick={load}>Try again</button>
      </div>
    );
  if (posts.length === 0) return <p>No posts yet.</p>;

  return posts.slice(0, 10).map((p) => <h3 key={p.id}>{p.title}</h3>);
}
```

**Good UX for data**

- **Loading:** a spinner or skeleton, never a blank screen.
- **Error:** a friendly message and a "Try again" button. Never show raw error text to users.
- **Empty:** a helpful message when there's simply no data.
- **Disable buttons** while a request is running, so users don't click twice.

## 6. Git basics: init, add, commit

**Git** tracks changes to your files. Each **commit** is a snapshot you can go back to.

```bash
git init                         # start tracking this folder (once)
git status                       # see what changed
git add index.html               # stage one file
git add .                        # stage everything
git commit -m "Add job list"     # save the snapshot
git log --oneline                # see the history
```

**The three areas**

| Area | What it is |
| --- | --- |
| Working folder | Your files as you edit them |
| Staging area | Changes you've chosen for the next commit (`git add`) |
| Repository | Saved commits (`git commit`) |

**Good commit messages** say what the change does: `"Add search to job list"`, `"Fix empty state on mobile"`. Not `"update"` or `"stuff"`.

**Ignore files** you shouldn't commit, like `node_modules` and `.env`, by listing them in a `.gitignore` file. Vite creates one for you.

**Undoing**

```bash
git restore index.html     # throw away changes to a file since the last commit
git log --oneline          # find an old commit
git switch --detach a1b2c3 # look at an old version (git switch main to go back)
```

## 7. Branches and merging

A **branch** is a separate line of work. You can try something new without breaking the working version on `main`.

```bash
git switch -c add-search     # create a branch and move to it
# ...edit files...
git add .
git commit -m "Add search box"

git switch main              # go back to main
git merge add-search         # bring the branch's changes into main
git branch -d add-search     # delete the finished branch
```

**Merge conflicts** happen when two branches change the same lines. Git marks them in the file:

```text
<<<<<<< HEAD
<h1>Job Board</h1>
=======
<h1>Find Your Next Job</h1>
>>>>>>> add-search
```

Fix it by keeping the version you want, deleting the markers, then `git add` and `git commit`. VS Code shows buttons to accept one side or both.

## 8. GitHub repositories: push, pull and clone

**GitHub** stores your Git repositories online.

**Put an existing project on GitHub**

1. On github.com, click **New repository**. Don't add a README (you already have files).
2. Run the commands GitHub shows you:

```bash
git remote add origin https://github.com/your-username/my-app.git
git branch -M main
git push -u origin main
```

**Everyday commands**

```bash
git push                    # send your new commits to GitHub
git pull                    # get the latest commits from GitHub
git clone https://github.com/someone/project.git   # download a repo
```

**Habit:** `git pull` before you start work, and `git push` when you finish.

## 9. Pull requests and working in a team

A **pull request (PR)** asks to merge your branch into `main`. It's how teams review each other's code before it goes live.

**The team workflow**

1. `git pull` to get the latest `main`.
2. Create a branch: `git switch -c feature/job-search`.
3. Make your changes and commit them.
4. Push the branch: `git push -u origin feature/job-search`.
5. On GitHub, click **Compare & pull request**. Write what you changed and why, and add a screenshot.
6. A teammate reviews it, leaves comments and approves.
7. Merge the PR on GitHub.
8. Everyone runs `git switch main` and `git pull`.

**Good PRs are small:** one feature or fix per PR is easier to review.

**Practice with a friend:** one person creates a repo and adds the other as a collaborator (Settings → Collaborators). Each of you adds a section to a shared `README.md` through a pull request.

## 10. Week 5 build: a data-driven application

Build an app that fetches real data and lets users explore it. Choose one:

| Idea | API |
| --- | --- |
| Country explorer | `https://restcountries.com/v3.1/all?fields=name,flags,capital,region,population` |
| Remote job finder | `https://remotive.com/api/remote-jobs` |
| GitHub profile viewer | `https://api.github.com/users/USERNAME` |

**Requirements**

1. Fetch the data with `async/await` in a `services/api.js` file.
2. Show loading, error (with "Try again") and empty states.
3. A search box and at least one filter (region, category, etc.).
4. At least two components (e.g. `CountryCard`, `SearchBar`).
5. Use Git from the start: at least 5 commits with clear messages.
6. Build one feature on a branch and merge it with a pull request.
7. A `README.md` with a description, screenshot and live link.

### Starter: country explorer

```jsx
import { useEffect, useState } from "react";

export default function App() {
  const [countries, setCountries] = useState([]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=name,flags,capital,region,population")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setCountries(data);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, []);

  const shown = countries
    .filter((c) => c.name.common.toLowerCase().includes(query.toLowerCase()))
    .filter((c) => region === "All" || c.region === region);

  if (status === "loading") return <p>Loading countries…</p>;
  if (status === "error") return <p>Couldn't load countries.</p>;

  return (
    <main>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a country" />
      <select value={region} onChange={(e) => setRegion(e.target.value)}>
        {["All", "Africa", "Americas", "Asia", "Europe", "Oceania"].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>

      {shown.length === 0 && <p>No countries match.</p>}

      <div className="grid">
        {shown.map((c) => (
          <article key={c.name.common} className="card">
            <img src={c.flags.png} alt={`Flag of ${c.name.common}`} />
            <h3>{c.name.common}</h3>
            <p>Capital: {c.capital?.[0] || "—"}</p>
            <p>Population: {c.population.toLocaleString()}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
```

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish your data-driven app with every requirement above.
2. Use at least one branch and one merged pull request.
3. Deploy it and add the live link to your README.
4. Submit your GitHub and live links on BlockHub.

**End-of-week checklist**

- [ ] Explain HTTP methods and the main status codes
- [ ] Read and write JSON, and use `JSON.parse` / `JSON.stringify`
- [ ] Use `async/await` with `try/catch`
- [ ] Make GET and POST requests with `fetch`, checking `res.ok`
- [ ] Show loading, error and empty states
- [ ] Use `git init`, `add`, `commit`, `status` and `log`
- [ ] Create, merge and delete branches, and fix a simple conflict
- [ ] Push, pull and clone with GitHub
- [ ] Open and merge a pull request

**Glossary**

| Term | Meaning |
| --- | --- |
| HTTP | The rules for how browsers and servers talk |
| Status code | A number saying how a request went (200, 404…) |
| JSON | A text format for sending data |
| Promise | A value that will arrive later |
| async/await | A readable way to wait for promises |
| fetch | The browser function for making HTTP requests |
| Commit | A saved snapshot of your project |
| Branch | A separate line of work |
| Merge | Bringing one branch's changes into another |
| Repository (repo) | A project tracked by Git |
| Pull request | A request to merge a branch, with review |
