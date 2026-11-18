## Before you start

This week you learn the JavaScript that every Node.js backend is built on. By Friday you will have written three working command-line scripts. Your tutor for the Backend Development track is Daniel Success (Derik | Dev).

**How to use these notes**

- Read a section, then type every code example yourself. Don't copy and paste; typing is how it sticks.
- Run each example with `node filename.js` and check the output matches the comment.
- Do the practice exercises at the end of each section before moving on.
- Stuck for more than 20 minutes? Post your code and the exact error in the BlockHub community.

**What you need**

- A laptop (Windows, macOS or Linux)
- Node.js LTS installed from [nodejs.org](https://nodejs.org)
- VS Code from [code.visualstudio.com](https://code.visualstudio.com)
- Git from [git-scm.com](https://git-scm.com) and a free GitHub account

**By the end of this week you can**

1. Explain how a client, a server and a database talk to each other
2. Write JavaScript with variables, conditions, loops and functions
3. Work with arrays and objects the way APIs do
4. Use modern syntax: spread, template literals, optional chaining
5. Write asynchronous code with promises and async/await, and handle errors with try/catch

## 1. How the web works

Every app you use is a conversation: a **client** sends a **request**, a **server** does some work, and sends back a **response**. As a backend developer, you write the server.

**The three players**

- **Client**: whatever asks for data. A browser, a mobile app, or a testing tool like Postman or Thunder Client.
- **Server**: a program that listens for requests and answers them. In this track it is Node.js with Express.
- **Database**: where data is stored permanently. In this track it is MongoDB. The client never talks to the database directly; only the server does.

Think of a restaurant. You (the client) give your order to the waiter (the server). The waiter goes to the kitchen and store room (the database), then brings your food back (the response). You never walk into the store room yourself.

**What happens when you log in to an app**

1. You type your email and password and press Login.
2. The app sends a POST request to the server's `/api/auth/login` URL with your details in the body.
3. The server reads the body and asks the database for a user with that email.
4. The server checks the password and decides what to do.
5. The server sends back a response: a status code (like 200 or 401) and some JSON.
6. The app reads the response and shows your dashboard or an error.

**A request has four parts**

```http
POST /api/auth/login HTTP/1.1
Host: api.example.com
Content-Type: application/json

{ "email": "ada@mail.com", "password": "secret123" }
```

- **Method**: what you want to do (POST)
- **URL / path**: which resource (`/api/auth/login`)
- **Headers**: extra information, such as the content type or a login token
- **Body**: the data you are sending (only for POST, PUT and PATCH)

**A response has three parts**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "message": "Login successful", "user": { "name": "Ada" } }
```

- **Status code**: did it work? (200)
- **Headers**: extra information about the response
- **Body**: the data sent back, usually JSON

**HTTP methods you will use**

| Method | Meaning | Example |
| --- | --- | --- |
| GET | Read data | Get all courses |
| POST | Create something new | Register a new student |
| PUT / PATCH | Update something | Change a student's track |
| DELETE | Remove something | Delete a class |

**Status codes to remember**

| Code | Meaning | When you'll send it |
| --- | --- | --- |
| 200 OK | Success | Data fetched or updated |
| 201 Created | Something new was made | A user registered |
| 400 Bad Request | The client sent bad data | Email is missing |
| 401 Unauthorized | Not logged in | No token or a wrong password |
| 404 Not Found | That thing doesn't exist | No course with that id |
| 500 Server Error | Your code broke | An unhandled error |

A simple rule: **2xx** means it worked, **4xx** means the client made a mistake, **5xx** means the server made a mistake.

**Practice**

1. Open any website, press F12, go to the Network tab and refresh. Click one request and find its method, status code and response.
2. Write in your own words what happens when you send a WhatsApp message, using the words client, server, request and response.

## 2. Setting up your tools

You need three tools: an editor to write code, a terminal to run it, and Git to save its history.

**VS Code**

Install VS Code, then add these extensions from the Extensions tab (Ctrl + Shift + X):

- **ESLint**: warns you about mistakes as you type
- **Prettier**: formats your code neatly on save
- **Thunder Client**: sends test requests to your server (we'll use it from week 3)

Open the built-in terminal with **Ctrl + `** (the backtick key, under Esc).

**Node.js**

Install the **LTS** version from nodejs.org. Then check it worked:

```bash
node -v     # prints something like v22.x.x
npm -v      # prints something like 10.x.x
```

If you see "command not found", close and reopen your terminal, or restart your laptop.

**Terminal commands you'll use every day**

| Command | What it does |
| --- | --- |
| `pwd` | Show which folder you are in (on Windows PowerShell too) |
| `ls` | List the files in this folder (`dir` on old Windows cmd) |
| `cd foldername` | Go into a folder |
| `cd ..` | Go up one folder |
| `mkdir foldername` | Make a new folder |
| `node file.js` | Run a JavaScript file |
| `code .` | Open the current folder in VS Code |

**Git and GitHub**

Git keeps a history of your code, so you can always go back. GitHub stores that history online so others (including your tutor) can see it.

Set your name and email once:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The everyday workflow:

```bash
git init                     # start tracking this folder (once)
git add .                    # stage all changes
git commit -m "add calc.js"  # save a snapshot with a message
git push                     # upload to GitHub
```

To connect a folder to GitHub: create an empty repository on github.com, then run the two commands GitHub shows you (`git remote add origin …` and `git push -u origin main`).

**Practice**

1. Make a folder called `blockhub-week1`, open it in VS Code with `code .`, and create `hello.js` containing `console.log("Hello BlockHub");`. Run it with `node hello.js`.
2. Run `git init`, then commit `hello.js` with the message "first commit".

## 3. Variables, data types, conditions and loops

A variable is a labelled box that holds a value. Use `const` by default, `let` when the value must change, and never `var`.

**Declaring variables**

```js
const name = "Ada";   // can't be reassigned
let age = 21;         // can be reassigned
age = 22;             // fine
// name = "Bola";     // TypeError: Assignment to constant variable
```

`var` is the old way. It ignores block scope, which causes confusing bugs, so modern code avoids it.

**Data types**

| Type | Example | Notes |
| --- | --- | --- |
| string | `"Ada"`, `'Lagos'` | Text, in quotes |
| number | `21`, `3.5` | Whole numbers and decimals are the same type |
| boolean | `true`, `false` | Yes or no |
| null | `null` | Empty on purpose |
| undefined | `undefined` | Never given a value |
| object | `{ name: "Ada" }` | A group of key: value pairs |
| array | `["Node", "Express"]` | An ordered list (technically a kind of object) |

Check a type with `typeof`:

```js
console.log(typeof "hi");   // "string"
console.log(typeof 42);     // "number"
console.log(typeof true);   // "boolean"
```

**Conditions: making decisions**

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

Comparison operators: `===` (equal), `!==` (not equal), `>`, `<`, `>=`, `<=`.

Always use `===`, not `==`. The double version converts types first, so `5 == "5"` is `true`, which hides bugs. `5 === "5"` is `false`.

Combine conditions:

```js
const isLoggedIn = true;
const isAdmin = false;

if (isLoggedIn && isAdmin) console.log("Show admin panel");  // AND
if (isLoggedIn || isAdmin) console.log("Show dashboard");    // OR
if (!isLoggedIn) console.log("Please log in");               // NOT
```

The **ternary** is a one-line if/else:

```js
const result = score >= 50 ? "Pass" : "Fail";
```

**Loops: repeating work**

```js
// for...of: go through each item in an array
const tracks = ["Backend", "Frontend", "Web3"];
for (const track of tracks) {
  console.log(`Track: ${track}`);
}

// classic for loop: when you need a counter
for (let i = 1; i <= 3; i++) {
  console.log(`Class ${i}`);
}

// while: when you don't know how many times
let attempts = 0;
while (attempts < 3) {
  attempts++;
  console.log(`Attempt ${attempts}`);
}
```

In backend code you'll mostly loop over arrays of data from a database, so `for...of` and the array methods in section 5 are what you'll use most.

**Common mistakes**

- Using `=` (assign) when you meant `===` (compare) inside an `if`
- Forgetting `i++` in a loop, which creates an infinite loop (stop it with Ctrl + C)
- Reassigning a `const`

**Practice**

1. Write `grade.js` that stores a score and prints A (70+), B (60–69), C (50–59) or F.
2. Loop from 1 to 20 and print "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for both, otherwise the number.

## 4. Functions and arrow functions

A function is a reusable block of code. It takes inputs (**parameters**), does some work, and **returns** a result. Every route in an Express server is a function, so you'll write a lot of them.

**Function declaration**

```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("Ada"));  // Hello, Ada!
```

- `name` is the **parameter** (the placeholder)
- `"Ada"` is the **argument** (the real value you pass in)
- `return` sends a value back. Without it, the function returns `undefined`.

**Arrow functions**

A shorter way to write the same thing. You'll see these everywhere in modern Node code.

```js
// Full arrow function
const greet = (name) => {
  return `Hello, ${name}!`;
};

// One-line arrow: the result is returned automatically
const add = (a, b) => a + b;

// One parameter: brackets are optional
const double = n => n * 2;

// No parameters: empty brackets
const sayHi = () => console.log("Hi");
```

Careful: if you use curly braces `{ }`, you must write `return` yourself.

**Default parameters**

```js
const welcome = (name = "student") => `Welcome to BlockHub, ${name}`;

console.log(welcome());        // Welcome to BlockHub, student
console.log(welcome("Chi"));   // Welcome to BlockHub, Chi
```

**Functions as values**

In JavaScript you can store a function in a variable, put it in an object, or pass it into another function. This is the idea behind callbacks (section 7) and Express routes:

```js
const shout = (text) => text.toUpperCase();
const whisper = (text) => text.toLowerCase();

const speak = (text, style) => style(text);

console.log(speak("Hello", shout));    // HELLO
console.log(speak("Hello", whisper));  // hello

// Preview of week 3:
// app.get("/", (req, res) => res.send("Hi"));
```

**Scope**

A variable created inside a function only exists inside that function:

```js
const makeTotal = () => {
  const total = 100;
  return total;
};

makeTotal();
// console.log(total);  // ReferenceError: total is not defined
```

**Practice**

1. Write an arrow function `isAdult(age)` that returns `true` if age is 18 or more.
2. Write `formatPrice(amount, currency = "₦")` that returns a string like `₦5,000`. Hint: `amount.toLocaleString()`.
3. Write `applyTwice(fn, value)` that calls `fn` on `value` twice. `applyTwice(double, 3)` should return 12.

## 5. Arrays and objects

Almost all backend data is arrays of objects: a list of users, a list of courses, a list of payments. If you can shape arrays and objects, you can shape any API response.

**Arrays basics**

```js
const tracks = ["Backend", "Frontend"];

console.log(tracks[0]);       // "Backend" (counting starts at 0)
console.log(tracks.length);   // 2

tracks.push("Web3");          // add to the end
tracks.pop();                 // remove from the end
console.log(tracks.includes("Backend"));  // true
```

**map, filter, reduce, find**

These four methods replace most loops. None of them change the original array; they return something new.

```js
const students = [
  { name: "Ada", score: 82 },
  { name: "Tunde", score: 45 },
  { name: "Chi", score: 67 },
];
```

| Method | What it does | Returns |
| --- | --- | --- |
| `map` | Transforms every item | A new array, same length |
| `filter` | Keeps items that pass a test | A new array, same length or shorter |
| `reduce` | Combines all items into one value | One value (a number, object, anything) |
| `find` | Finds the first item that passes a test | One item, or `undefined` |

```js
// map: get just the names
const names = students.map((s) => s.name);
// ["Ada", "Tunde", "Chi"]

// filter: only students who passed
const passed = students.filter((s) => s.score >= 50);
// [{ name: "Ada", ... }, { name: "Chi", ... }]

// reduce: add up all scores
const total = students.reduce((sum, s) => sum + s.score, 0);
// 194

// find: the first student named Chi
const chi = students.find((s) => s.name === "Chi");
// { name: "Chi", score: 67 }
```

How `reduce` works: `sum` starts at `0` (the second argument). For each student, the function returns `sum + s.score`, and that becomes the new `sum`. So it goes 0 → 82 → 127 → 194.

You can chain them:

```js
const passedNames = students
  .filter((s) => s.score >= 50)
  .map((s) => s.name);
// ["Ada", "Chi"]
```

**Objects basics**

```js
const user = {
  name: "Ada",
  email: "ada@mail.com",
  track: "Backend",
  address: { city: "Lagos" },
};

console.log(user.name);          // dot notation
console.log(user["email"]);      // bracket notation (useful when the key is in a variable)
console.log(user.address.city);  // "Lagos"

user.track = "Full Stack";       // update
user.phone = "0800...";          // add a new key
delete user.phone;               // remove a key

console.log(Object.keys(user));  // ["name", "email", "track", "address"]
```

**JSON**

JSON is the text version of an object. It's how data travels between client and server.

```js
const text = JSON.stringify(user);     // object → string, to send
const back = JSON.parse(text);         // string → object, to use
```

In JSON, keys must be in double quotes: `{ "name": "Ada" }`.

**Destructuring**

Pull values out of an object or array into variables in one line:

```js
const { name, track } = user;
console.log(name);   // "Ada"

// rename while destructuring
const { email: userEmail } = user;

// nested
const { address: { city } } = user;   // "Lagos"

// arrays destructure by position
const [first, second] = ["Node", "Express"];
```

You will write this line in almost every Express route:

```js
const { email, password } = req.body;
```

**Practice**

Use this data:

```js
const products = [
  { name: "Laptop", price: 450000, inStock: true },
  { name: "Mouse", price: 8000, inStock: false },
  { name: "Keyboard", price: 15000, inStock: true },
];
```

1. Use `filter` to get only products in stock.
2. Use `map` to get an array of strings like `"Laptop - ₦450,000"`.
3. Use `reduce` to get the total price of products in stock.
4. Use destructuring to get `name` and `price` from the first product.

## 6. Modern JavaScript

Three features show up in almost every modern Node.js codebase: spread, template literals and optional chaining.

**Spread `...`**

Spread "unpacks" an array or object. Use it to copy or merge without changing the original.

```js
// Arrays
const frontend = ["HTML", "CSS"];
const backend = ["Node", "Express"];
const all = [...frontend, ...backend];
// ["HTML", "CSS", "Node", "Express"]

// Objects
const base = { role: "student", active: true };
const user = { ...base, name: "Ada" };
// { role: "student", active: true, name: "Ada" }

// Update one field (later keys win)
const updated = { ...user, active: false };
```

The same three dots in a function's parameters are called **rest**. They collect many arguments into an array:

```js
const sum = (...numbers) => numbers.reduce((a, b) => a + b, 0);
sum(1, 2, 3);  // 6
```

**Template literals**

Use backticks `` ` `` instead of quotes, and put any expression inside `${ }`:

```js
const name = "Ada";
const count = 3;

// Old way
const msg1 = "Hi " + name + ", you have " + count + " classes";

// Template literal
const msg2 = `Hi ${name}, you have ${count} classes`;

// Any expression works
const msg3 = `Total: ₦${(5000 * 2).toLocaleString()}`;  // Total: ₦10,000

// Multi-line strings
const email = `Hello ${name},
Your class starts at 6pm.`;
```

**Optional chaining `?.` and nullish coalescing `??`**

Reading a property of `undefined` crashes your program. This is the most common error in backend code:

```js
const user = { name: "Ada" };
console.log(user.address.city);
// TypeError: Cannot read properties of undefined (reading 'city')
```

`?.` stops and returns `undefined` instead of crashing:

```js
console.log(user.address?.city);   // undefined, no crash
console.log(user.getAge?.());      // works on functions too
```

`??` gives a fallback when the left side is `null` or `undefined`:

```js
const city = user.address?.city ?? "Unknown";   // "Unknown"
const limit = 0 ?? 10;    // 0 (0 is a real value, so it's kept)
const limit2 = 0 || 10;   // 10 (|| treats 0 as false, careful!)
```

**Practice**

1. Merge `{ name: "Ada" }` and `{ track: "Backend", cohort: 1 }` into one object with spread.
2. Write `receipt(item, price)` that returns `` `You bought ${item} for ₦${price}` ``.
3. Given `const res = { data: { user: null } }`, safely print the user's name, or "Guest" if there isn't one.

## 7. Callbacks, promises and async/await

A server spends most of its time waiting: on files, on databases, on other APIs. Asynchronous (async) code lets Node start a slow task, serve other users while it waits, and come back when the result is ready. This is the most important topic of the week.

**Why it matters**

Node runs your JavaScript on a single thread. If one request blocked that thread for 3 seconds while waiting on a database, every other user would wait 3 seconds too. Async code avoids that.

Think of a waiter. A blocking waiter takes your order and stands at the kitchen door until the food is ready. A non-blocking waiter hands in your order, serves five other tables, and brings your food when the kitchen calls. Node is the second waiter.

**Step 1: Callbacks**

A callback is a function you pass to another function, to be called later when the work is done.

```js
const fs = require("fs");

console.log("1. Start reading");

fs.readFile("notes.txt", "utf8", (err, data) => {
  if (err) {
    return console.log("Error:", err.message);
  }
  console.log("3. File says:", data);
});

console.log("2. I don't wait!");
```

Create a `notes.txt` file next to this script and run it. The output order is 1, 2, 3, because Node doesn't wait for the file before moving on.

Node's callbacks put the error first: `(err, data)`. Always check `err` before using `data`.

The problem: when one async step depends on another, callbacks nest inside callbacks. This is called **callback hell**:

```js
getUser(id, (err, user) => {
  getCourses(user, (err, courses) => {
    getClasses(courses, (err, classes) => {
      // deeper and deeper...
    });
  });
});
```

**Step 2: Promises**

A Promise is an object that represents a value that will arrive later. It is always in one of three states:

- **pending**: still waiting
- **fulfilled**: it worked, and there's a result
- **rejected**: it failed, and there's an error

Creating a Promise (here `setTimeout` pretends to be a slow database):

```js
const getUser = (id) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === 1) resolve({ id, name: "Ada" });
      else reject(new Error("User not found"));
    }, 1000);
  });
```

Using it with `.then()` and `.catch()`:

```js
getUser(1)
  .then((user) => console.log(user.name))     // Ada (after 1 second)
  .catch((err) => console.log(err.message));

getUser(2)
  .then((user) => console.log(user.name))
  .catch((err) => console.log(err.message));  // User not found
```

Chained promises stay flat instead of nesting:

```js
getUser(1)
  .then((user) => getCourses(user))
  .then((courses) => getClasses(courses))
  .then((classes) => console.log(classes))
  .catch((err) => console.log(err.message));  // one catch for all steps
```

Most modern libraries (including Mongoose for MongoDB) return Promises, so you'll mostly *use* Promises rather than create them.

**Step 3: async / await**

`async/await` is a cleaner way to use Promises. The code reads top to bottom, like normal code.

```js
const showUser = async () => {
  const user = await getUser(1);
  console.log(`Found ${user.name}`);
};

showUser();
```

- `async` before a function means it always returns a Promise.
- `await` pauses *that function* until the Promise settles, then gives you the result.
- `await` only works inside an `async` function (or at the top level of an ES module, covered next week).
- While one function is paused at `await`, Node keeps running everything else.

Running things one after another vs at the same time:

```js
// One after another (~2 seconds)
const a = await getUser(1);
const b = await getUser(1);

// At the same time (~1 second)
const [c, d] = await Promise.all([getUser(1), getUser(1)]);
```

This is what your backend code will look like once we add MongoDB:

```js
const user = await User.findById(id);
```

**Common mistakes**

- Forgetting `await`, then getting `Promise { <pending> }` instead of the data
- Using `await` in a function that isn't `async` (SyntaxError)
- No `.catch()` or `try/catch`, so a rejected Promise crashes the program

**Practice**

1. Write `wait(ms)` that returns a Promise which resolves after `ms` milliseconds. Use it with `await` to print "Ready" after 2 seconds.
2. Rewrite the callbacks example above using `require("fs/promises")` and `await fs.readFile(...)`.
3. Predict the order these print, then run it to check:

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
```

## 8. Error handling with try/catch

Things go wrong: a user isn't found, the database is down, someone sends bad data. `try/catch` lets your program handle errors instead of crashing. On a server, an unhandled error can bring the whole server down for every user.

**The shape**

```js
try {
  // code that might fail
} catch (err) {
  // runs only if something in try threw an error
} finally {
  // always runs, success or failure (optional)
}
```

**With async/await**

`try/catch` is how you handle rejected Promises when using `await`:

```js
const showUser = async (id) => {
  try {
    const user = await getUser(id);
    console.log(`Found ${user.name}`);
  } catch (err) {
    console.log("Something went wrong:", err.message);
  } finally {
    console.log("Lookup finished");
  }
};

showUser(1);  // Found Ada → Lookup finished
showUser(7);  // Something went wrong: User not found → Lookup finished
```

**Throwing your own errors**

Use `throw` when something is wrong, even if JavaScript itself wouldn't complain:

```js
const register = (email, password) => {
  if (!email) throw new Error("Email is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  return { email };
};

try {
  register("ada@mail.com", "123");
} catch (err) {
  console.log(err.message);  // Password must be at least 8 characters
}
```

Always throw `new Error("...")`, not a plain string. An Error object carries a `message` and a `stack` (where it happened), which helps you debug.

**What an error object contains**

| Property | What it is |
| --- | --- |
| `err.message` | The human-readable description |
| `err.name` | The type, such as `TypeError` or `ReferenceError` |
| `err.stack` | The file and line where it happened |

**A preview of Express**

In a few weeks, every route you write will look like this. Notice that it is just today's lessons combined:

```js
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
```

**Practice**

1. Write `divide(a, b)` that throws an error if `b` is 0. Call it inside `try/catch` and print the message.
2. Write `parseJSON(text)` that returns the parsed object, or `null` if the text isn't valid JSON. Test it with `'{"a":1}'` and `'not json'`.

## 9. Week 1 build: command-line utility scripts

You'll build three small scripts that run in the terminal. Together they use every topic from this week.

| Script | What it does | Topics it uses |
| --- | --- | --- |
| `calc.js` | A calculator: `node calc.js add 5 3` | process.argv, destructuring, objects, functions, conditions |
| `grades.js` | Summarises a list of student scores | map, filter, reduce, template literals |
| `lookup.js` | Finds a student in a fake, slow database | Promises, async/await, try/catch |

**Setup**

```bash
mkdir blockhub-week1
cd blockhub-week1
git init
code .
```

**How scripts read your input: `process.argv`**

When you run `node calc.js add 5 3`, Node puts everything you typed into an array called `process.argv`:

```js
[
  "/usr/local/bin/node",      // 0: path to node
  "/home/you/calc.js",        // 1: path to your file
  "add",                       // 2: your first word
  "5",                         // 3
  "3",                         // 4
]
```

Everything comes in as a **string**, so `"5"` must be converted with `Number()` before you do maths.

### Script 1: calc.js

```js
// calc.js → run with: node calc.js add 5 3

// Skip the first two items (node path, file path) with empty commas
const [, , op, a, b] = process.argv;
const [x, y] = [Number(a), Number(b)];

// Each operation is an arrow function stored under a key
const operations = {
  add: (x, y) => x + y,
  sub: (x, y) => x - y,
  mul: (x, y) => x * y,
  div: (x, y) => (y === 0 ? "Cannot divide by 0" : x / y),
};

// Validate before using the input
if (!operations[op] || isNaN(x) || isNaN(y)) {
  console.log("Usage: node calc.js <add|sub|mul|div> a b");
} else {
  console.log(`Result: ${operations[op](x, y)}`);
}
```

Try it:

```bash
node calc.js add 5 3      # Result: 8
node calc.js div 6 0      # Result: Cannot divide by 0
node calc.js add five 3   # Usage: node calc.js <add|sub|mul|div> a b
```

How it works:

1. Destructuring pulls the operation name and two numbers out of `process.argv`.
2. `operations[op]` looks up the function by its name. If you typed `add`, it gets the add function.
3. If the operation doesn't exist or a number is invalid (`isNaN`), we print how to use the script.
4. Otherwise we call the function with `operations[op](x, y)` and print the result.

### Script 2: grades.js

```js
// grades.js → run with: node grades.js

const students = [
  { name: "Ada", score: 82 },
  { name: "Tunde", score: 45 },
  { name: "Chi", score: 67 },
  { name: "Bola", score: 91 },
  { name: "Emeka", score: 38 },
];

const PASS_MARK = 50;

const total = students.reduce((sum, s) => sum + s.score, 0);

const passed = students
  .filter((s) => s.score >= PASS_MARK)
  .map((s) => s.name);

console.log(`Students: ${students.length}`);
console.log(`Total score: ${total}`);
console.log(`Passed (${passed.length}): ${passed.join(", ")}`);
```

Output:

```text
Students: 5
Total score: 323
Passed (3): Ada, Chi, Bola
```

This is a starter. In the homework you'll add the average, the top student and the list of students who failed.

### Script 3: lookup.js

```js
// lookup.js → run with: node lookup.js 2

// A fake database: an array of objects
const db = [{ id: 1, name: "Ada" }, { id: 2, name: "Chi" }];

// Pretend the database is slow: answer after 800ms
const findStudent = (id) => new Promise((resolve, reject) => {
  setTimeout(() => {
    const s = db.find((st) => st.id === id);
    s ? resolve(s) : reject(new Error(`No student #${id}`));
  }, 800);
});

const main = async () => {
  try {
    const s = await findStudent(Number(process.argv[2]));
    console.log(`Found: ${s.name}`);
  } catch (err) {
    console.log(err.message);
  }
};

main();
```

Try it:

```bash
node lookup.js 2   # Found: Chi
node lookup.js 9   # No student #9
```

This is the exact shape of a real database lookup. Later in the track we'll replace the fake `db` with MongoDB and keep the same `async`, `await` and `try/catch` pattern.

**Save your work**

```bash
git add .
git commit -m "week 1: calc, grades and lookup scripts"
git push
```

## 10. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish all three scripts and push them to a public GitHub repository named `blockhub-week1`.
2. Add `pow` (power) and `mod` (remainder) operations to `calc.js`. Hint: `x ** y` and `x % y`.
3. Extend `grades.js` to also print the average score (one decimal place), the top student, and the names of everyone who failed. Hint: `toFixed(1)`, and `reduce` can return the best object, not just a number.
4. **Bonus:** add a third student to `lookup.js` and make `node lookup.js` with no number print "Please give a student id".
5. Submit your GitHub link on BlockHub.

**End-of-week checklist**

Tick each one when you can do it without looking at the notes:

- [ ] Explain what a client, server and database do, and what a request and a response contain
- [ ] Name four HTTP methods and what 200, 201, 400, 401, 404 and 500 mean
- [ ] Run a file with `node`, and commit and push with Git
- [ ] Choose between `const` and `let`, and use `===`
- [ ] Write if/else, a ternary, `for...of` and `while`
- [ ] Write a function both as a declaration and as an arrow function
- [ ] Use `map`, `filter`, `reduce` and `find` on an array of objects
- [ ] Destructure values from an object and an array
- [ ] Use spread, template literals, `?.` and `??`
- [ ] Explain why Node uses async code
- [ ] Create a Promise, and use it with `.then/.catch` and with `async/await`
- [ ] Handle errors with `try/catch` and `throw new Error()`

**Glossary**

| Term | Meaning |
| --- | --- |
| Client | The program that sends a request (browser, app, Postman) |
| Server | The program that receives requests and sends responses |
| Request / Response | The message sent to a server, and the reply it sends back |
| Status code | A number in the response saying how it went (200, 404, 500…) |
| JSON | Text format for sending objects between client and server |
| Variable | A named box that holds a value |
| Function | A reusable block of code that can take inputs and return a result |
| Parameter / Argument | The placeholder in a function / the real value you pass in |
| Callback | A function passed to another function, to be called later |
| Promise | An object for a value that will arrive later (pending, fulfilled, rejected) |
| async / await | A cleaner way to write code that waits for Promises |
| Blocking / Non-blocking | Waiting and doing nothing else / starting a task and moving on |
| process.argv | The array of words you typed when running a Node script |

**Next week: Node.js Fundamentals.** The event loop, modules, npm, the `fs` and `path` modules, events, a basic server with the `http` module, and environment variables with dotenv. The build is a file-based notes app for the command line.
