## Before you start

Last week you built and styled a page with HTML and CSS. This week you make it **do things** with JavaScript: respond to clicks, change content and work with data. By the end you'll add a dark mode toggle and a to-do list to your landing page.

**How to use these notes**

- Read a section, then type every example yourself.
- Run JavaScript in the browser console (F12 → Console) or in a `.js` file linked to your page.
- Do the practice at the end of each section before moving on.

**Connecting JavaScript to your page**

Put this just before `</body>` in `index.html`, and create `app.js` next to it:

```html
<script src="app.js"></script>
```

Putting the script at the end means the HTML has loaded before your JavaScript tries to find it.

## 1. Variables and data types

A variable is a named box that holds a value.

```js
const name = "Ada";        // string: text
let score = 72;            // number
const isStudent = true;    // boolean: true or false
let nickname = null;       // empty on purpose
let city;                  // undefined: never given a value

score = score + 5;         // let can change
// name = "Bola";          // ❌ error: const can't change

console.log(typeof score); // "number"
```

| Keyword | Can change? | Use it for |
| --- | --- | --- |
| `const` | No | Most values. Use it by default. |
| `let` | Yes | Counters, totals, anything that updates |
| `var` | Yes | Don't use it. It's the old way and causes bugs. |

**Strings** can use quotes or backticks. Backticks (template literals) let you put values inside with `${ }`:

```js
const greeting = `Hi ${name}, your score is ${score}`;
```

**Practice**

1. Create variables for your name, age, track and whether you've finished Week 1. Log them all.
2. Use a template literal to log: `"Ada is 21 and studies Full-Stack."`

## 2. Operators and conditions

**Operators**

```js
10 + 3   // 13
10 - 3   // 7
10 * 3   // 30
10 / 3   // 3.333...
10 % 3   // 1 (remainder)
```

**Comparisons** give `true` or `false`. Always use the triple versions:

| Operator | Meaning |
| --- | --- |
| `===` | equal (value and type) |
| `!==` | not equal |
| `>` `<` `>=` `<=` | greater / less than |
| `&&` | and: both must be true |
| `\|\|` | or: at least one true |
| `!` | not: flips true/false |

`5 == "5"` is `true` (it converts types), but `5 === "5"` is `false`. Using `===` avoids surprises.

**if / else**

```js
const score = 72;

if (score >= 70) {
  console.log("Distinction");
} else if (score >= 50) {
  console.log("Pass");
} else {
  console.log("Try again");
}
```

**switch** is tidy when one value has many possible cases:

```js
const day = "Sat";

switch (day) {
  case "Sat":
  case "Sun":
    console.log("Weekend!");
    break;
  case "Wed":
    console.log("Class day");
    break;
  default:
    console.log("Keep building");
}
```

Don't forget `break`, or the code falls through into the next case.

**Ternary**: a one-line if/else.

```js
const result = score >= 50 ? "Pass" : "Fail";
```

**Practice**

1. Write a grade checker: A for 70+, B for 60–69, C for 50–59, otherwise F.
2. Use `switch` to log a message for each day of the week.

## 3. Loops: for and while

Loops repeat code.

```js
// for: when you know how many times
for (let i = 1; i <= 5; i++) {
  console.log(`Lesson ${i}`);
}

// for...of: go through every item in an array
const tracks = ["Frontend", "Backend", "Design"];
for (const track of tracks) {
  console.log(track);
}

// while: repeat until a condition is false
let tries = 0;
while (tries < 3) {
  console.log(`Attempt ${tries + 1}`);
  tries++;
}
```

**Watch out:** if a `while` condition never becomes false, the loop runs forever and freezes the tab. Always make sure something inside the loop moves it towards ending.

**Practice**

1. Print the numbers 1 to 20, but print "Fizz" for multiples of 3, "Buzz" for multiples of 5 and "FizzBuzz" for both.
2. Loop through an array of five names and log each one in capitals (`name.toUpperCase()`).

## 4. Functions and arrow functions

A function is reusable code. You give it inputs (**parameters**) and it can give back a result with `return`.

```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("Ada"));   // Hello, Ada!
console.log(greet("Tunde")); // Hello, Tunde!
```

**Arrow functions** are a shorter way to write the same thing:

```js
const greet = (name) => {
  return `Hello, ${name}!`;
};

// one line: returns automatically, no braces or return needed
const add = (a, b) => a + b;

// default parameter
const welcome = (name = "student") => `Welcome to BlockHub, ${name}`;
```

If you use curly braces `{ }`, you must write `return` yourself. Without it the function returns `undefined`.

You'll use arrow functions everywhere: in event listeners, array methods and later in React.

**Practice**

1. Write `isAdult(age)` that returns `true` if age is 18 or more.
2. Write `formatNaira(amount)` that returns a string like `"₦5,000"`. Hint: `amount.toLocaleString()`.

## 5. Arrays and array methods

An array is an ordered list. Counting starts at 0.

```js
const prices = [1500, 4000, 800, 2500];

console.log(prices[0]);      // 1500
console.log(prices.length);  // 4

prices.push(3000);           // add to the end
prices.pop();                // remove from the end
console.log(prices.includes(800)); // true
```

**The three methods you'll use most**

| Method | What it does | Returns |
| --- | --- | --- |
| `map` | Changes every item | A new array, same length |
| `filter` | Keeps items that pass a test | A new array, maybe shorter |
| `find` | Finds the first item that passes a test | One item, or `undefined` |

```js
const withVat = prices.map((p) => p * 1.075);
const cheap = prices.filter((p) => p < 2000);   // [1500, 800]
const firstBig = prices.find((p) => p > 3000);  // 4000
```

None of them change the original array.

**Practice**

1. From `[3, 8, 12, 5, 20]`, use `filter` to keep numbers above 6.
2. Use `map` to turn `["ada", "chi"]` into `["ADA", "CHI"]`.

## 6. Objects

Objects group related information as `key: value` pairs.

```js
const student = {
  name: "Ada",
  track: "Full-Stack",
  scores: [72, 85],
  isActive: true,
};

console.log(student.name);       // "Ada"
console.log(student.scores[1]);  // 85

student.city = "Lagos";          // add a key
student.track = "Frontend";      // change a key
delete student.isActive;         // remove a key
```

**Arrays of objects** are how almost all real app data looks:

```js
const students = [
  { name: "Ada", score: 82 },
  { name: "Tunde", score: 45 },
  { name: "Chi", score: 67 },
];

const passed = students.filter((s) => s.score >= 50);
const names = passed.map((s) => s.name); // ["Ada", "Chi"]
```

**Destructuring** pulls values out in one line:

```js
const { name, city } = student;
```

**Practice**

1. Create an object for a product with name, price and inStock. Log a sentence about it.
2. From an array of three products, use `filter` to get those in stock.

## 7. The DOM: select and change elements

When the browser loads your HTML, it builds the **DOM** (Document Object Model): a tree of elements that JavaScript can find and change.

**Selecting elements**

```js
const title = document.querySelector("#title");   // by id
const note = document.querySelector(".note");     // first with this class
const items = document.querySelectorAll("li");    // all of them
```

`querySelector` uses the same selectors as CSS.

**Changing elements**

```js
title.textContent = "Hi, Ada!";          // change the text
note.style.color = "#00ff66";            // change one style
note.classList.add("highlight");         // add a class
note.classList.remove("hidden");         // remove a class
note.classList.toggle("open");           // add if missing, remove if there
```

Prefer `classList` over `style`: keep the styling in CSS and just switch classes with JavaScript.

**Creating elements**

```js
const li = document.createElement("li");
li.textContent = "Learn the DOM";
document.querySelector("#list").append(li);
```

**Practice**

1. Change your landing page's main heading using JavaScript.
2. Create three `<li>` items from an array and add them to a `<ul>`.

## 8. Events and event listeners

An **event** is something that happens: a click, a key press, a form submit. You listen for it and run a function when it happens.

```html
<button id="btn">Click me</button>
<p id="count">Clicked 0 times</p>
```

```js
const btn = document.querySelector("#btn");
const count = document.querySelector("#count");
let clicks = 0;

btn.addEventListener("click", () => {
  clicks++;
  count.textContent = `Clicked ${clicks} times`;
});
```

**Common events**

| Event | When it fires |
| --- | --- |
| `click` | The element is clicked or tapped |
| `input` | The value of an input changes (every keystroke) |
| `submit` | A form is submitted |
| `keydown` | A key is pressed |

**Forms:** by default, submitting a form reloads the page. Stop that with `event.preventDefault()`:

```js
const form = document.querySelector("#form");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#name").value;
  console.log(`Hello ${name}`);
});
```

**Practice**

1. Make an input and a paragraph. As the user types, show what they typed in the paragraph (use the `input` event).
2. Make a button that hides and shows a section using `classList.toggle`.

## 9. Debugging with the console

Every developer's code breaks. Debugging is the skill of finding out why.

**Open the console:** F12 (or Ctrl + Shift + I), then the **Console** tab.

```js
console.log("score is", score);   // print a value
console.table(students);          // show an array of objects as a table
console.error("Something failed"); // print in red
```

**Reading errors.** A red error tells you the problem, the file and the line:

| Error | Usually means |
| --- | --- |
| `ReferenceError: x is not defined` | Typo in a variable name, or used before it was created |
| `TypeError: Cannot read properties of null` | `querySelector` found nothing: check the id/class, and that the script loads after the HTML |
| `SyntaxError: Unexpected token` | A missing bracket, quote or comma |

**A simple debugging routine**

1. Read the error message and go to the line it names.
2. `console.log` the values just before that line.
3. Check spelling of ids, classes and variables.
4. Change one thing at a time and test again.

## 10. Week 2 build: an interactive website

Add JavaScript to your Week 1 landing page.

### Step 1: dark mode toggle

Add a button to your nav:

```html
<button id="theme" class="btn">🌙 Dark mode</button>
```

Add a dark theme to `style.css`, using the variables from Week 1:

```css
body.dark {
  --bg: #0b0d0c;
  --card: #151917;
  --text: #eef1ec;
}
```

Then in `app.js`:

```js
const themeBtn = document.querySelector("#theme");

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  themeBtn.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
});
```

### Step 2: a to-do list

```html
<section class="section">
  <h2>My learning list</h2>
  <form id="todo-form">
    <input id="todo-input" placeholder="What will you learn next?">
    <button class="btn">Add</button>
  </form>
  <ul id="todo-list"></ul>
</section>
```

```js
const form = document.querySelector("#todo-form");
const input = document.querySelector("#todo-input");
const list = document.querySelector("#todo-list");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const li = document.createElement("li");
  li.textContent = text;

  // click a task to tick it off, double-click to delete it
  li.addEventListener("click", () => li.classList.toggle("done"));
  li.addEventListener("dblclick", () => li.remove());

  list.append(li);
  input.value = "";
});
```

```css
#todo-list li { cursor: pointer; padding: 8px 0; }
#todo-list li.done { text-decoration: line-through; opacity: 0.5; }
```

### Step 3: a greeting

Add a name input and a button. When clicked, show "Welcome, [name]!" in your hero section. If the input is empty, show "Please type your name" instead.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Add the dark mode toggle and to-do list to your landing page.
2. Show "No tasks yet" when the to-do list is empty.
3. Push to GitHub and update your GitHub Pages site.
4. Submit your live link on BlockHub.

**Bonus:** save the theme in `localStorage` so it stays dark after a refresh (`localStorage.setItem("theme", "dark")`, then read it with `localStorage.getItem("theme")` when the page loads).

**End-of-week checklist**

- [ ] Use `const` and `let` and know the basic data types
- [ ] Write if/else, switch and the ternary
- [ ] Write for, for…of and while loops
- [ ] Write functions and arrow functions that return values
- [ ] Use `map`, `filter` and `find`
- [ ] Create and update objects, and work with arrays of objects
- [ ] Select elements and change their text, styles and classes
- [ ] Listen for click, input and submit events
- [ ] Read console errors and debug with `console.log`

**Glossary**

| Term | Meaning |
| --- | --- |
| Variable | A named box that holds a value |
| Data type | The kind of value: string, number, boolean, null, undefined, object |
| Condition | Code that runs only if something is true |
| Loop | Code that repeats |
| Function | Reusable code with inputs and an output |
| Array | An ordered list of values |
| Object | A group of key: value pairs |
| DOM | The browser's tree of your page's elements |
| Event | Something that happens on the page, like a click |
| Event listener | A function that runs when an event happens |
