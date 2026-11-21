## Before you start

AI tools can write code in seconds. That makes them powerful, and dangerous if you don't understand what they give you. This week you learn to use AI the way professional developers do: as a fast assistant whose work you always read, test and own. Then you plan, build and present your first complete frontend project.

**Tools you can use:** ChatGPT, Claude, Gemini, GitHub Copilot (free for students through GitHub Education), or Cursor. Any of them works for this week.

## 1. What AI coding tools can and cannot do

| AI is great at | AI often gets wrong |
| --- | --- |
| Boilerplate: forms, layouts, repeated code | Outdated library versions and APIs |
| Explaining code you don't understand | Functions or packages that don't exist |
| Spotting typos and simple bugs | Edge cases: empty data, slow internet, errors |
| First drafts of components and CSS | Security: it may skip validation or leak secrets |
| Turning ideas into step-by-step plans | Your specific project: it can't see your files unless you show it |

**The rule:** AI writes the first draft, you are the engineer. You must be able to explain every line you ship. If something breaks in a job, "the AI wrote it" isn't an answer.

**Never paste into an AI tool:** passwords, API keys, `.env` files, or other people's private data.

## 2. Writing clear, specific prompts

Vague prompts get generic code. Specific prompts get code that fits your project.

**❌ Vague**

```text
make a login page
```

**✅ Specific**

```text
I'm building a React app with Vite and plain CSS (no Tailwind).
Create a LoginForm component with:
- email and password inputs (controlled, with useState)
- validation: email must contain @, password at least 8 characters
- an error message under each invalid field
- a submit button that's disabled while submitting
Explain each part in simple terms, as if I'm a beginner.
```

**A prompt formula**

| Part | Example |
| --- | --- |
| Context | "React + Vite, using React Router v6, plain CSS" |
| Task | "Create a component that shows a list of jobs as cards" |
| Details | "Each card shows title, company, location; clicking opens /jobs/:id" |
| Constraints | "No extra libraries", "keep it under 60 lines", "make it accessible" |
| Format | "Explain line by line", "only show the changed code", "give me two options" |

**Iterate.** The first answer is rarely the best. Follow up:

- "Make it work on mobile."
- "Why did you use `useEffect` here? Is there a simpler way?"
- "Rewrite this without the external library."

**Practice:** write a vague prompt and a specific prompt for "a to-do list". Compare the results.

## 3. Generating code and reading it line by line

**Never paste code you can't explain.** After AI gives you code:

1. Read it top to bottom before running it.
2. Ask yourself what each line does. Write a short comment if it helps.
3. Anything unfamiliar? Ask: *"Explain line 12 like I'm a beginner."*
4. Rename variables so they make sense to you.
5. Delete anything you don't need.

**Example.** AI gave you this:

```js
const visible = jobs
  .filter((j) => j.title.toLowerCase().includes(query.toLowerCase()))
  .sort((a, b) => b.createdAt - a.createdAt)
  .slice(0, 20);
```

Can you explain it?

1. Keep jobs whose title contains the search text (ignoring capitals).
2. Sort them newest first.
3. Keep only the first 20.

If you can't explain code like this, you're not ready to ship it yet. Ask the AI to walk you through it.

**Good follow-up prompts**

- "What would happen if `jobs` was empty?"
- "Is there anything in this code a beginner might misunderstand?"
- "What would break if the API returned an error?"

## 4. Debugging errors with AI

AI is excellent at debugging if you give it enough information.

**A good debugging prompt includes**

1. The **full error message**, copied exactly from the console.
2. The **code** where it happens (the whole component, not one line).
3. What you **expected** to happen.
4. What **actually** happened.
5. What you've **already tried**.

```text
My React app crashes with this error:

TypeError: Cannot read properties of undefined (reading 'map')
    at JobList (JobList.jsx:12)

Here is JobList.jsx:
[paste the whole file]

`jobs` comes from a fetch in App.jsx and is passed as a prop.
I expected an empty list while it loads, but the page goes white.
I checked the API URL in the browser and it works.

Why is this happening, and how do I fix it? Explain the cause first.
```

**Ask why, not just for a fix.** Understanding the cause means you won't make the same mistake next week. (Here, `jobs` starts as `undefined` instead of `[]` before the data arrives.)

**If the AI's fix doesn't work:** tell it exactly what happened. "I tried that; now I get this new error: …"

## 5. Improving and refactoring existing features

**Refactoring** means improving code without changing what it does.

**Safe refactoring with AI**

1. **Commit first** (`git commit`), so you can undo.
2. Ask for a review, not a rewrite:

```text
Review this component like a senior React developer.
List problems with readability, performance and accessibility,
ranked from most to least important. Don't rewrite it yet.

[paste component]
```

3. Apply **one** suggestion at a time: "Apply only suggestion 1 and explain the change."
4. Test that everything still works.
5. Commit, then do the next one.

**Common improvements AI will suggest**

- Split a big component into smaller ones.
- Move repeated code into a reusable component or function.
- Add `alt` text, labels and keyboard support.
- Handle loading and error states you forgot.

## 6. Testing and verifying AI-generated code

AI code often looks right and still fails. Check it like this:

| Check | How |
| --- | --- |
| It runs | No red errors in the console |
| Happy path | The main feature works the normal way |
| Edge cases | Empty input, very long text, special characters, double clicks |
| Network | Turn on DevTools → Network → "Offline". Does it fail nicely? |
| Screens | Phone, tablet and laptop in device mode |
| Accessibility | Can you use it with only the keyboard (Tab and Enter)? |
| Understanding | Could you explain it to a classmate? |

**Watch out for "hallucinations":** imports from packages that don't exist, or functions that sound real but aren't. If `npm install` fails or the import is red in VS Code, check the official docs.

## 7. Planning your mini project

Good projects start on paper, not in code.

**1. Pick a small, real problem.** Ideas:

| Project | Core features |
| --- | --- |
| Budget tracker | Add income/expenses, totals, filter by month |
| Recipe finder | Search recipes from an API, save favourites |
| Study timer | Pomodoro timer, session history, daily total |
| Event RSVP page | Event details, RSVP form, list of guests |
| Movie watchlist | Search movies, add to watchlist, mark watched |

**2. Write your features.** Three **must-haves** and two **nice-to-haves**. Finish the must-haves first.

**3. Sketch every screen** on paper: what's on it and where the buttons go.

**4. Plan the data.** What does one item look like?

```js
{ id: 1712345678, title: "Groceries", amount: 12000, type: "expense", date: "2026-11-20" }
```

**5. Plan the week**

| Day | Goal |
| --- | --- |
| 1 | Plan, sketch, set up the Vite project and GitHub repo |
| 2–4 | Build the must-have features, committing as you go |
| 5 | Nice-to-haves, styling, mobile, README, deploy |
| 6 | Present |

**Use AI to plan, too:**

```text
I'm a beginner React developer. I want to build a budget tracker in one week
with React, React Router and localStorage. Suggest a list of components,
the data shape, and a day-by-day plan. Keep it simple.
```

## 8. Building and presenting your project

**While building**

- Commit after every working feature.
- Use AI for drafts and bugs, but read and test every line.
- Keep a short log of where AI helped and where it got things wrong. You'll talk about it in your demo.

**Your README**

```markdown
# Study Timer

A Pomodoro timer for students, built with React.

**Live:** https://study-timer.netlify.app

## Features
- 25/5 minute focus and break sessions
- Session history saved in localStorage
- Works on phones

## Built with
React, Vite, React Router, CSS

## How I used AI
I used AI to draft the timer hook. It kept running after pausing,
so I fixed it by clearing the interval in the cleanup function.
```

**Your 3-minute demo**

1. **The problem** (20 seconds): who is it for and why?
2. **Live demo** (2 minutes): walk through the main features.
3. **One lesson** (40 seconds): something AI got wrong and how you fixed it, or the hardest bug you solved.

## 9. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish your mini project's must-have features.
2. Deploy it and write a README with a screenshot and live link.
3. Prepare your 3-minute demo.
4. Submit your live and GitHub links on BlockHub.

**End-of-week checklist**

- [ ] Explain what AI coding tools are good and bad at
- [ ] Write a specific prompt with context, task, details and format
- [ ] Read AI-generated code and explain every line
- [ ] Write a good debugging prompt with the full error
- [ ] Refactor safely: commit first, one change at a time
- [ ] Test AI code for edge cases, errors and mobile
- [ ] Plan a project: features, screens, data and schedule
- [ ] Present a project in 3 minutes

**Glossary**

| Term | Meaning |
| --- | --- |
| Prompt | The instructions you give an AI tool |
| Context | Background the AI needs: your stack, your code, your goal |
| Hallucination | When AI confidently invents something that isn't real |
| Refactor | Improve code without changing what it does |
| Edge case | An unusual input or situation that can break code |
| MVP | Minimum viable product: the smallest version that works |
| README | The file that explains a project on GitHub |
