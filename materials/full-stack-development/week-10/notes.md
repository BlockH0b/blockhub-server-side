## Before you start

This is the final week. You'll finish a **capstone project**, put it **live on the internet**, and **present** it. Your capstone becomes the first serious project in your portfolio: the thing you show employers and clients.

**What you need**

- Your Week 9 full-stack app (or a new capstone idea)
- GitHub, Render, and Netlify or Vercel accounts (all free; sign in with GitHub)
- Your MongoDB Atlas cluster

## 1. Choosing your capstone

You can **extend your Week 9 app** or start something new. Either is fine. Pick something you care about; you'll explain it better.

| Idea | Core features |
| --- | --- |
| Marketplace | Post items with prices, browse, search, contact the seller |
| Event or study-group app | Create events, RSVP, see who's coming, comments |
| Tutor or service booking | Providers list services, users book time slots |
| AI study helper | Paste notes, get a quiz; save quizzes and scores |
| Small-business tool | Inventory or orders for a shop, with a dashboard |
| Job board (Week 9) | Add applications, saved jobs, company profiles |

**Minimum requirements**

1. React frontend with React Router and at least 3 pages.
2. Express + MongoDB backend with at least one full CRUD resource.
3. Register, login and protected routes, with ownership checks.
4. Loading, error and empty states.
5. Deployed: both frontend and backend live.
6. A README with a screenshot, live link and demo login.

**Bonus:** an AI feature, image uploads, search and filters, pagination, an admin role.

## 2. Scoping an MVP

An **MVP (minimum viable product)** is the smallest version that solves the problem. Most unfinished projects fail because they tried to do too much.

1. **One user, one problem.** "Students in my cohort can't find study partners."
2. **Three must-haves.** Without these, the app is useless.
3. **Two nice-to-haves.** Only after the must-haves are live.
4. **Write your user stories.** "As a student, I can create a study group so others can join."

**Your week**

| Day | Goal |
| --- | --- |
| 1 | Plan: problem, features, screens, data models. Set up both repos. |
| 2 | First must-have working end to end, **deployed** (even if ugly). |
| 3–4 | Remaining must-haves. Redeploy after each one. |
| 5 | Nice-to-haves, styling, mobile, README, demo account. |
| 6 | Test the live app, rehearse, present. |

**Deploy early.** Deployment problems are much easier to fix with a small app than the night before demo day.

## 3. Preparing for production

**Backend checklist**

```json
// package.json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js"
}
```

```js
// server.js
import "dotenv/config";

const PORT = process.env.PORT || 5000; // Render sets PORT for you
app.use(cors({ origin: process.env.CLIENT_URL })); // your live frontend URL

app.get("/api/health", (req, res) => res.json({ ok: true })); // quick check that it's up
```

- [ ] Every secret comes from `process.env`, nothing hard-coded
- [ ] `.env` is in `.gitignore`; `.env.example` lists every variable
- [ ] `node_modules` is not in the repo
- [ ] Atlas Network Access allows `0.0.0.0/0` (Render's IP addresses change)

**Frontend checklist**

- [ ] Every API call uses `import.meta.env.VITE_API_URL`, no `localhost` left in the code
- [ ] `npm run build` works on your computer with no errors
- [ ] A redirect rule so React Router pages work on refresh (section 5)

## 4. Deploying the API on Render

1. Push your backend to GitHub.
2. On **render.com**, click **New → Web Service** and connect the repo.
3. Settings:

| Setting | Value |
| --- | --- |
| Root directory | `backend` (only if the backend is in a subfolder) |
| Build command | `npm install` |
| Start command | `npm start` |
| Instance type | Free |

4. **Environment** → add every variable from your `.env`:

```text
MONGO_URI      mongodb+srv://...
JWT_SECRET     a-long-random-string
CLIENT_URL     https://your-app.netlify.app   (add after deploying the frontend)
AI_API_KEY     ...                             (if you have an AI feature)
AI_MODEL       ...
```

5. Click **Create Web Service** and watch the logs. When you see your "MongoDB connected" / "Server running" messages, open:

```text
https://your-api.onrender.com/api/health
```

**Free-tier note:** Render's free services sleep after about 15 minutes without traffic. The first request after that can take up to a minute. Show a loading message, and open your app a minute before presenting.

**Every `git push` redeploys automatically.**

## 5. Deploying React on Netlify or Vercel

**Netlify**

1. **Add new site → Import an existing project** → choose your frontend repo.
2. Build command `npm run build`, publish directory `dist` (Vite).
3. **Site configuration → Environment variables:** `VITE_API_URL = https://your-api.onrender.com/api`
4. Deploy. If you add or change the variable later, trigger a new deploy: Vite bakes it in at build time.

**Vercel:** **Add New → Project**, import the repo, add `VITE_API_URL` under Environment Variables, deploy.

**Fix refresh on React Router pages.** Without this, opening or refreshing `/jobs/42` directly gives a 404, because the host looks for a real file called `jobs/42`.

Netlify: create `public/_redirects`:

```text
/*    /index.html   200
```

Vercel: create `vercel.json` in the project root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

## 6. Connecting the live URLs

The two halves need to know about each other:

| Where | Variable | Value |
| --- | --- | --- |
| Netlify/Vercel (frontend) | `VITE_API_URL` | `https://your-api.onrender.com/api` |
| Render (backend) | `CLIENT_URL` | `https://your-app.netlify.app` (no trailing slash) |

After changing `CLIENT_URL` on Render, the service restarts. After changing `VITE_API_URL`, redeploy the frontend.

## 7. Testing and debugging the live app

**Test like a stranger**

- Open the live site in a private/incognito window.
- Register a brand-new account and use every feature.
- Try it on your phone.
- Refresh on different pages.

**Common deployment problems**

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `blocked by CORS policy` | `CLIENT_URL` wrong or missing | Match the exact frontend URL, no trailing slash |
| Requests go to `localhost` | `VITE_API_URL` not set, or set after building | Set it and redeploy the frontend |
| 404 when refreshing a page | No redirect rule | Add `_redirects` or `vercel.json` |
| Render logs: `MongoServerSelectionError` | Atlas blocks Render's IP or wrong `MONGO_URI` | Allow `0.0.0.0/0`; check the URI |
| Render logs: `Cannot find module` | Wrong import path or file name case | Linux is case-sensitive: `Job.js` ≠ `job.js` |
| First load takes ages | Render free tier waking up | Normal; open it early before demos |
| Login works locally, not live | `JWT_SECRET` missing on Render | Add it in Environment |

**Where to look:** browser DevTools (Console and Network tabs) for frontend problems; **Render → Logs** for backend problems.

## 8. README and portfolio

Employers often look at a README for under a minute. Make it count.

```markdown
# JobHub

Find and post tech jobs in Nigeria.

**Live:** https://jobhub.netlify.app · **API:** https://jobhub-api.onrender.com
**Demo login:** demo@jobhub.dev / demo1234

![JobHub screenshot](./screenshot.png)

## Features
- Sign up and log in (JWT, hashed passwords)
- Post, edit and delete your own jobs
- Search and filter by location
- ✨ AI-written job descriptions

## Tech
React, React Router, Express, MongoDB (Mongoose), JWT, Render, Netlify

## Run locally
1. Clone the repo
2. `cd backend && npm install`, copy `.env.example` to `.env` and fill it in, then `npm run dev`
3. `cd frontend && npm install`, set `VITE_API_URL`, then `npm run dev`

## What I learned
- Handling CORS and environment variables across two deployments
- Protecting routes and checking ownership on the server

## Next
- Saved jobs and email alerts
```

**Portfolio tips**

- Create the **demo account** yourself and fill it with realistic sample data. An empty app looks broken.
- Pin the repo on your GitHub profile.
- Post a short demo video or thread on LinkedIn or X with the live link.

## 9. Presenting your project

**Five minutes**

1. **Problem (30 seconds):** who it's for and why it matters.
2. **Live demo (3 minutes):** use the live link, not localhost. Show the main flow end to end: sign up → core feature → result.
3. **Code (1 minute):** one piece of code you're proud of, and the hardest bug you fixed.
4. **Next (30 seconds):** what you'd add next. Then take questions.

**Before you present**

- [ ] Open the live app a minute early (wake up Render)
- [ ] Log in to the demo account in one tab, and have a fresh tab for signing up
- [ ] Close unrelated tabs and turn off notifications
- [ ] Rehearse once with a timer

## 10. Final checklist and glossary

**Capstone submission**

1. Live frontend link
2. Live API link (`/api/health` works)
3. GitHub link(s) with a complete README
4. Demo login
5. Submit all of the above on BlockHub before demo day

**End-of-course checklist**

- [ ] Scope a project into an MVP with must-haves and nice-to-haves
- [ ] Prepare an Express app for production (start script, env, CORS)
- [ ] Deploy an API on Render with environment variables
- [ ] Deploy a React app on Netlify or Vercel with routing fixed
- [ ] Connect the live frontend and backend
- [ ] Debug deployment problems with DevTools and Render logs
- [ ] Write a portfolio-ready README
- [ ] Present a project clearly in 5 minutes

**Glossary**

| Term | Meaning |
| --- | --- |
| Capstone | A final project that brings together everything you learned |
| MVP | Minimum viable product: the smallest version that works |
| Deployment | Putting your app on a server so anyone can use it |
| Production | The live version real users see |
| Build | Turning your source code into optimised files for production |
| Environment variable | A setting stored on the host, not in code |
| Cold start | The delay when a sleeping free server wakes up |
| Health check | A simple route that confirms the server is running |
| Redirect / rewrite rule | Tells the host to serve `index.html` for every page |
| Portfolio | The collection of projects you show employers |

**Congratulations on finishing the Full-Stack Development track.** Keep building, keep shipping, and keep helping the next cohort.
