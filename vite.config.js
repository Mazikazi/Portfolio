import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Public address of the site, used by the share tags in index.html. Vercel and Netlify provide one of these
// during their build; set SITE_URL yourself for any other host. Without one the tags fall back to relative paths.
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.URL || '';
const site = host && (/^https?:\/\//.test(host) ? host : `https://${host}`).replace(/\/+$/, '');

export default defineConfig({
  plugins: [
    react(),
    // 'pre' so the placeholder is gone before Vite scans the page for asset links (it chokes on the stray %)
    { name: 'site-url', transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', site) } },
  ],
});
