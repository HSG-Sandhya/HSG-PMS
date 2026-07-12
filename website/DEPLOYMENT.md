# Publishing the public website

The public site (`website/`) is a static Create React App bundle. Every dynamic
feature — room list, availability, bookings, Razorpay payments, restaurant &
room-service ordering, banquet enquiries, contact form — calls the backend under
`/api/website/...`. Those paths are **relative**, so where the API lives relative
to the site is the only thing you must decide before publishing.

Locally this works via the dev-server proxy in `package.json`
(`"proxy": "http://localhost:5002"`). That proxy exists **only** for
`npm start`; it is not part of the production `build/`. So in production the
requests go to whichever origin serves the files.

## Why the site and the admin app can't share one origin

The admin PMS (`client/`) already owns `/`, `/rooms`, `/restaurant`, `/login`,
`/dashboard`, … and the public site also uses `/`, `/rooms`, `/restaurant`. The
paths collide, so the two apps must be served from **different origins**. Pick
one of the two setups below.

### Option A — Same origin as the API (simplest, no CORS)

Serve `website/build` from a host that also fronts the API at `/api` (e.g. the
site's own Nginx forwarding `/api` to the Node server, or the Node server
answering the site's hostname). Leave `REACT_APP_API_URL` empty — relative paths
resolve on the same origin. Nothing else to configure.

### Option B — Cross-origin (site and API on different domains)

Typical split: site on `https://sandhyagrand.in`, API/admin on
`https://admin.sandhyagrand.in`.

1. In `website/`, set `REACT_APP_API_URL=https://admin.sandhyagrand.in` (see
   `.env.example`) and `npm run build`.
2. On the **server**, set `NODE_ENV=production` and
   `ALLOWED_ORIGINS=https://sandhyagrand.in`. In production the server enforces
   CORS and blocks any origin not in that list (it is currently unset), so the
   browser calls will fail without this.

## Build & serve

```bash
cd website
npm run build          # outputs ./build  (set env vars first if using Option B)
npx serve -s build     # or hand ./build to Nginx / Netlify / any static host
```

The `-s` flag (SPA fallback) is required so deep links like `/booking` or
`/room-service/101` return `index.html` instead of 404.
