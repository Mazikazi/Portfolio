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
    particles.js       star dust and the particle portrait (canvas)
  styles.css           all styling
```

The intro does not use React state per frame. `engine.js` writes styles straight to the elements, so React never re-renders during the animation.

## Intro behaviour

- Plays once per browser tab. A reload in the same tab goes straight to the portrait.
- "Skip intro" (bottom left) jumps to the end.
- With "reduce motion" turned on in the operating system, the intro is skipped.
