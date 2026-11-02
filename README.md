# Mazin Kazi Portfolio

A dark developer portfolio built with React and Vite. An animated intro turns the name into the word PORTFOLIO, then a particle portrait forms from your photo.

## Run it

```bash
npm install
npm run dev      # development server with hot reload
npm run build    # production build in /dist
npm run preview  # preview the production build
```

Needs Node 18 or newer.

## Change the content

Everything you read on the page lives in `src/config.js`:

- `name`: shown in the nav and footer
- `intro`: the letters that fly in first (needs an "I" for the best effect)
- `role`: the two words under PORTFOLIO
- `email` and `links`: shown in Contact
- `about`: wrap a word in `**double stars**` to make it bold
- `projects`: each one with a description, stack and a GitHub `href` (leave `href` out for a plain row)
- `services` and `skills`: the cards

## Change the photo

Replace `src/assets/portrait.jpg`. A cut-out of you on a black background looks best. A busy background turns into noise in the particle version.

Visitors can also press "Use your photo" in the bottom right of the hero. That only changes the picture in their own browser.

## Share previews and icons

- The page title, description and social tags are in `index.html`.
- The icons and the share image are in `public/`: `icon.svg`, `favicon.ico`, `apple-touch-icon.png` and `og.png`.
- `og.png` is drawn from `scripts/og-card.html`. The command to redraw it is at the top of that file.
- The share tags need the site's full web address. Vercel and Netlify provide it during their build. Anywhere else, set `SITE_URL`, for example `SITE_URL=https://example.com npm run build`.

## Deploy

Push the project to GitHub, then import the repository on Vercel or Netlify. Accept the detected Vite settings (build command `npm run build`, output folder `dist`). No config file is needed. Every later push to the main branch redeploys the site.

## How it is organised

```
src/
  config.js            all text and settings
  App.jsx              page layout
  components/          Nav, About, Services, Projects, Skills, Contact, Reveal
  hooks/               scroll spy, word reveal, reveal on scroll
  hero/
    Hero.jsx           the hero markup (React)
    engine.js          the intro animation, a pure function of time
    prologue.js        the opening 404 scene that plays before it
    particles.js       star dust and the particle portrait (canvas)
  styles.css           all styling
```

The intro does not use React state per frame. `engine.js` writes styles straight to the elements, so React never re-renders during the animation.

## Opening scene

On a first visit the page starts as the most ordinary 404 there is: white, a huge "404", "Page not found", a line of explanation and a blue "Go back home" link, in the system font. The browser tab says "404 Not Found" and a phone's address bar goes white, so a visitor believes the site is broken. After 1.5 s two rectangle eyes slide in and say "oh..." and "let me fix it.". Then they erase the page in one continuous movement (three passes joined by rounded U-turns, a soft start, a steady cruise, a soft landing in the middle of the screen), leaving a trail of dust: the letters crumble into small crumbs that are dragged along, rise a little and fall. The eyes merge into a circle and throw it off the top of the screen, and the dot of the original intro falls in. It lives in `src/hero/prologue.js`, which is a pure function of time like the engine.

- Every beat is a number in the timeline at the top of that file (`EYES_IN`, `SAY`, `SWEEP_AT`, `SWEEP_DUR`, and so on). The eraser path is built in `layout()`.
- The dust is sampled from the real ink of the page, and each crumb is born when the eraser first reaches its spot (`makeDust`). Its size, count and speed are in that function.
- `node scripts/check-sweep.mjs` checks the maths of the sweep: no stops mid-sweep and no sharp corners in the path.
- The wording of the fake page is in `src/hero/Hero.jsx` (the `<text>` elements in `#proText`).
- Sizes are in units of the digit height, so it scales with the screen.
- Crawlers and link previews skip the scene (a check in `index.html`), so a search engine never takes the homepage for an error page.
- Scene time and engine time line up at `HANDOFF`. In the browser console, `__seekP(seconds)` jumps inside the scene, and `__seek(seconds)` jumps inside the dot intro.

## Intro behaviour

- Plays once per browser tab. A reload in the same tab goes straight to the portrait.
- "Skip intro" (bottom left) jumps to the end, from any point of the opening scene too.
- With "reduce motion" turned on in the operating system, the whole intro is skipped.
- Opening `/?intro` plays it again every time, even after a first visit and with reduce motion on. Nothing on the site links to it. Crawlers still get the real page.
