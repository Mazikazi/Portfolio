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
- `services`: the cards. `skills`: one cascade of logo tiles across the whole screen, a lane per group, each lane sliding along its diagonal (every other lane the other way). Hovering a lane pauses it. With the particle cloud on, the lanes first stand still and the particles draw them a tile at a time, from the top lane down; each lane starts sliding once it is drawn (`src/fx/cascade.js`, its pace is `STEP`). The group titles are only read out by screen readers. The logos are in `src/assets/logos.js`, keyed by the skill's name. A skill without a logo there gets a plain text tile.

## Change the photo

Replace `src/assets/portrait.jpg` (the hero) and `src/assets/portrait-end.jpg` (the second particle portrait, next to "Let's build something." in Contact). A cut-out of you on a black background looks best. A busy background turns into noise in the particle version.

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
    particles.js       star dust and the particle portraits (canvas)
  fx/
    cloud.js           the particle cloud that builds the sections (WebGL)
    cascade.js         the cloud drawing the skills cascade, tile by tile
  assets/logos.js      the skill logos (from Simple Icons)
  styles.css           all styling
```

The intro does not use React state per frame. `engine.js` writes styles straight to the elements, so React never re-renders during the animation.

## Opening scene

On a first visit the page starts as the most ordinary 404 there is: white, a huge "404", "Page not found", a line of explanation and a blue "Go back home" link, in the system font. The browser tab says "404 Not Found" and a phone's address bar goes white, so a visitor believes the site is broken. After 1.5 s the site's orb (a small copy of the particle cloud) streams in from the right as a swarm, gathers next to the 404 and says "hmm..." and "not on my watch.". Then it bursts open: the swarm spreads out from it over the whole screen like a wave and engulfs the page. Where the wave has passed, the white page is gone and the dark site shows through, with a smoky edge, and the letters crumble into crumbs that the wave carries off. The dots are dark on the white page and light where the site shows. Then the whole swarm rushes to the middle of the screen and collapses into one dot, which shoots off the top, and the dot of the original intro falls in. It lives in `src/hero/prologue.js`, which is a function of time like the engine.

- Every beat is a number in the timeline at the top of that file (`SWARM_IN`, `SAY`, `SWEEP_AT`, `SPREAD`, `GATHER_AT`, and so on). `SPREAD` is how long the wave takes to cross the screen, and `DOTS` is the size of the swarm.
- The crumbs are sampled from the real ink of the page, and each is born when the wave reaches its spot (`makeDust`).
- The wording of the fake page is in `drawText()` in `prologue.js`, and the orb's lines are in `SAY`.
- Sizes are in units of the digit height, so it scales with the screen.
- Crawlers and link previews skip the scene (a check in `index.html`), so a search engine never takes the homepage for an error page.
- Scene time and engine time line up at `HANDOFF`. In the browser console, `__seekP(seconds)` jumps inside the scene, and `__seek(seconds)` jumps inside the dot intro.

## Particles below the hero

As the hero portrait scatters on scroll, the same number of particles appear where its particles land, and gather into a cloud in the middle of the screen: a loose sheet of dots that folds like silk and turns as the page scrolls. It lives on a fixed WebGL canvas (`#fx`) behind the sections, in `src/fx/cloud.js`.

- Each heading, card and project row is built by it. As one scrolls in, a stream of particles spirals out of the cloud, swings forward and lands on the shape of its text and borders. The real element then fades in there, and the particles go back to the cloud. Each element is built once per visit.
- At the end of the page the cloud flows into the box of the second portrait and fades, while that portrait gathers. Like the hero portrait, it pushes away from the cursor, and it scatters when you scroll back up from it.
- The timing (`FLY`, `SHOW`, `BACK`) is at the top of `cloud.js`, and the cloud's shape is the `silk()` function in its shader.
- Every `<Reveal>` reports to the cloud through `useReveal()`. Whatever happens, an element that is on screen appears within 2.5 s, built or not.
- With reduce motion on, without WebGL, or for crawlers, the cloud is off and the sections fade in on scroll as before. The second portrait is then simply there.

## Intro behaviour

- Plays once per browser tab. A reload in the same tab goes straight to the portrait.
- "Skip intro" (bottom left) jumps to the end, from any point of the opening scene too.
- With "reduce motion" turned on in the operating system, the whole intro is skipped.
- Opening `/?intro` plays it again every time, even after a first visit and with reduce motion on, and it also turns the particle cloud on. Nothing on the site links to it. Crawlers still get the real page.
