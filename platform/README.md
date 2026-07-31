# PMS Platform (control plane)

The **central hotel system** — a standalone service that manages every hotel on
the platform. It is deliberately **separate** from any hotel's app: its own
process, port, and deploy. It shares only one thing with the hotels — the
`pms_control` database on the same MongoDB cluster.

## What it does

- **Tenant registry** — one record per hotel (`slug`, `subdomain`, `dbName`,
  `status`, `plan`) in the control database. Hotel apps read this to route a
  subdomain to the right database; this service owns writes.
- **Platform admins** — operator accounts (separate identity space from hotel
  staff), with first-run bootstrap + login. Tokens carry `scope:"platform"`.
- **Provisioning** — creates a hotel: a registry row + a freshly seeded hotel
  database (admin role, Management department, a Settings doc with the hotel's
  name, and the first admin user). Seeding uses **raw inserts**, so this service
  imports **no hotel schemas** — it stays fully decoupled from the hotel app.
- **Operator console** — a small web UI served at `/` that drives the API.

## What it does NOT do

- It never serves hotel traffic and never touches a hotel's data beyond the
  one-time seed. Hotels run in their own app (`../server`).

## Run

```bash
cp .env.example .env      # fill MONGODB_URI, JWT_SECRET, CONTROL_DB_NAME, BASE_DB_NAME
npm install
npm run dev               # http://localhost:5100  (console at /)
```

- **CONTROL_DB_NAME** must match the hotel app's `CONTROL_DB_NAME` so both see the
  same registry.
- **BASE_DB_NAME** = the base/original hotel's database, so provisioning refuses
  to reuse it.
- **JWT_SECRET** may be the same as the hotel app's (platform tokens are scoped).

## Onboard a hotel

Console: open `/`, create the first platform admin, then **+ New hotel**.

CLI:
```bash
node scripts/createTenant.js --name="Hotel Taj" --subdomain=taj \
  --admin-username=manager --admin-password='Secret123@' \
  --admin-phone=9876543210 --admin-firstname=Ravi
```

Then point `taj.<your-domain>` DNS at a hotel-app deployment and set that hotel
app's `BASE_DOMAINS`. The hotel app picks the new hotel up from the shared
registry within its tenant-cache TTL (~60s).

## Relationship to the hotel app

```
            ┌─────────────────────────┐        ┌──────────────────────────┐
            │  PMS Platform (this)     │ writes │  pms_control (registry)  │
            │  admin.yourpms.com       ├───────▶│  tenants, platform admins│
            └─────────────────────────┘        └──────────┬───────────────┘
                                                           │ reads
                                              ┌────────────▼─────────────┐
                                              │  Hotel app (../server)   │
                                              │  taj.yourpms.com, …      │
                                              │  routes subdomain → DB   │
                                              └──────────────────────────┘
```
