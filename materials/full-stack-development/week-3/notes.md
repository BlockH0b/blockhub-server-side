## Before you start

This week you start building with **React**, the most popular way to build modern web apps. You'll learn to split a page into components, pass data between them and make them update when data changes. By the end you'll build a small React app.

**What you need**

- Everything from Weeks 1 and 2
- Node.js installed (check with `node -v` in your terminal). If you don't have it, install the LTS version from [nodejs.org](https://nodejs.org).
- Comfortable with arrow functions, arrays, `map` and objects from Week 2. If those feel shaky, revise them first.

## 1. What React is and why developers use it

**React** is a JavaScript library for building user interfaces. Meta built it, and it's now used by companies like Netflix, Airbnb and countless startups.

**The problem it solves.** Last week you changed the page by hand: find the element, change its text, add a class. In a big app with hundreds of things changing, that gets messy fast.

**React's answer:**

| Idea | What it means |
| --- | --- |
| Components | Build your UI from small, reusable pieces: `<Navbar />`, `<CourseCard />`, `<Footer />` |
| Declarative | You describe what the screen should look like for the current data. React works out what to change. |
| State | When your data changes, React re-draws only the parts that need it |

Think of components like LEGO bricks: build each brick once, then combine them into anything.

## 2. Setting up a project with Vite

**Vite** is a tool that creates and runs React projects quickly.

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev
```

Open the address it prints, usually `http://localhost:5173`. Edit a file, save, and the page updates instantly.

**The files that matter**

```text
my-app/
  index.html        the single HTML page
  package.json      project info and packages
  src/
    main.jsx        puts <App /> into index.html
    App.jsx         your main component: start here
    App.css         styles for App
```

To start fresh, delete everything inside `App.jsx` and write your own component.

**Practice**

1. Create a Vite React project called `react-week3` and run it.
2. Change the text in `App.jsx` and watch the browser update.

## 3. Components and JSX

A **component** is a JavaScript function that returns **JSX**: HTML-like code that describes what to show.

```jsx
function Header() {
  return (
    <header className="header">
      <h1>BlockHub</h1>
      <p>Learn. Build. Grow.</p>
    </header>
  );
}

export default function App() {
  return (
    <div>
      <Header />
      <Header />
    </div>
  );
}
```

**JSX rules**

| Rule | Example |
| --- | --- |
| Component names start with a capital | `Header`, not `header` |
| Use `className` instead of `class` | `<div className="card">` |
| Return one parent element | wrap siblings in `<div>` or `<>…</>` (a Fragment) |
| Close every tag | `<img />`, `<br />`, `<input />` |
| Attributes are camelCase | `onClick`, `tabIndex` |

**JavaScript inside JSX.** Curly braces run JavaScript:

```jsx
const name = "Ada";
const lessons = 12;

<p>{name} has done {lessons * 2} hours of learning</p>
```

**Splitting into files.** Put each component in its own file and import it:

```jsx
// src/components/Header.jsx
export default function Header() {
  return <h1>BlockHub</h1>;
}

// src/App.jsx
import Header from "./components/Header";
```

**Practice**

1. Create `Header`, `Main` and `Footer` components and use all three in `App`.
2. Show today's date inside a component with `{new Date().toDateString()}`.

## 4. Passing data with props

**Props** are inputs you pass to a component, like attributes in HTML. They let one component show different data.

```jsx
function CourseCard({ title, weeks, level }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{weeks} weeks · {level}</p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <CourseCard title="Full-Stack" weeks={10} level="Beginner" />
      <CourseCard title="Backend" weeks={10} level="Intermediate" />
    </>
  );
}
```

- Strings go in quotes: `title="Full-Stack"`.
- Anything else goes in braces: `weeks={10}`, `isNew={true}`.
- `{ title, weeks }` in the parameters is destructuring, from Week 2.

**Props are read-only.** A component should never change its own props.

**children** is a special prop: whatever you put between the tags.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

<Card>
  <h3>Anything goes here</h3>
</Card>
```

**Practice**

1. Build a `StudentCard` that takes `name`, `track` and `photo` props. Render three different students.
2. Build a `Button` component that takes a `label` prop.

## 5. Managing state with useState

**State** is data that belongs to a component and can change. When state changes, React re-draws the component.

```jsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

`useState(0)` returns two things:

1. `count`: the current value (starts at 0)
2. `setCount`: the function you call to change it

**Rules**

- Never change state directly (`count = 5` won't update the screen). Always use the setter.
- Call hooks like `useState` at the top of your component, not inside if statements or loops.
- State can be any type: number, string, boolean, array or object.

**Props vs state**

| Props | State |
| --- | --- |
| Passed in from the parent | Lives inside the component |
| Read-only | Changes with the setter |
| Like function parameters | Like the component's memory |

**Practice**

1. Make a counter with +1, −1 and Reset buttons. Don't let it go below 0.
2. Make a "Show password" button that switches a boolean in state.

## 6. Handling events

React events look like HTML attributes but use camelCase and take a **function**.

```jsx
function SaveButton() {
  const handleClick = () => {
    alert("Saved!");
  };

  return <button onClick={handleClick}>Save</button>;
}
```

**Pass the function, don't call it.**

```jsx
<button onClick={handleClick}>   ✅ runs when clicked
<button onClick={handleClick()}> ❌ runs immediately on every render
```

If you need to pass a value, wrap it in an arrow: `onClick={() => remove(id)}`.

**Inputs with state** ("controlled inputs"):

```jsx
export default function Greeting() {
  const [name, setName] = useState("");

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <p>Hello, {name || "stranger"}!</p>
    </div>
  );
}
```

`e.target.value` is what the user typed. The input shows whatever is in state, so state is always the source of truth.

**Practice**

1. Build a character counter: as the user types in a textarea, show "23 / 140 characters".
2. Show a message in red when it goes over 140.

## 7. Conditional rendering

Show different things depending on state.

```jsx
export default function Login() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <div>
      {loggedIn ? <p>Welcome back!</p> : <p>Please log in</p>}

      {loggedIn && <button>View dashboard</button>}

      <button onClick={() => setLoggedIn(!loggedIn)}>
        {loggedIn ? "Log out" : "Log in"}
      </button>
    </div>
  );
}
```

| Pattern | Use it when |
| --- | --- |
| `cond ? <A /> : <B />` | You want one thing or the other |
| `cond && <A />` | You want something or nothing |
| `if` before the `return` | The logic is long |

**Careful with `&&` and numbers:** `{count && <p>…</p>}` shows `0` when count is 0. Use `{count > 0 && <p>…</p>}` instead.

**Practice**

1. Show "Loading…" for 2 seconds, then your content. Hint: `setTimeout` and a boolean in state.
2. Show a "No tasks yet" message when an array is empty.

## 8. Rendering lists with keys

Use `map` to turn an array into JSX elements:

```jsx
const tracks = [
  { id: 1, name: "Full-Stack", weeks: 10 },
  { id: 2, name: "Backend", weeks: 10 },
  { id: 3, name: "Design", weeks: 8 },
];

export default function TrackList() {
  return (
    <ul>
      {tracks.map((track) => (
        <li key={track.id}>
          {track.name}: {track.weeks} weeks
        </li>
      ))}
    </ul>
  );
}
```

**Keys** help React tell items apart when the list changes. Every item needs one, and it must be unique among its siblings. Use an id from your data. Only use the array index if the list never changes order.

Forget a key and React warns you in the console: `Each child in a list should have a unique "key" prop.`

**Combine with components:**

```jsx
{tracks.map((track) => (
  <CourseCard key={track.id} title={track.name} weeks={track.weeks} />
))}
```

**Practice**

1. Render an array of five students as `StudentCard` components.
2. Add a filter button that shows only students with a score above 50.

## 9. Week 3 build: a React mini application

Build a small profile app with three components.

### Project structure

```text
src/
  App.jsx
  App.css
  components/
    ProfileCard.jsx
    SkillList.jsx
    LikeButton.jsx
```

### ProfileCard.jsx

```jsx
export default function ProfileCard({ name, role, photo, children }) {
  return (
    <div className="profile-card">
      <img src={photo} alt={`Photo of ${name}`} />
      <h1>{name}</h1>
      <p className="role">{role}</p>
      {children}
    </div>
  );
}
```

### SkillList.jsx

```jsx
export default function SkillList({ skills }) {
  if (skills.length === 0) return <p>No skills yet</p>;

  return (
    <ul className="skills">
      {skills.map((skill) => (
        <li key={skill}>{skill}</li>
      ))}
    </ul>
  );
}
```

### LikeButton.jsx

```jsx
import { useState } from "react";

export default function LikeButton() {
  const [likes, setLikes] = useState(0);

  return (
    <div>
      <button onClick={() => setLikes(likes + 1)}>❤️ {likes}</button>
      {likes >= 10 && <p>You're popular! 🎉</p>}
    </div>
  );
}
```

### App.jsx

```jsx
import ProfileCard from "./components/ProfileCard";
import SkillList from "./components/SkillList";
import LikeButton from "./components/LikeButton";
import "./App.css";

const skills = ["HTML", "CSS", "JavaScript", "React"];

export default function App() {
  return (
    <main className="page">
      <ProfileCard name="Ada" role="Full-Stack student" photo="/me.jpg">
        <SkillList skills={skills} />
        <LikeButton />
      </ProfileCard>
    </main>
  );
}
```

Put your photo in the `public` folder as `me.jpg`, then style it in `App.css` using what you learned in Week 1.

## 10. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the mini app with all three components and your real details.
2. Add a "Show more / Show less" button that reveals an "About me" paragraph using state.
3. Push it to GitHub.
4. Submit your GitHub link on BlockHub.

**Bonus:** deploy it free. Run `npm run build`, then drag the `dist` folder onto [Netlify Drop](https://app.netlify.com/drop).

**End-of-week checklist**

- [ ] Explain what React is and what components are
- [ ] Create and run a project with Vite
- [ ] Write components that return JSX, following the JSX rules
- [ ] Put JavaScript inside JSX with `{ }`
- [ ] Pass data to components with props
- [ ] Use `useState` and update it with the setter
- [ ] Handle clicks and input changes
- [ ] Show content conditionally with `? :` and `&&`
- [ ] Render a list with `map` and a unique `key`

**Glossary**

| Term | Meaning |
| --- | --- |
| React | A JavaScript library for building user interfaces |
| Vite | A tool that creates and runs front-end projects fast |
| Component | A function that returns a piece of UI |
| JSX | HTML-like syntax inside JavaScript |
| Props | Inputs passed to a component |
| State | A component's own data that can change |
| Hook | A special React function starting with `use`, like `useState` |
| Controlled input | An input whose value lives in state |
| Key | A unique id React uses to track list items |
