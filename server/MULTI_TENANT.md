# Multi-tenancy (database-per-hotel)

This backend serves many hotels from one codebase and one MongoDB cluster, with
**one database per hotel**. This is the Phase-1 backend foundation.

## How it works

```
Request  taj.example.com/api/bookings
   │
   ├─ resolveTenant middleware (middleware/resolveTenant.js)
   │     • parse subdomain  "taj"
   │     • look up tenant in the CONTROL database (cached ~60s)
   │     • pick that hotel's DB connection  (baseConn.useDb("hotel_taj"))
   │     • runWithTenant({ tenant, conn }, next)      ← AsyncLocalStorage
   │
   └─ controllers/helpers use models exactly as before:
         Booking.find(...)   →  resolves on the *current* hotel's DB
```

- **`db/tenantContext.js`** — an `AsyncLocalStorage` holds the current tenant +
  its Mongo `Connection` for the life of a request. `getTenantConnection()`
  returns it, or the base connection when there's no context (startup jobs,
  scripts) unless `TENANCY_STRICT=true`.
- **`db/modelRegistry.js`** — every model file calls `registerModel("Name", schema)`
  instead of `mongoose.model(...)`. It stores the schema and returns a **Proxy**
  that, on each access, compiles/fetches the real model on the current tenant's
  connection. So `import Booking from "../models/Booking.js"` transparently hits
  the right database — no call-site changes.
- **`db/tenantConnection.js`** — `useDb(name, { useCache: true })` gives each
  hotel its own database **sharing the base connection's socket pool**, so
  database-per-tenant does not multiply connections.
- **`models/control/Tenant.js`** — the tenant registry, stored in the control
  database (not any hotel's DB).

The original single-tenant database is untouched: reserved/apex hosts
(`admin.sandhyagrand.in`, `sandhyagrand.in`, the server IP, `localhost`) resolve
to the **base connection** = the database in `MONGODB_URI`. It keeps working with
zero config, effectively as "hotel #1".

## New environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `CONTROL_DB_NAME` | `pms_control` | Database holding the tenant registry |
| `BASE_DOMAINS` | *(heuristic)* | Comma list of apex domains, e.g. `sandhyagrand.in,yourpms.com`. **Set this in production.** Anything ending in one of these has its leading label treated as the hotel subdomain. Unset → "3+ labels ⇒ first label is the subdomain" heuristic (fine for simple domains, wrong for multi-part TLDs like `co.uk`). |
| `RESERVED_SUBDOMAINS` | `www,api,admin,app,static,assets,cdn,mail` | Subdomains that are never a hotel; they use the base DB |
| `TENANT_CACHE_TTL_MS` | `60000` | How long a host→tenant lookup is cached |
| `TENANCY_STRICT` | `false` | `true` = throw instead of falling back to the base DB when there's no tenant context (catches unscoped queries) |

## Onboard a new hotel

```bash
cd server
node scripts/createTenant.js \
  --name="Hotel Taj" --subdomain=taj \
  --admin-username=manager --admin-password='Secret123@' \
  --admin-phone=9876543210 --admin-firstname=Ravi --admin-lastname=Kumar \
  --admin-email=manager@taj.com
```

This creates the `hotel_taj` database, seeds the System Administrator role,
Management department, a Settings doc, and the first admin, then flips the tenant
to `active`. Point `taj.<your-domain>` DNS at this server and ensure your domain
is in `BASE_DOMAINS`.

Register the existing hotel in the control plane (optional, for visibility):

```bash
node scripts/registerExistingTenant.js --name="Hotel Sandhya Grand" \
  --subdomain=sandhya --db=<existing-db-name>
```

## Auth & real-time isolation (DONE — Phase 2a)

The JWT secret is shared across hotels, so a valid signature alone does not prove
a token belongs to the hotel being addressed. Every token now carries a `tenant`
slug (stamped at login in `authController.js`), enforced on every path:

- **HTTP** — `middleware/auth.js` `authenticateToken` (which trusts the decoded
  token with no DB lookup) rejects a token whose `tenant` != the resolved host.
  `optionalAuth` and `permissionMiddleware.js` do the same. Helper:
  `tokenMatchesCurrentTenant()` in `db/tenantContext.js`.
- **Sockets** — `config/socket.js` resolves the hotel from the handshake host
  (`resolveTenantForHost`), rejects a token minted for another hotel, and joins
  only per-tenant rooms (`staff:<slug>`, `housekeeping:<slug>`). Emit helpers
  target the current hotel's rooms via tenant context.
- **Back-compat** — tokens with no `tenant` claim are treated as `base`, so
  existing Sandhya Grand sessions keep working but such a token can never be used
  against another hotel's subdomain.

> Deployment note: the reverse proxy must forward the original `Host` (or
> `X-Forwarded-Host`) on the WebSocket upgrade for socket tenant resolution.

## Control plane lives in a SEPARATE app (`../platform`)

The central system that manages hotels — the tenant registry, platform admins,
provisioning, and the operator console — is its own standalone service in
[`../platform`](../platform), **not** part of this hotel app. See
`platform/README.md`.

This app's only relationship to it: both point at the same MongoDB cluster and
the same `CONTROL_DB_NAME`. This app **reads** the tenant registry (in
`resolveTenant` and the hold-expiry sweep) to route subdomains to databases; the
platform app **writes** it. They are separate processes, so a newly created or
suspended hotel is picked up here within the tenant-cache TTL
(`TENANT_CACHE_TTL_MS`, ~60s) — there is no shared in-memory cache.

What this app keeps: `models/control/Tenant.js` (read-only use), the tenant
runtime (`db/`, `middleware/resolveTenant.js`), tenant-scoped models, JWT/socket
isolation, per-tenant payments, and the public branding endpoint. What moved out:
platform routes/controllers, `PlatformAdmin`, provisioning, the CLI scripts, and
the `/platform` console.

## Branded hotel frontend (DONE — Phase 2c)

Each hotel's app is served on its own subdomain, and the client calls `/api`
relatively, so the login screen resolves to that hotel automatically:

- **Login branding** — `client/src/pages/Auth/Login.js` fetches
  `GET /api/settings/public/branding` (no auth; new endpoint returning
  `{ hotelName, tagline, logo }` from that hotel's Settings) and shows the hotel's
  name, tagline and logo (falling back to the hotel's initial, then a generic
  glyph). Cached per-origin so repeat visits paint instantly; also sets the tab
  title. Theme colours were already per-hotel via `/public/theme`.
- **In-app branding** — the sidebar/app read `settings.hotelProfile` (name/logo),
  which is now tenant-scoped by the backend, so the whole app is branded per hotel
  once signed in — no extra work needed.

> Each hotel must set its logo in Settings → Profile (`hotelProfile.logo`). The
> old login hardcoded the bundled `sandhya-logo.png`; confirm the base hotel's
> logo is set in Settings so the branded login shows it (the app sidebar already
> uses this field, so it is almost certainly populated).

## Per-tenant payments (DONE — Phase 2d)

`services/paymentService.js` no longer caches a single hotel's Razorpay client.
It resolves the gateway config **per hotel**, keyed by tenant slug: `getConfig()`
reads the current tenant's `Settings.payment.razorpay` (via tenant context) and
caches one `{ razorpayInstance, keySecret, environment, isDemo }` per slug. Each
hotel gets its own client + key secret; `reload()` (called after a hotel saves
its Payments settings) invalidates only that hotel's entry.

`verifyPaymentSignature()` and `isDemoMode()` became async (they resolve the
tenant's config); their 4 call sites in `websiteController.js` now `await`. HMAC
verification uses the paying hotel's own secret — a forged `order_demo_*` id in a
live hotel is still fully HMAC-checked, never auto-verified.

## Not yet done (Phase 2e+ — nice-to-have before scaling)

- **Uploads** — `/uploads` is shared on disk; namespace files per tenant (or move
  to per-tenant object storage) so filenames can't collide across hotels.
- **Atlas tier** — the shared tier caps total collections/namespaces (~15 hotels
  at 32 collections each). Move to a dedicated cluster (M10+) before scaling;
  this also removes the burst-throttling seen on the shared tier.
