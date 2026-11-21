## Before you start

Last week you learned the React basics: components, props and state. This week you use them the way real apps do: forms, lists you can change, saving data, multiple pages and data from APIs. By the end you'll build a job board or task manager.

**What you need**

- Your Week 3 knowledge of components, props, `useState` and `map`
- A new Vite React project: `npm create vite@latest week4 -- --template react`

## 1. Controlled forms and input handling

A **controlled** input keeps its value in React state, so state is always the single source of truth.

For forms with several fields, keep them all in one object:

```jsx
import { useState } from "react";

export default function JobForm({ onAdd }) {
  const [form, setForm] = useState({ title: "", company: "", location: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert("Please add a job title");
    onAdd(form);
    setForm({ title: "", company: "", location: "" });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" value={form.title} onChange={handleChange} placeholder="Job title" />
      <input name="company" value={form.company} onChange={handleChange} placeholder="Company" />
      <select name="location" value={form.location} onChange={handleChange}>
        <option value="">Location</option>
        <option>Remote</option>
        <option>Lagos</option>
        <option>Abuja</option>
      </select>
      <button>Add job</button>
    </form>
  );
}
```

**How it works**

- Each input has a `name` that matches a key in the `form` object.
- `[e.target.name]` updates whichever field changed.
- `{ ...form }` copies the other fields so they aren't lost.
- After submitting, reset the form by setting state back to empty values.

**Checkboxes** use `checked` and `e.target.checked` instead of `value`.

**Practice**

1. Build a sign-up form with name, email and a "I agree" checkbox. Disable the button until the box is ticked.
2. Show an error message under the email input if it doesn't contain `@`.

## 2. Adding, editing and deleting items in a list

**Golden rule: never change state directly.** Always create a new array or object and pass it to the setter. React only re-draws when it sees a new value.

```jsx
const [tasks, setTasks] = useState([]);

// ADD: spread the old array into a new one
const addTask = (text) => {
  setTasks([...tasks, { id: Date.now(), text, done: false }]);
};

// DELETE: filter out the one with this id
const deleteTask = (id) => {
  setTasks(tasks.filter((task) => task.id !== id));
};

// EDIT / TOGGLE: map, and replace the one that matches
const toggleTask = (id) => {
  setTasks(
    tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
  );
};

const renameTask = (id, newText) => {
  setTasks(tasks.map((task) => (task.id === id ? { ...task, text: newText } : task)));
};
```

| Action | Array method | Why |
| --- | --- | --- |
| Add | `[...old, newItem]` | Creates a new array with the item added |
| Delete | `filter` | Keeps everything except the one you remove |
| Edit | `map` | Returns a new array with one item changed |

**Don't do this:** `tasks.push(task)` or `task.done = true`. Those change the existing array or object, and React won't update the screen.

`Date.now()` gives a unique-enough id for practice apps.

**Practice**

1. Build a shopping list: add items, tick them off and delete them.
2. Add a "Clear completed" button that removes all ticked items.

## 3. Side effects with useEffect

A **side effect** is anything that reaches outside the component: fetching data, timers, saving to `localStorage`, changing the page title.

```jsx
import { useEffect, useState } from "react";

useEffect(() => {
  // your side effect
}, [dependencies]);
```

The **dependency array** decides when the effect runs:

| Dependency array | When the effect runs |
| --- | --- |
| `[]` | Once, after the component first appears |
| `[tasks]` | After the first render, and whenever `tasks` changes |
| none at all | After every render (rarely what you want) |

**Saving to localStorage**

```jsx
const [tasks, setTasks] = useState(() => {
  const saved = localStorage.getItem("tasks");
  return saved ? JSON.parse(saved) : [];
});

useEffect(() => {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}, [tasks]);
```

Passing a function to `useState` (the "lazy initial state") reads localStorage only once.

**Cleaning up.** If an effect starts a timer or listener, return a function to stop it:

```jsx
useEffect(() => {
  const id = setInterval(() => setSeconds((s) => s + 1), 1000);
  return () => clearInterval(id);
}, []);
```

**Practice**

1. Make the page title show how many tasks are left: `document.title = \`${left} tasks left\``.
2. Build a simple stopwatch with start, stop and reset.

## 4. Building reusable components

A reusable component works with any data you give it.

```jsx
export default function Button({ children, variant = "primary", ...rest }) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
}
```

```jsx
<Button onClick={save}>Save</Button>
<Button variant="danger" onClick={() => remove(id)}>Delete</Button>
<Button type="submit" disabled={!valid}>Send</Button>
```

- `children` is whatever you put between the tags.
- `variant = "primary"` is a default prop value.
- `...rest` collects every other prop (`onClick`, `type`, `disabled`) and passes them on.

**Good candidates for reusable components:** buttons, cards, inputs with labels, modals, empty states ("No jobs yet"), loading spinners.

**Lifting state up.** If two components need the same data, keep the state in their closest shared parent and pass it down as props. Pass functions down too, so children can ask the parent to change the data (like `onAdd`, `onRemove`).

**Practice**

1. Build a reusable `Card` with `title` and `children` props.
2. Build an `EmptyState` component with a message prop. Use it when your list is empty.

## 5. Organising project files and folders

As your app grows, structure keeps it easy to find things.

```text
src/
  components/      small reusable pieces
    Button.jsx
    JobCard.jsx
    Navbar.jsx
  pages/           one component per page
    Home.jsx
    JobDetails.jsx
    NotFound.jsx
  services/        code that talks to APIs
    api.js
  hooks/           your own custom hooks (useSomething)
  App.jsx
  main.jsx
  index.css
```

**Conventions**

- One component per file, and the file is named after it (`JobCard.jsx` exports `JobCard`).
- Component files use PascalCase; other files use camelCase.
- Keep a component's CSS next to it if it's only used there.

## 6. Page navigation with React Router

React Router lets one React app have many pages without reloading the browser.

```bash
npm install react-router-dom
```

**Set up the routes in `main.jsx` or `App.jsx`:**

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import JobDetails from "./pages/JobDetails";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Linking between pages.** Use `Link`, not `<a>`, for pages inside your app. `<a>` reloads the whole site.

```jsx
import { Link, NavLink } from "react-router-dom";

<Link to="/">Home</Link>
<Link to={`/jobs/${job.id}`}>View job</Link>

// NavLink adds an "active" class to the current page's link
<NavLink to="/">Home</NavLink>
```

**Reading URL parameters**

```jsx
import { useParams, useNavigate } from "react-router-dom";

export default function JobDetails() {
  const { id } = useParams();       // "/jobs/42" gives id = "42"
  const navigate = useNavigate();

  return (
    <div>
      <h1>Job #{id}</h1>
      <button onClick={() => navigate("/")}>Back to jobs</button>
    </div>
  );
}
```

**Practice**

1. Add Home, About and Contact pages with a navbar that links between them.
2. Add a 404 page for unknown URLs.

## 7. Fetching data from external APIs

An **API** is a URL that sends back data, usually JSON. You fetch it inside `useEffect`, then put it in state.

```jsx
import { useEffect, useState } from "react";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("https://jsonplaceholder.typicode.com/users")
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch(() => setError("Could not load users. Check your internet."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name} · {u.email}</li>
      ))}
    </ul>
  );
}
```

**Always handle three states:** loading, error and success. Users should never stare at a blank screen.

**Free practice APIs:** [JSONPlaceholder](https://jsonplaceholder.typicode.com) (fake users and posts) and [Remotive](https://remotive.com/api/remote-jobs) (real remote jobs).

You'll learn much more about HTTP, JSON and `async/await` next week.

**Practice**

1. Fetch posts from `https://jsonplaceholder.typicode.com/posts` and show the first 10.
2. Add a "Reload" button that fetches again.

## 8. Styling React apps

| Approach | How | Good for |
| --- | --- | --- |
| Plain CSS | `import "./App.css";` and `className="card"` | Small apps, beginners |
| CSS Modules | `Card.module.css`, then `import styles from "./Card.module.css"` and `className={styles.card}` | Avoiding class name clashes |
| Tailwind CSS | Utility classes like `className="p-4 rounded-xl bg-black"` | Building fast; very popular in jobs |
| Inline styles | `style={{ color: "red" }}` | One-off, dynamic values |

**Conditional classes**

```jsx
<li className={task.done ? "task done" : "task"}>{task.text}</li>
```

Pick one main approach per project and stick with it.

## 9. Week 4 build: job board or task manager

Choose one. Both use the same skills.

**Requirements**

1. A form to add items (job: title, company, location; or task: text and priority).
2. A list of items as reusable cards.
3. Mark as done or applied, edit and delete.
4. Saved to `localStorage`, so it survives a refresh.
5. React Router with Home, a details page (`/jobs/:id`) and a 404 page.
6. Bonus: load real remote jobs from the Remotive API.

### App.jsx (job board)

```jsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import JobDetails from "./pages/JobDetails";
import NotFound from "./pages/NotFound";

export default function App() {
  const [jobs, setJobs] = useState(() => JSON.parse(localStorage.getItem("jobs") || "[]"));

  useEffect(() => {
    localStorage.setItem("jobs", JSON.stringify(jobs));
  }, [jobs]);

  const addJob = (job) => setJobs([{ ...job, id: Date.now(), applied: false }, ...jobs]);
  const removeJob = (id) => setJobs(jobs.filter((j) => j.id !== id));
  const toggleApplied = (id) =>
    setJobs(jobs.map((j) => (j.id === id ? { ...j, applied: !j.applied } : j)));

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home jobs={jobs} onAdd={addJob} onRemove={removeJob} onToggle={toggleApplied} />}
        />
        <Route path="/jobs/:id" element={<JobDetails jobs={jobs} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### JobCard.jsx

```jsx
import { Link } from "react-router-dom";

export default function JobCard({ job, onRemove, onToggle }) {
  return (
    <article className={job.applied ? "card applied" : "card"}>
      <h3>{job.title}</h3>
      <p>{job.company} · {job.location || "Anywhere"}</p>
      <div className="actions">
        <button onClick={() => onToggle(job.id)}>{job.applied ? "Applied ✓" : "Mark applied"}</button>
        <Link to={`/jobs/${job.id}`}>Details</Link>
        <button onClick={() => onRemove(job.id)}>Delete</button>
      </div>
    </article>
  );
}
```

### JobDetails.jsx

```jsx
import { Link, useParams } from "react-router-dom";

export default function JobDetails({ jobs }) {
  const { id } = useParams();
  const job = jobs.find((j) => String(j.id) === id);

  if (!job) return <p>Job not found. <Link to="/">Back to jobs</Link></p>;

  return (
    <div>
      <h1>{job.title}</h1>
      <p>{job.company} · {job.location}</p>
      <Link to="/">← Back</Link>
    </div>
  );
}
```

Build `Home.jsx` yourself: it shows `<JobForm onAdd={onAdd} />` and maps `jobs` into `JobCard`s, with an empty state when there are none.

## 10. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish your job board or task manager with every requirement above.
2. Add a search box that filters the list as you type.
3. Deploy it on Netlify or Vercel. For React Router on Netlify, add a `public/_redirects` file containing `/* /index.html 200`.
4. Submit your live link on BlockHub.

**End-of-week checklist**

- [ ] Build controlled forms with one state object
- [ ] Add, edit and delete list items without mutating state
- [ ] Use `useEffect` with the right dependency array
- [ ] Save and load data with `localStorage`
- [ ] Build reusable components with props and `children`
- [ ] Organise files into components, pages and services
- [ ] Add pages, links and URL params with React Router
- [ ] Fetch API data with loading and error states

**Glossary**

| Term | Meaning |
| --- | --- |
| Controlled input | An input whose value is stored in React state |
| Immutable update | Creating a new array/object instead of changing the old one |
| Side effect | Work that reaches outside the component (fetch, timers, storage) |
| useEffect | The hook for running side effects |
| Dependency array | The list that controls when an effect runs |
| Lifting state up | Moving shared state to a common parent |
| React Router | The library for pages and navigation in React |
| URL parameter | A dynamic part of a URL, like `:id` |
| API | A URL that returns data for your app |
