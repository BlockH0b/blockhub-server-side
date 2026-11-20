## Before you start

This week you learn the two languages behind every website: HTML for structure and CSS for style. By the end of the week you will have built and published your own personal landing page. Your tutor for the Full-Stack Development track is Daniel Success (Derik | Dev).

**How to use these notes**

- Read a section, then type every example yourself. Don't copy and paste; typing is how it sticks.
- Keep your page open with Live Server so you see every change straight away.
- Do the practice at the end of each section before moving on.
- Stuck for more than 20 minutes? Post your code and a screenshot in the BlockHub community.

**What you need**

- A laptop (Windows, macOS or Linux)
- A modern browser: Chrome, Edge or Firefox
- VS Code from [code.visualstudio.com](https://code.visualstudio.com)
- A free GitHub account from [github.com](https://github.com) (for publishing your page)

**By the end of this week you can**

1. Explain what happens when you open a website
2. Build a page with semantic HTML: text, links, images, lists, forms and tables
3. Style it with CSS: selectors, colours, fonts and the box model
4. Lay it out with Flexbox and CSS Grid
5. Make it work on phones and for people using screen readers

## 1. How the web works

When you type a website address and press Enter, your **browser** sends a **request** to a **server**. The server sends back files: HTML, CSS, JavaScript and images. Your browser reads them and draws the page.

**The three files of a web page**

| File | Job | Think of it as |
| --- | --- | --- |
| HTML | The content and structure | The walls and rooms of a house |
| CSS | How it looks | The paint, furniture and decoration |
| JavaScript | How it behaves | The electricity that makes things work |

This week is all HTML and CSS. JavaScript comes later in the course.

**What the browser does**

1. Downloads `index.html` and reads it from top to bottom.
2. Finds the `<link>` to your CSS and downloads `style.css`.
3. Finds each `<img>` and downloads the images.
4. Builds the page and paints it on your screen.

**Practice**

1. Open any website, right-click and choose **View page source**. Find the `<head>` and the `<body>`.
2. Press F12 to open DevTools. In the **Network** tab, refresh and find the HTML file, a CSS file and an image.

## 2. Setting up your tools

**VS Code**

Install VS Code, then add these extensions from the Extensions tab (Ctrl + Shift + X):

- **Live Server**: opens your page in the browser and refreshes it every time you save
- **Prettier**: formats your code neatly on save

Shortcut to remember: in an empty `.html` file, type `!` and press Tab to get a full HTML starter.

**Browser DevTools**

Every browser has developer tools built in. Open them with **F12** or **Ctrl + Shift + I** (Cmd + Option + I on Mac).

| Tab | What you use it for |
| --- | --- |
| Elements | See the HTML, click any element, and edit its CSS live |
| Console | See errors (you'll use this a lot when we reach JavaScript) |
| Network | See every file the page downloaded |
| Device mode (Ctrl + Shift + M) | Preview your page at phone and tablet sizes |

Anything you change in DevTools is only on your screen and disappears when you refresh. It's a safe place to experiment.

**Your project folder**

Keep one folder per website:

```text
my-site/
  index.html
  style.css
  images/
    me.jpg
```

Rules that save you headaches: use lowercase file names, no spaces (use `-` instead), and always call the home page `index.html`.

**Practice**

1. Create the `my-site` folder above and open it in VS Code.
2. Create `index.html`, type `!` then Tab, and open it with Live Server (right-click, **Open with Live Server**).

## 3. HTML page structure

HTML is made of **elements**. Most elements have an opening tag, some content and a closing tag:

```html
<p>This is a paragraph.</p>
```

Some tags carry extra information in **attributes**:

```html
<a href="https://blockhubglobal.xyz">Visit BlockHub</a>
```

Here `href` is the attribute and the address in quotes is its value.

**The starter every page needs**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My first page</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>Hello, BlockHub!</h1>
    <p>This is my first web page.</p>
  </body>
</html>
```

| Line | What it does |
| --- | --- |
| `<!DOCTYPE html>` | Tells the browser this is modern HTML |
| `<html lang="en">` | Wraps the whole page and sets the language |
| `<head>` | Information for the browser; nothing here shows on the page |
| `<meta charset="UTF-8">` | Lets you use any character, including ₦ and emoji |
| `<meta name="viewport" …>` | Makes the page fit phone screens properly |
| `<title>` | The text in the browser tab |
| `<link rel="stylesheet">` | Connects your CSS file |
| `<body>` | Everything people actually see |

**Semantic tags**

Semantic tags describe what a piece of content **is**. They make your HTML easier to read and help screen readers and search engines understand the page.

```html
<body>
  <header>
    <nav>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main>
    <section id="about">
      <h2>About me</h2>
      <p>I'm learning to build websites.</p>
    </section>

    <article>
      <h2>My first blog post</h2>
    </article>
  </main>

  <footer>
    <p>© 2026 Ada</p>
  </footer>
</body>
```

| Tag | Use it for |
| --- | --- |
| `<header>` | The top of the page: logo and navigation |
| `<nav>` | A group of navigation links |
| `<main>` | The main content (only one per page) |
| `<section>` | A themed part of the page, usually with a heading |
| `<article>` | Something that makes sense on its own: a post, a card |
| `<footer>` | The bottom of the page or of a section |
| `<div>` | A box with no meaning, used only for styling |

**Common mistakes**

- Forgetting to close a tag, so everything after it looks wrong
- Putting visible content inside `<head>`
- Building the whole page with `<div>`s when a semantic tag fits

**Practice**

1. Build the semantic page above in your `index.html` with your own name and content.
2. Open DevTools, go to **Elements**, and click through your header, main and footer.

## 4. Text, links, images and lists

**Headings and text**

```html
<h1>Main title</h1>
<h2>Section title</h2>
<h3>Smaller heading</h3>

<p>A paragraph with <strong>important</strong> and <em>emphasised</em> text.</p>
<p>Line one<br>Line two</p>
```

- `h1` to `h6` are headings. Use **one `h1`** per page, then `h2`, `h3` in order.
- `<strong>` marks important text (bold); `<em>` adds emphasis (italic).

**Links**

```html
<!-- to another website, opening in a new tab -->
<a href="https://github.com" target="_blank">My GitHub</a>

<!-- to another page in your site -->
<a href="about.html">About</a>

<!-- to a section on the same page (matches id="contact") -->
<a href="#contact">Contact me</a>

<!-- email and phone -->
<a href="mailto:ada@mail.com">Email me</a>
<a href="tel:+2348000000000">Call me</a>
```

**Images**

```html
<img src="images/me.jpg" alt="Ada smiling at her desk" width="400">
```

- `src` is the path to the image file.
- `alt` describes the image for people who can't see it. Always include it.
- `<img>` has no closing tag.

**Lists**

```html
<!-- bullets: order doesn't matter -->
<ul>
  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript</li>
</ul>

<!-- numbers: order matters -->
<ol>
  <li>Install VS Code</li>
  <li>Create index.html</li>
  <li>Open with Live Server</li>
</ol>
```

**Practice**

1. Add an "About me" section with a heading, two paragraphs and a photo of you (or any image) with good alt text.
2. Add a list of skills you want to learn, and a link to your GitHub profile that opens in a new tab.

## 5. Forms and tables

**Forms collect input**

```html
<form>
  <label for="name">Name</label>
  <input id="name" type="text" placeholder="Your name" required>

  <label for="email">Email</label>
  <input id="email" type="email" required>

  <label for="track">Track</label>
  <select id="track">
    <option>Full-Stack</option>
    <option>Backend</option>
  </select>

  <label for="message">Message</label>
  <textarea id="message" rows="4"></textarea>

  <button type="submit">Send</button>
</form>
```

- Every input needs a `<label>`. The label's `for` must match the input's `id`, so clicking the label focuses the input.
- `type` changes the keyboard and checks: `text`, `email`, `password`, `number`, `date`, `checkbox`, `radio`.
- `required` stops the form submitting while the field is empty.

For now the form doesn't send anywhere. Once we learn backend development, we'll connect forms to a server.

**Tables show data in rows and columns**

```html
<table>
  <thead>
    <tr>
      <th>Track</th>
      <th>Weeks</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Full-Stack</td>
      <td>10</td>
    </tr>
    <tr>
      <td>Backend</td>
      <td>10</td>
    </tr>
  </tbody>
</table>
```

- `<tr>` is a row, `<th>` a heading cell, `<td>` a normal cell.
- Use tables only for data like prices or schedules, never to lay out a page.

**Practice**

1. Add a contact form with name, email and message to your page.
2. Make a small table of your weekly study timetable.

## 6. CSS selectors, colours and typography

CSS rules have two parts: a **selector** (what to style) and **declarations** (how to style it).

```css
h1 {
  color: #00ff66;
  font-size: 48px;
}
```

**Connecting CSS**

Put this in the `<head>` of your HTML:

```html
<link rel="stylesheet" href="style.css">
```

**Selectors you'll use most**

```css
/* element: every <p> */
p { color: #333; }

/* class: any element with class="card" */
.card { padding: 24px; }

/* id: the one element with id="hero" */
#hero { min-height: 100vh; }

/* descendant: links inside nav */
nav a { text-decoration: none; }

/* state: when the mouse is over a link */
nav a:hover { color: #00ff66; }

/* group: several selectors, same style */
h1, h2, h3 { font-weight: 800; }
```

In your HTML you add classes like this: `<div class="card">`. One element can have several classes: `class="card featured"`.

**When rules clash**

If two rules style the same thing, the more **specific** selector wins: an id beats a class, and a class beats an element. If they're equally specific, the one written **last** wins. DevTools shows the winner, with the losing rules crossed out.

**Colours**

```css
.box {
  color: white;                    /* name */
  background: #050605;             /* hex */
  border-color: rgb(0, 255, 102);  /* red, green, blue */
  box-shadow: 0 0 20px rgba(0, 255, 102, 0.4); /* with transparency */
}
```

Save colours you reuse as **CSS variables**:

```css
:root {
  --green: #00ff66;
  --dark: #050605;
}

.button { background: var(--green); color: var(--dark); }
```

Change `--green` once and it updates everywhere.

**Typography**

```css
body {
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: #222;
}

h1 { font-size: 3rem; line-height: 1.1; }
```

- Get free fonts at [fonts.google.com](https://fonts.google.com): choose a font, copy the `<link>` tag into your `<head>`, then use its name in `font-family`.
- `rem` is relative to the root font size (16px by default), so `3rem` is 48px.
- A `line-height` of 1.5 to 1.7 makes paragraphs easy to read.

**Practice**

1. Pick a Google Font and use it for your whole page.
2. Create two colour variables and use them for your headings and buttons.
3. Style your nav links so they change colour on hover.

## 7. The box model

Every element on a page is a rectangle made of four layers:

| Layer | What it is |
| --- | --- |
| Content | The text or image itself |
| Padding | Space inside the border, around the content |
| Border | The line around the padding |
| Margin | Space outside the border, between this element and others |

```css
.card {
  width: 300px;
  padding: 24px;
  border: 2px solid #ddd;
  border-radius: 12px;
  margin: 16px auto;   /* 16px top and bottom, centred left and right */
}
```

**Shorthand**

```css
padding: 10px;                /* all four sides */
padding: 10px 20px;           /* top and bottom, left and right */
padding: 10px 20px 30px 40px; /* top, right, bottom, left (clockwise) */
```

**box-sizing: border-box**

By default, padding and border are added on top of `width`, so a 300px card with 24px padding is really 352px wide. This rule makes `width` include them, which is much easier to work with. Put it at the top of every project:

```css
* {
  box-sizing: border-box;
}
```

**Practice**

1. Open DevTools, click any element and find the box model diagram in the **Computed** tab.
2. Style three cards with padding, a border, rounded corners and margin between them.

## 8. Layouts with Flexbox and CSS Grid

**Flexbox: one direction**

Flexbox lines items up in a row (or a column) and controls their spacing.

```css
.navbar {
  display: flex;
  justify-content: space-between; /* spacing along the row */
  align-items: center;            /* alignment across the row */
  gap: 24px;                      /* space between items */
}
```

| Property | Common values |
| --- | --- |
| `flex-direction` | `row` (default), `column` |
| `justify-content` | `flex-start`, `center`, `space-between`, `space-around` |
| `align-items` | `stretch`, `center`, `flex-start`, `flex-end` |
| `flex-wrap` | `nowrap` (default), `wrap` |
| `gap` | any size, e.g. `16px` |

A row of cards that wraps onto new lines:

```css
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  flex: 1 1 250px; /* grow, shrink, start at 250px */
}
```

Centre anything, both ways:

```css
.center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

**CSS Grid: rows and columns**

Grid is best when you need rows and columns at the same time.

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* three equal columns */
  gap: 20px;
}

.layout {
  display: grid;
  grid-template-columns: 250px 1fr; /* sidebar + main */
}

.hero {
  grid-column: 1 / -1; /* stretch across every column */
}
```

`fr` means "one share of the free space", so `1fr 2fr` gives the second column twice as much room as the first.

**Which one?**

- **Flexbox** for one direction: navbars, button groups, a row of icons.
- **Grid** for two directions: galleries, card grids, whole-page layouts.

You'll often use both on the same page.

**Practice**

1. Play [Flexbox Froggy](https://flexboxfroggy.com) and [Grid Garden](https://cssgridgarden.com). They're free games.
2. Make your navbar with Flexbox: logo on the left, links on the right.
3. Show your projects as a three-column Grid.

## 9. Responsive design and accessibility

**Responsive design**

Many of your visitors will open your site on a phone. A responsive page changes its layout to fit any screen.

Three rules:

1. Keep the viewport tag in your `<head>`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
2. Use flexible units like `%`, `fr` and `rem`, and `max-width` instead of fixed widths.
3. Use **media queries** to change the layout at certain widths.

```css
/* phones first: one column */
.cards {
  display: grid;
  gap: 16px;
}

/* tablets and up */
@media (min-width: 768px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
}

/* laptops and up */
@media (min-width: 1024px) {
  .cards { grid-template-columns: repeat(3, 1fr); }
}

/* images never overflow their container */
img {
  max-width: 100%;
  height: auto;
}
```

We write the phone styles first, then add layout for bigger screens. This is called **mobile-first**, and it means less CSS.

Test it: open DevTools, press **Ctrl + Shift + M** for device mode, and try widths like 375px (phone), 768px (tablet) and 1280px (laptop).

**Accessibility**

An accessible site works for everyone, including people using screen readers, keyboards or zoom.

| Rule | How |
| --- | --- |
| Alt text | Describe every meaningful image: `alt="Ada coding at her desk"`. For decorative images, use `alt=""`. |
| Headings in order | One `h1`, then `h2`, then `h3`. Never pick a heading just for its size; change the size with CSS. |
| Contrast | Text needs a contrast ratio of at least 4.5:1 against its background. DevTools shows the ratio when you click a colour. `#777` on white just fails; `#333` on white passes easily. |
| Labels | Every form input has a `<label>`. |
| Real buttons and links | Use `<button>` for actions and `<a>` for navigation, so they work with the keyboard. |

Try it: press **Tab** repeatedly on your page. You should be able to reach every link, input and button, and see where you are.

**Practice**

1. Make your projects grid one column on phones and three on laptops.
2. Check every image has good alt text and your headings go h1, h2, h3 in order.
3. Check your text colours with the contrast checker in DevTools.

## 10. Week 1 build: your personal landing page

You'll build a one-page site about you. It becomes the first piece in your portfolio.

**It should have**

| Section | What goes in it |
| --- | --- |
| Header | Your name or logo, and links to the sections below |
| Hero | A big headline about you and a button |
| About | A short paragraph and a photo |
| Skills | A list of what you know or are learning |
| Projects | Three cards (placeholders are fine for now) |
| Contact | A form with name, email and message |
| Footer | Copyright and social links |

### Step 1: index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ada | Web Developer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <header class="site-header">
      <nav class="nav">
        <a href="#" class="logo">Ada.dev</a>
        <ul class="nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#projects">Projects</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>
    </header>

    <main>
      <section class="hero">
        <p class="eyebrow">Hi, I'm Ada 👋</p>
        <h1>I build clean, simple websites.</h1>
        <p>I'm a full-stack developer in training at BlockHub.</p>
        <a href="#contact" class="btn">Work with me</a>
      </section>

      <section id="about" class="section about">
        <img src="images/me.jpg" alt="Ada smiling at her laptop">
        <div>
          <h2>About me</h2>
          <p>Write two or three sentences about who you are and why you're learning to code.</p>
        </div>
      </section>

      <section class="section">
        <h2>Skills</h2>
        <ul class="skills">
          <li>HTML</li>
          <li>CSS</li>
          <li>Flexbox &amp; Grid</li>
          <li>Responsive design</li>
        </ul>
      </section>

      <section id="projects" class="section">
        <h2>Projects</h2>
        <div class="projects">
          <article class="card">
            <h3>Project one</h3>
            <p>What it is and what you used to build it.</p>
          </article>
          <article class="card">
            <h3>Project two</h3>
            <p>What it is and what you used to build it.</p>
          </article>
          <article class="card">
            <h3>Project three</h3>
            <p>What it is and what you used to build it.</p>
          </article>
        </div>
      </section>

      <section id="contact" class="section">
        <h2>Contact me</h2>
        <form class="contact-form">
          <label for="name">Name</label>
          <input id="name" type="text" required>
          <label for="email">Email</label>
          <input id="email" type="email" required>
          <label for="message">Message</label>
          <textarea id="message" rows="4" required></textarea>
          <button type="submit" class="btn">Send message</button>
        </form>
      </section>
    </main>

    <footer class="footer">
      <p>© 2026 Ada · <a href="https://github.com/">GitHub</a></p>
    </footer>
  </body>
</html>
```

Save it and open it with Live Server. It will look plain. That's expected: content first, style second.

### Step 2: style.css

```css
/* ---------- base ---------- */
:root {
  --bg: #0b0d0c;
  --card: #151917;
  --text: #eef1ec;
  --muted: #a4a6aa;
  --accent: #00ff66;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }

/* ---------- nav ---------- */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 5%;
}
.logo { font-weight: 800; text-decoration: none; }
.nav-links { display: flex; gap: 24px; list-style: none; }
.nav-links a { text-decoration: none; color: var(--muted); }
.nav-links a:hover { color: var(--accent); }

/* ---------- hero ---------- */
.hero {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding: 0 5%;
}
.eyebrow { color: var(--accent); font-weight: 700; }
.hero h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1.1; max-width: 14ch; }

.btn {
  align-self: flex-start;
  background: var(--accent);
  color: #050605;
  font-weight: 700;
  text-decoration: none;
  border: none;
  border-radius: 10px;
  padding: 14px 24px;
  cursor: pointer;
}

/* ---------- sections ---------- */
.section { padding: 64px 5%; }
.section h2 { font-size: 2rem; margin-bottom: 24px; }

.about { display: grid; gap: 32px; align-items: center; }
.about img { border-radius: 16px; }

.skills { display: flex; flex-wrap: wrap; gap: 12px; list-style: none; }
.skills li { border: 1px solid var(--accent); border-radius: 999px; padding: 6px 16px; }

.projects { display: grid; gap: 20px; }
.card {
  background: var(--card);
  border: 1px solid #232826;
  border-radius: 16px;
  padding: 24px;
}

/* ---------- form ---------- */
.contact-form { display: grid; gap: 10px; max-width: 520px; }
.contact-form input,
.contact-form textarea {
  font: inherit;
  color: var(--text);
  background: var(--card);
  border: 1px solid #232826;
  border-radius: 10px;
  padding: 12px;
}

.footer { padding: 32px 5%; color: var(--muted); text-align: center; }

/* ---------- bigger screens ---------- */
@media (min-width: 768px) {
  .about { grid-template-columns: 1fr 2fr; }
  .projects { grid-template-columns: repeat(3, 1fr); }
}
```

Save and refresh. Then open device mode (Ctrl + Shift + M) and check it at phone, tablet and laptop sizes.

**Make it yours**

- Change the colours in `:root` to your own palette.
- Replace every placeholder with real content about you.
- Add your own photo to the `images` folder.

### Step 3: publish it with GitHub Pages

1. On GitHub, create a new **public** repository called `landing-page`.
2. Click **uploading an existing file**, drag in `index.html`, `style.css` and your `images` folder, and click **Commit changes**.
3. Go to **Settings → Pages**. Under **Branch**, choose `main` and `/ (root)`, then **Save**.
4. Wait a minute or two, refresh, and your live link appears at the top: `https://your-username.github.io/landing-page/`

## 11. Homework, checklist and glossary

**Homework (due before next class)**

1. Finish your landing page with all the sections above and your real content.
2. Make it responsive: test it at 375px, 768px and 1280px in DevTools.
3. Check accessibility: alt text on every image, headings in order, good contrast, every input labelled.
4. Publish it with GitHub Pages.
5. Submit your live link on BlockHub.

**Bonus:** add a "dark/light" colour section using a different background colour, or a hover effect on your project cards (try `transform: translateY(-4px);`).

**End-of-week checklist**

Tick each one when you can do it without looking at the notes:

- [ ] Explain what the browser does with HTML and CSS files
- [ ] Write the HTML starter from memory
- [ ] Use semantic tags: header, nav, main, section, article, footer
- [ ] Add headings, paragraphs, links, images with alt text and lists
- [ ] Build a form with labels and a simple table
- [ ] Style elements with element, class and id selectors
- [ ] Use colours, CSS variables and a Google Font
- [ ] Explain the box model and use box-sizing: border-box
- [ ] Build a navbar with Flexbox
- [ ] Build a card grid with CSS Grid
- [ ] Make a layout change with a media query
- [ ] Publish a page with GitHub Pages

**Glossary**

| Term | Meaning |
| --- | --- |
| HTML | The language for a page's content and structure |
| CSS | The language for how a page looks |
| Element | A piece of HTML: opening tag, content, closing tag |
| Attribute | Extra information on a tag, like `href` or `alt` |
| Semantic tag | A tag that describes its content, like `<nav>` or `<footer>` |
| Selector | The part of a CSS rule that chooses what to style |
| Class | A reusable name you give elements to style them (`.card`) |
| Box model | Content, padding, border and margin around every element |
| Flexbox | A layout for lining things up in one direction |
| Grid | A layout for rows and columns |
| Media query | CSS that only applies at certain screen widths |
| Responsive | A page that adapts to any screen size |
| Alt text | A text description of an image for screen readers |
| DevTools | The browser's built-in tools for inspecting pages |
