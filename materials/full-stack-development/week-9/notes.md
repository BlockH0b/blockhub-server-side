## Before you start

You've built a React frontend (Weeks 3–5) and a secure Express + MongoDB API (Weeks 7–8). This week you **connect them** into one full-stack app, then add an **AI-powered feature** the right way: through your backend, so your API key stays secret.

**What you need**

- Your Week 8 API running (`npm run dev` in the backend folder)
- Your React job board (or a new Vite app) running in a second terminal
- An AI API key (Anthropic, OpenAI or Google Gemini). Your tutor will tell you which one to use for class.

## 1. How the pieces connect

```text
Browser (React, port 5173)        Server (Express, port 5000)        MongoDB Atlas
   LoginForm  ── POST /api/auth/login ──▶  check password
              ◀──────── { token, user } ──
   JobList    ── GET /api/jobs ──────────▶  Job.find()  ─────────▶  jobs
              ◀──────── [ ...jobs ] ──────
   NewJob     ── POST /api/jobs + token ─▶  protect → create  ───▶  saved
```

**Who does what**

| Frontend (React) | Backend (Express) |
| --- | --- |
| Shows pages, forms and lists | Checks every request |
| Keeps the token after login | Verifies the token, checks ownership |
| Hides buttons users can't use | **Actually** blocks what users can't do |
| Shows loading and errors | Returns clear status codes and messages |

**Important:** hiding a button in React isn't security. Anyone can call your API directly. The backend must always check.

## 2. Environment URLs and CORS

**Frontend `.env`** (in the React project folder):

```bash
VITE_API_URL=http://localhost:5000/api
```

```js
const API = import.meta.env.VITE_API_URL;
```

- Only variables starting with `VITE_` reach the browser.
- **Everything in the frontend is public.** Never put secrets in a `VITE_` variable.
- Restart `npm run dev` after changing `.env`.

**Backend CORS:** your browser blocks requests from `localhost:5173` to `localhost:5000` unless the server allows them.

```js
import cors from "cors";

app.use(
  cors({
    origin: ["http://localhost:5173", process.env.CLIENT_URL], // CLIENT_URL = your live frontend
  })
);
```

**If you see** `blocked by CORS policy` in the console, the backend's `origin` list doesn't include the URL your frontend is running on.

## 3. A reusable API helper

Instead of writing `fetch` with headers in every component, write one helper.

```js
// src/lib/api.js
const API = import.meta.env.VITE_API_URL;

export async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null); // 204 has no body

  if (res.status === 401) localStorage.removeItem("token"); // expired or invalid
  if (!res.ok) throw new Error(data?.message || "Something went wrong");
  return data;
}
```

**Using it**

```js
const jobs = await api("/jobs?q=react");
const job = await api("/jobs", { method: "POST", body: { title, company } });
await api(`/jobs/${id}`, { method: "DELETE" });
```

## 4. Login state with Context

Many components need to know who is logged in: the navbar, protected pages, "Edit" buttons. Context shares that without passing props everywhere.

```jsx
// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // on first load, if there's a token, ask the API who we are
  useEffect(() => {
    if (!localStorage.getItem("token")) return setChecking(false);
    api("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setChecking(false));
  }, []);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const data = await api("/auth/register", { method: "POST", body: { name, email, password } });
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

Wrap your app in `main.jsx`:

```jsx
<BrowserRouter>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>
```

**A note on `localStorage`:** it's simple and fine for learning. Professional apps often use **httpOnly cookies** instead, because JavaScript (including malicious scripts) can't read them. BlockHub itself uses cookies.

## 5. Protected pages

```jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
```

```jsx
<Routes>
  <Route path="/" element={<JobList />} />
  <Route path="/login" element={<Login />} />
  <Route path="/jobs/new" element={<RequireAuth><NewJob /></RequireAuth>} />
</Routes>
```

**Show the right buttons**

```jsx
const { user, logout } = useAuth();

{user ? (
  <>
    <span>Hi, {user.name}</span>
    <button onClick={logout}>Log out</button>
  </>
) : (
  <Link to="/login">Log in</Link>
)}

{user?.id === job.owner && <button onClick={remove}>Delete</button>}
```

## 6. Loading and error states

Real networks are slow and APIs fail. Every request needs three states.

```jsx
function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/jobs")
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading jobs…</p>;
  if (error) return <p className="error">{error}</p>;
  if (jobs.length === 0) return <p>No jobs yet. Be the first to post one!</p>;

  return jobs.map((job) => <JobCard key={job._id} job={job} />);
}
```

**Forms:** disable the submit button while sending, so users can't double-submit.

```jsx
<button disabled={loading}>{loading ? "Saving…" : "Post job"}</button>
```

**Note:** MongoDB ids are `_id`, not `id`. Update your `key` props and links (`/jobs/${job._id}`).

## 7. Adding an AI feature

**Golden rule:** React calls **your** API; your API calls the AI provider. The AI key lives only in the backend `.env`.

```text
React ──POST /api/ai/job-description──▶ Express ──(secret key)──▶ AI provider
      ◀────────── { text } ────────────         ◀──── generated text ──
```

**Backend `.env`**

```bash
AI_API_KEY=your-key-here
AI_MODEL=the-model-name-your-tutor-gives-you
```

**controllers/ai.js** (this example uses Anthropic's Messages API; OpenAI and Gemini work the same way with different URLs and fields):

```js
export const describeJob = async (req, res) => {
  const { title, company } = req.body;
  if (!title || !company) {
    return res.status(400).json({ message: "Add a title and company first" });
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.AI_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Write a short, friendly job description (under 120 words) for a ${title} role at ${company}. Use plain text, no markdown.`,
        },
      ],
    }),
  });

  if (!r.ok) {
    console.error("AI error", r.status, await r.text());
    return res.status(502).json({ message: "The AI service is unavailable. Try again." });
  }

  const data = await r.json();
  res.json({ text: data.content?.[0]?.text || "" });
};
```

**routes/ai.js**

```js
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth.js";
import { describeJob } from "../controllers/ai.js";

const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }); // 20 per hour

router.post("/job-description", protect, aiLimiter, describeJob);
```

**Frontend button**

```jsx
const writeWithAI = async () => {
  setAiLoading(true);
  setError("");
  try {
    const { text } = await api("/ai/job-description", {
      method: "POST",
      body: { title: form.title, company: form.company },
    });
    setForm({ ...form, description: text });
  } catch (err) {
    setError(err.message);
  } finally {
    setAiLoading(false);
  }
};

<button type="button" onClick={writeWithAI} disabled={aiLoading}>
  {aiLoading ? "Writing…" : "✨ Write with AI"}
</button>
<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
```

**Other AI feature ideas:** summarise a long post, suggest tags, improve a CV bullet point, answer questions about your app's data.

## 8. Using AI safely in your app

| Risk | What to do |
| --- | --- |
| Key stolen from the frontend | Keep it in the backend `.env` only |
| Someone spams your AI route and drains your credit | `protect` + a rate limit; set a spending limit in the provider dashboard |
| AI output is wrong or odd | Put it in an editable field; the user reviews before saving |
| Huge or abusive input | Limit input length (e.g. title under 100 characters) |
| AI service is down | Catch errors and show a friendly message (502) |

## 9. Week 9 build: a full-stack app with an AI feature

**Requirements**

1. React app connected to your Week 8 API with a `VITE_API_URL`.
2. A reusable `api()` helper that sends the token.
3. Register, login and logout using `AuthContext`; the user stays logged in on refresh (`/auth/me`).
4. Protected pages for creating and editing; edit/delete buttons only for the owner.
5. Loading, error and empty states on every list and form.
6. One AI feature called through your backend, with `protect` and a rate limit.
7. Both projects on GitHub with READMEs and `.env.example` files.

## 10. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the full-stack app above.
2. Write down three things you'd add with more time (you'll use them in your capstone).
3. Submit both GitHub links on BlockHub.

**End-of-week checklist**

- [ ] Explain how React, Express and MongoDB talk to each other
- [ ] Configure `VITE_API_URL` and CORS
- [ ] Write an `api()` helper that adds the token and throws on errors
- [ ] Manage login state with Context and restore it with `/auth/me`
- [ ] Protect pages with `RequireAuth`
- [ ] Show loading, error and empty states
- [ ] Add an AI feature through the backend without exposing the key
- [ ] Explain why frontend checks are not security

**Glossary**

| Term | Meaning |
| --- | --- |
| Full-stack | An app with both a frontend and a backend you built |
| Integration | Making separate parts work together |
| Context | React's way to share data with many components |
| Protected route | A page only logged-in users can open |
| CORS | Browser rules about which sites can call your API |
| httpOnly cookie | A cookie JavaScript can't read, safer for tokens |
| LLM | Large language model, the kind of AI behind chat tools |
| AI provider | A company whose API runs AI models (Anthropic, OpenAI, Google) |
| Rate limit | A cap on how many requests a user can make |
| 502 Bad Gateway | Your server couldn't get a good answer from another service |
