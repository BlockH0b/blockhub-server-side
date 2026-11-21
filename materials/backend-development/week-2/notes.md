## Before you start

Last week you set up your tools and learned how the web and backends work. This week you learn **Node.js**, the engine that runs every backend you'll build in this course. By the end you'll have built a **notes app that runs in the terminal** and saves to a file.

**What you need**

- Node.js LTS installed (`node -v` should print v20 or higher)
- VS Code and a terminal
- A folder for this week: `mkdir notes-cli && cd notes-cli`

## 1. What Node.js is

JavaScript was made to run inside browsers. **Node.js** lets it run anywhere: on your laptop, on a server, in the cloud.

| | Browser JavaScript | Node.js |
| --- | --- | --- |
| Has | `window`, `document`, the DOM, clicks | `fs` (files), `http` (servers), `process` |
| Can read your files | No | Yes |
| Used for | Interactive web pages | APIs, servers, scripts, tools |
| Same language? | Yes: variables, functions, arrays, objects, async all work the same | |

**Why backends use Node**

- One language for frontend and backend.
- Very good at handling many requests at once (thanks to the event loop, section 7).
- npm has over two million packages.

## 2. Running JavaScript with Node

Create `app.js`:

```js
const name = "BlockHub";
console.log(`Hello from ${name}!`);
console.log("Node version:", process.version);
```

Run it:

```bash
node app.js
```

**Useful commands**

| Command | What it does |
| --- | --- |
| `node -v` | Show your Node version |
| `node app.js` | Run a file |
| `node --watch app.js` | Rerun automatically whenever you save |
| `node` | Open the REPL to try code line by line (`.exit` to leave) |

## 3. Modules: import and export

A **module** is just a file. Splitting code into modules keeps it organised and reusable.

**Turn on modern modules** by adding `"type": "module"` to `package.json` (section 4). Then:

```js
// math.js
export const add = (a, b) => a + b;   // named export
export const PI = 3.14;

export default function square(n) {    // default export (one per file)
  return n * n;
}
```

```js
// app.js
import square, { add, PI } from "./math.js";

console.log(add(2, 3)); // 5
console.log(square(4)); // 16
```

**Rules**

- Local files start with `./` or `../` and **must include `.js`**.
- Packages from npm are imported by name: `import chalk from "chalk"`.
- Built-in Node modules start with `node:`: `import fs from "node:fs/promises"`.

**You'll also see the older style (CommonJS)** in tutorials and older projects:

```js
const fs = require("fs");
module.exports = { add };
```

It works the same way. We use `import/export` in this course.

## 4. npm and package.json

**npm** (Node Package Manager) installs code other people wrote.

```bash
npm init -y               # creates package.json
npm install chalk         # a package your app needs to run
npm install -D nodemon    # a package only needed while developing
```

```json
{
  "name": "notes-cli",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": { "chalk": "^5.3.0" },
  "devDependencies": { "nodemon": "^3.1.0" }
}
```

| Part | Meaning |
| --- | --- |
| `dependencies` | Needed to run the app |
| `devDependencies` | Only needed while developing (`-D`) |
| `scripts` | Shortcuts: `npm start`, `npm run dev` |
| `^5.3.0` | Any 5.x.x version from 5.3.0 up (no breaking changes) |
| `package-lock.json` | Exact versions installed. Commit it. |
| `node_modules/` | The installed code. **Never commit it**; add it to `.gitignore`. |

Anyone who clones your project runs `npm install` to get `node_modules` back.

## 5. Working with files: the fs module

Use the **promises** version of `fs` so you can `await` it.

```js
import fs from "node:fs/promises";

// write (creates or replaces the file)
await fs.writeFile("hello.txt", "Hi there\n");

// add to the end
await fs.appendFile("hello.txt", "Another line\n");

// read
const text = await fs.readFile("hello.txt", "utf8");
console.log(text);

// list files in a folder
const files = await fs.readdir(".");

// make a folder (no error if it exists)
await fs.mkdir("data", { recursive: true });

// delete a file
await fs.unlink("hello.txt");
```

**Always pass `"utf8"`** when reading text. Without it you get a `Buffer` (raw bytes).

**Files can be missing.** Reading a file that doesn't exist throws an error with `code: "ENOENT"`:

```js
try {
  const data = await fs.readFile("missing.txt", "utf8");
} catch (err) {
  if (err.code === "ENOENT") console.log("File not found");
  else throw err;
}
```

**Saving objects:** files hold text, so convert with JSON.

```js
const notes = [{ id: 1, text: "Buy milk" }];
await fs.writeFile("notes.json", JSON.stringify(notes, null, 2)); // pretty, 2-space indent

const loaded = JSON.parse(await fs.readFile("notes.json", "utf8"));
```

## 6. Paths and the process object

**path** builds file paths that work on Windows, Mac and Linux.

```js
import path from "node:path";

const file = path.join(import.meta.dirname, "data", "notes.json");
// Windows: C:\Users\you\notes-cli\data\notes.json
// Mac/Linux: /home/you/notes-cli/data/notes.json

path.basename(file); // "notes.json"
path.extname(file);  // ".json"
path.dirname(file);  // the folder
```

`import.meta.dirname` is the folder of the current file (Node 20.11+). It's safer than a plain `"notes.json"`, which is relative to wherever you ran `node` from.

**process** describes the running program.

| | Meaning |
| --- | --- |
| `process.argv` | What was typed on the command line (section 9) |
| `process.env` | Environment variables, e.g. `process.env.PORT` |
| `process.cwd()` | The folder you ran the command from |
| `process.exit(1)` | Stop now; non-zero means "something went wrong" |

## 7. The event loop

Node runs your JavaScript on **one thread**: it does one thing at a time. So how does it handle thousands of users?

**It never waits.** Slow work (reading files, database queries, network calls) is handed off to the system. Node carries on with other code. When the slow work finishes, its callback is put in a queue, and the **event loop** runs it when the current code is done.

```js
import fs from "node:fs/promises";

console.log("1. start");

setTimeout(() => console.log("3. timer"), 0);

fs.readFile(import.meta.filename, "utf8").then(() => console.log("4. file read"));

console.log("2. end");
```

Output:

```text
1. start
2. end
3. timer
4. file read
```

Even with a `0` ms timer, "end" prints first: callbacks only run after the current code finishes.

**The lesson:** never block the event loop with long synchronous work (like `fs.readFileSync` on a huge file inside a server, or a giant loop). While it runs, **every** user waits.

## 8. Callbacks, Promises and async/await

Three ways to handle async work. You'll see all three in real code.

**1. Callbacks** (oldest)

```js
import fs from "node:fs";

fs.readFile("a.txt", "utf8", (err, data) => {
  if (err) return console.error(err);
  console.log(data);
});
```

Nesting many callbacks creates "callback hell".

**2. Promises**

```js
import fsp from "node:fs/promises";

fsp.readFile("a.txt", "utf8")
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
```

**3. async/await** (what we use)

```js
async function show() {
  try {
    const data = await fsp.readFile("a.txt", "utf8");
    console.log(data);
  } catch (err) {
    console.error("Could not read file:", err.message);
  }
}
```

In ES modules (`"type": "module"`) you can use `await` at the top level of a file, outside any function.

**Running things in parallel**

```js
const [a, b] = await Promise.all([
  fsp.readFile("a.txt", "utf8"),
  fsp.readFile("b.txt", "utf8"),
]);
```

## 9. Command-line arguments

`process.argv` is an array of everything typed:

```bash
node index.js add "Buy milk"
```

```js
console.log(process.argv);
// [ "/usr/bin/node", "/home/you/notes-cli/index.js", "add", "Buy milk" ]

const [, , command, ...rest] = process.argv; // skip the first two
const text = rest.join(" ");
```

Always show help when the input is wrong:

```js
if (!command) {
  console.log("Usage: node index.js <add|list|remove|clear> [text]");
  process.exit(1);
}
```

## 10. Week 2 build: a file-based notes CLI

**Goal:** a terminal app that manages notes saved in `notes.json`.

```bash
node index.js add "Finish backend homework"
node index.js list
node index.js remove 1
node index.js clear
```

**storage.js**

```js
import fs from "node:fs/promises";
import path from "node:path";

const FILE = path.join(import.meta.dirname, "notes.json");

export async function load() {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return []; // no file yet
    throw err;
  }
}

export async function save(notes) {
  await fs.writeFile(FILE, JSON.stringify(notes, null, 2));
}
```

**index.js**

```js
import { load, save } from "./storage.js";

const [, , command, ...rest] = process.argv;
const notes = await load();

switch (command) {
  case "add": {
    const text = rest.join(" ").trim();
    if (!text) {
      console.log('Please write a note: node index.js add "Buy milk"');
      process.exit(1);
    }
    notes.push({ id: Date.now(), text, createdAt: new Date().toISOString() });
    await save(notes);
    console.log("✅ Note added");
    break;
  }

  case "list":
    if (notes.length === 0) console.log("No notes yet.");
    notes.forEach((n, i) => console.log(`${i + 1}. ${n.text}`));
    break;

  case "remove": {
    const index = Number(rest[0]) - 1;
    if (!notes[index]) {
      console.log("No note with that number. Run 'list' to see numbers.");
      process.exit(1);
    }
    const [removed] = notes.splice(index, 1);
    await save(notes);
    console.log(`🗑️  Removed: ${removed.text}`);
    break;
  }

  case "clear":
    await save([]);
    console.log("All notes cleared");
    break;

  default:
    console.log("Usage: node index.js <add|list|remove|clear> [text]");
}
```

**Extensions (pick at least one)**

- `search <word>`: show notes containing a word.
- `done <number>`: mark a note done and show ✓ in the list.
- Colourful output with the `chalk` package.

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish the notes CLI with `add`, `list`, `remove` and `clear`.
2. Add a `search` command.
3. Push to GitHub with a `.gitignore` (`node_modules`) and a README listing every command.
4. Submit the link on BlockHub.

**End-of-week checklist**

- [ ] Explain the difference between browser JavaScript and Node.js
- [ ] Run a script with `node` and `node --watch`
- [ ] Split code into modules with `import` and `export`
- [ ] Create `package.json`, install packages and write scripts
- [ ] Read and write files with `fs/promises` and JSON
- [ ] Build safe paths with `path.join`
- [ ] Explain the event loop and why blocking it is bad
- [ ] Write async code with `async/await` and `try/catch`
- [ ] Read command-line arguments from `process.argv`

**Glossary**

| Term | Meaning |
| --- | --- |
| Node.js | A runtime that runs JavaScript outside the browser |
| Runtime | The program that runs your code |
| Module | A file that exports code for other files to import |
| npm | Node's package manager |
| Package | Reusable code published to npm |
| package.json | Your project's name, scripts and dependencies |
| fs | Node's built-in module for files |
| Event loop | How Node runs callbacks when slow work finishes |
| Asynchronous | Code that starts now and finishes later |
| Promise | An object for a value that will arrive later |
| CLI | Command-line interface: a program you use in the terminal |
| ENOENT | Node's error code for "file or folder not found" |
