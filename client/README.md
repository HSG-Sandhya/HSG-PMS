# Admin PMS (client)

The staff-facing single-page app for Hotel Sandhya Grand: bookings, rooms,
guests, housekeeping, restaurant/POS, banquet, accounting, payroll and settings.

Built with Create React App (`react-scripts` 5), React 19, MUI 9 and React
Router 7. In production it is a static bundle served by the Node API at
`admin.sandhyagrand.in`, so the app and the API share one origin.

## Running it

```bash
npm install
npm start        # http://localhost:3001  (NOT :3000 — see package.json)
npm run build    # production bundle into build/
npx eslint src/  # lint
```

The dev server runs on **3001** because the public website occupies 3000.

## Talking to the API

`REACT_APP_API_URL` overrides the API base; leave it unset and requests go to
`/api` on the current origin, which is what production wants. The CRA dev proxy
forwards `/api` to `http://localhost:5002`.

Every request goes through `src/api/axiosInstance.js`, which sets
`withCredentials` so the session cookie is sent, and which owns the 401 handling
that clears local state and redirects to `/login`.

## Authentication

The session is an **HttpOnly cookie** issued by the server. The JWT is not in
`localStorage` and JavaScript cannot read it, so:

- `src/services/authService.js` is the only place that logs in, refreshes,
  fetches the session or logs out.
- `src/services/authStorage.js` is the only definition of what the browser keeps
  — a cached user profile for first paint, never proof of authentication.
- "Am I signed in?" is answered by asking the server (`fetchSession`), because
  nothing local can see the credential.

## Routes and permissions

`src/config/routes.js` is the single source of truth. Each entry carries its
path, the permissions that open it (any one grants access), the lazily-loaded
component, and optional sidebar metadata. The router, the sidebar and the
landing-page choice are all derived from it — add a page there, not in three
places.

The server is authoritative. Everything here is UX: it decides what the UI
offers, never what the API allows.

## PWA

`public/service-worker.js` is cache-first for hashed static assets and never
caches API, Socket.IO or upload traffic. Registration failures are logged rather
than swallowed, so a broken install is visible. Icons come from
`icon-192.png` / `icon-512.png` via `public/manifest.json`.

## Tests

The client has no test suite yet. Lint and a successful `npm run build` are the
current gate, both enforced by CI (`.github/workflows/ci.yml`). Server-side
regression and smoke tests live in `server/test/`.

## Deployment

Built here and rsynced to the VPS as static files; the Node API serves them.
See `deploy/DEPLOY.md`.
