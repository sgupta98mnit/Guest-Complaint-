/**
 * Where this app is mounted.
 *
 * Vite injects `BASE_URL` from the `base` option in vite.config.js, which is
 * driven by VITE_BASE_PATH at build time. One variable therefore controls three
 * things that must agree, and getting any of them wrong breaks the deployment
 * in a different way:
 *
 *   1. asset URLs in index.html  — wrong and the browser 404s on the JS bundle
 *   2. the router's basename     — wrong and in-app links leave the app
 *   3. the API request prefix    — wrong and every fetch hits the wrong origin path
 *
 * Locally BASE_URL is "/" so this is "" and nothing changes.
 * Deployed under /projects/asett/ it is "/projects/asett".
 */
export const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Prefix an absolute app path with the base. `apiPath('/api/x')` → `/projects/asett/api/x`. */
export const withBase = (path) => `${BASE_PATH}${path}`;
