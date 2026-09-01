# VPS deployment runbook — Hotel Sandhya Grand

From a bare Ubuntu VPS to live HTTPS in one sitting. Two public origins:

| What | Origin | Served by |
|------|--------|-----------|
| Public website (`website/`) | `https://sandhyagrand.in` (+ `www`) | nginx static files |
| Admin PMS + API (`client/` + `server/`) | `https://admin.sandhyagrand.in` | Node/Express via PM2, fronted by nginx |

The database stays on **MongoDB Atlas** — we do not run Mongo on the VPS.

Files referenced below live in this `deploy/` folder:

```
deploy/
├── DEPLOY.md                              ← this runbook
├── ecosystem.config.cjs                   ← PM2 process definition
├── nginx/sandhyagrand.in.conf             ← public site vhost
├── nginx/admin.sandhyagrand.in.conf       ← admin/API reverse-proxy vhost
└── env/
    ├── server.env.production.example      ← → copy to server/.env
    └── website.env.production.example     ← → copy to website/.env.production
```

---

## 0. What to buy

**VPS:** 2 vCPU / **4 GB RAM** / 80 GB SSD, **Ubuntu 24.04 LTS**, in an Indian region
for low latency to guests and to Atlas.

- **DigitalOcean** — Bangalore (BLR1) region, "Basic" 4 GB droplet.
- **AWS Lightsail** — Mumbai (ap-south-1), 4 GB plan.
- **Hostinger KVM 2** — budget option, Mumbai available.

> Why 4 GB: `react-scripts build` for the two React apps is memory-hungry and OOM-kills
> on 1 GB. 4 GB builds comfortably. If you must use a 2 GB box, add the swap file in
> step 2 **or** build the apps on your laptop and upload the `build/` folders (step 6, Option B).

Make sure your Atlas cluster is reachable and note its region — pairing the VPS region
with the Atlas region keeps queries fast (relevant on shared tiers).

---

## 1. DNS (do this first — records need time to propagate)

At your domain registrar for `sandhyagrand.in`, create three **A** records pointing at
the VPS public IP:

| Type | Name    | Value            |
|------|---------|------------------|
| A    | `@`     | `<VPS_PUBLIC_IP>`|
| A    | `www`   | `<VPS_PUBLIC_IP>`|
| A    | `admin` | `<VPS_PUBLIC_IP>`|

Add a fourth record **only if you are running the multi-hotel control plane**
(section 11 — a single-hotel deployment does not need it):

| Type | Name       | Value            |
|------|------------|------------------|
| A    | `platform` | `<VPS_PUBLIC_IP>`|

Verify before requesting certificates:

```bash
dig +short sandhyagrand.in
dig +short admin.sandhyagrand.in
```

Both must return your VPS IP.

---

## 2. Initial server setup & hardening

SSH in as `root` (or the provider's default user), then:

```bash
# --- create a non-root sudo user ---
adduser deploy
usermod -aG sudo deploy

# --- copy your SSH key to the new user (run from YOUR laptop instead if easier) ---
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # if root already has your key

# --- system updates ---
apt update && apt upgrade -y

# --- firewall: allow SSH + web only ---
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'      # opens 80 + 443
ufw --force enable

# --- brute-force protection + automatic security patches ---
apt install -y fail2ban unattended-upgrades
systemctl enable --now fail2ban
dpkg-reconfigure -plow unattended-upgrades   # choose "Yes"

# --- 2 GB swap (safe headroom for builds; skip if you have >=4 GB and won't build here) ---
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Harden SSH — edit `/etc/ssh/sshd_config`, set:

```
PermitRootLogin no
PasswordAuthentication no
```

then `systemctl restart ssh`. **Open a second SSH session as `deploy` and confirm it works
before closing root.** From here on, work as `deploy` (`ssh deploy@<VPS_IP>`).

---

## 3. Install the runtime stack

```bash
# Node.js 22 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# PM2 process manager
sudo npm install -g pm2

node -v && npm -v && nginx -v   # sanity check
```

Certbot for TLS (snap is the maintained path):

```bash
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

---

## 4. Get the code onto the VPS

```bash
sudo mkdir -p /var/www/sandhyagrand
sudo chown -R deploy:deploy /var/www/sandhyagrand

git clone <your-repo-url> /var/www/sandhyagrand
cd /var/www/sandhyagrand
```

> No git remote? From your laptop — exclude deps, build output, secrets, git
> history, and local DB backups (they don't belong on the server):
>
> ```bash
> rsync -avz \
>   --exclude node_modules --exclude build \
>   --exclude '.env' --exclude '.env.*' \
>   --exclude '.git' --exclude '/server/backups' \
>   ./PMS-HSG/ deploy@<VPS_IP>:/var/www/sandhyagrand/
> ```
>
> `server/uploads/` is intentionally **not** excluded — those are real images the
> site serves, so shipping them seeds the VPS. Production secrets get created
> fresh on the server in step 5 from the `deploy/env/*.example` templates.

Create the log dir PM2 writes to:

```bash
sudo mkdir -p /var/log/sandhya && sudo chown -R deploy:deploy /var/log/sandhya
```

---

## 5. Configure & install the server (API + admin)

```bash
cd /var/www/sandhyagrand/server

# production env
cp ../deploy/env/server.env.production.example .env
nano .env         # fill MONGODB_URI, JWT_SECRET, Razorpay/SMTP/SMS/Surepass secrets

# production deps only
npm ci --omit=dev
```

Then **allowlist the VPS IP in Atlas** (Atlas → Network Access → Add IP Address →
your VPS public IP). Quick connectivity check:

```bash
node -e "import('mongoose').then(m=>m.default.connect(process.env.MONGODB_URI).then(()=>{console.log('Atlas OK');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)}))" --experimental-vm-modules 2>/dev/null || echo "run this after 'node --env-file=.env' style, or just trust the PM2 start below"
```

(If that one-liner is fiddly, skip it — the PM2 start in step 7 will surface any DB error in the logs.)

---

## 6. Build the two React apps

### Option A — build on the VPS (needs the 4 GB box or the swap file)

```bash
# Admin dashboard (served by the Node server at admin.sandhyagrand.in)
cd /var/www/sandhyagrand/client
npm ci
npm run build

# Public website — API URL must be baked in
cd /var/www/sandhyagrand/website
npm ci
REACT_APP_API_URL=https://admin.sandhyagrand.in npm run build
```

### Option B — build on your laptop, upload the results (no build RAM needed on VPS)

```bash
# on your laptop, inside the repo
( cd client && npm run build )
( cd website && REACT_APP_API_URL=https://admin.sandhyagrand.in npm run build )

rsync -avz client/build/  deploy@<VPS_IP>:/var/www/sandhyagrand/client/build/
rsync -avz website/build/ deploy@<VPS_IP>:/var/www/sandhyagrand/website/build/
```

Either way you end with `client/build/` and `website/build/` populated on the VPS. The Node
server auto-detects and serves `client/build` (see `server/app.js`); nginx serves `website/build`.

---

## 7. Start the API with PM2

```bash
cd /var/www/sandhyagrand
pm2 start deploy/ecosystem.config.cjs
pm2 logs sandhya-api --lines 40      # look for "Server ready" and DB "connected"

pm2 save                              # remember the process list
pm2 startup systemd                   # prints one sudo command — run it to auto-start on reboot
```

Local smoke test (still plain HTTP, pre-nginx):

```bash
curl -s http://127.0.0.1:5002/health
# → {"status":"healthy", ... "database":{"status":"connected"}}
```

---

## 8. nginx vhosts + HTTPS

```bash
# install both site configs
sudo cp /var/www/sandhyagrand/deploy/nginx/sandhyagrand.in.conf        /etc/nginx/sites-available/
sudo cp /var/www/sandhyagrand/deploy/nginx/admin.sandhyagrand.in.conf  /etc/nginx/sites-available/

sudo ln -s /etc/nginx/sites-available/sandhyagrand.in.conf       /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.sandhyagrand.in.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default    # drop the "Welcome to nginx" default

sudo nginx -t && sudo systemctl reload nginx
```

Now issue certificates — certbot edits both vhosts to add TLS + the HTTP→HTTPS redirect:

```bash
sudo certbot --nginx \
  -d sandhyagrand.in -d www.sandhyagrand.in \
  -d admin.sandhyagrand.in \
  --redirect --agree-tos -m sandhyahsg@gmail.com

sudo nginx -t && sudo systemctl reload nginx
```

Auto-renewal is installed by the certbot snap; confirm with `sudo certbot renew --dry-run`.

---

## 9. Verify the live deployment

```bash
curl -sI https://sandhyagrand.in            # 200, HTML
curl -s  https://admin.sandhyagrand.in/health   # healthy + database connected
```

In a browser:

- `https://sandhyagrand.in` → public site loads; open DevTools → Network and confirm
  `/api/website/...` requests hit `admin.sandhyagrand.in` and return **200** (not CORS-blocked).
- `https://admin.sandhyagrand.in` → admin login loads; log in; confirm real-time bits work
  (a Socket.IO connection to `admin.sandhyagrand.in` shows `101 Switching Protocols`).
- Upload an image somewhere in the admin and confirm it saves and re-displays (proves
  `/uploads` write + serve through nginx).

---

## 10. Redeploying later

```bash
cd /var/www/sandhyagrand && git pull

# server code changed:
( cd server && npm ci --omit=dev ) && pm2 reload sandhya-api

# admin UI changed:
( cd client && npm ci && npm run build )

# public site changed:
( cd website && npm ci && REACT_APP_API_URL=https://admin.sandhyagrand.in npm run build )
```

Static rebuilds need no restart. `pm2 reload` is zero-downtime for the API.

---

## 11. Control plane (multi-hotel only — optional)

`platform/` is a **separate service**: its own process, port, database and
deploy. The hotel API does not import it and does not need it running. Skip this
entire section unless you are hosting more than one hotel.

> **This is the most privileged surface you will deploy.** A session on the
> control plane can create, suspend and reconfigure *every* hotel. The vhost
> below ships with an IP allowlist enabled for that reason — the login form is
> the second line of defence, not the first.

```bash
# 1. Install (production deps only)
cd /var/www/sandhyagrand/platform && npm ci --omit=dev

# 2. Environment
cp /var/www/sandhyagrand/deploy/env/platform.env.production.example .env
nano .env       # fill MONGODB_URI, JWT_SECRET (same as the API), PLATFORM_SETUP_KEY
chmod 600 .env

# 3. Start under PM2 (the ecosystem file defines "sandhya-platform")
cd /var/www/sandhyagrand
pm2 start deploy/ecosystem.config.cjs --only sandhya-platform
pm2 save

# 4. Confirm it is up and bound to loopback only
curl -s http://127.0.0.1:5100/health     # → {"status":"ok","service":"pms-platform"}
```

**nginx + TLS**

```bash
sudo cp deploy/nginx/platform.sandhyagrand.in.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/platform.sandhyagrand.in.conf /etc/nginx/sites-enabled/

# EDIT FIRST: the vhost denies everyone by default. Add your office/VPN IPs to
# the allow list, or you will lock yourself out of the console.
sudo nano /etc/nginx/sites-available/platform.sandhyagrand.in.conf

sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d platform.sandhyagrand.in
```

**Create the first operator (once)**

`PLATFORM_SETUP_KEY` must be set, and `/setup` self-closes the moment one admin
exists. Generate the key with `openssl rand -hex 32`, then:

```bash
curl -X POST https://platform.sandhyagrand.in/api/platform/setup \
  -H 'Content-Type: application/json' \
  -H 'x-setup-key: <PLATFORM_SETUP_KEY>' \
  -d '{"username":"operator","password":"<long-password>","fullName":"Ops"}'
```

Then **remove `PLATFORM_SETUP_KEY` from `platform/.env`** and `pm2 reload
sandhya-platform`. It has no further use and is a standing risk.

**Backups.** The control plane's data is the tenant registry and the operator
accounts, in the `CONTROL_DB_NAME` database (default `pms_control`) — a
*different database* from any hotel's. Back it up explicitly; a per-hotel dump
will not contain it:

```bash
mongodump --uri "$MONGODB_URI" --db pms_control --out /var/backups/pms-control/$(date +%F)
```

**Monitoring.** `GET /health` on port 5100 returns `{"status":"ok"}`. Point your
uptime check at `https://platform.sandhyagrand.in/health` — but note the vhost's
IP allowlist will block an external monitor unless you allow its addresses, so
prefer a check that runs on the VPS itself:

```bash
pm2 status sandhya-platform
pm2 logs sandhya-platform --lines 50
```

**Redeploying** (add to section 10 when the platform changes):

```bash
( cd platform && npm ci --omit=dev ) && pm2 reload sandhya-platform
```

---

## Gotchas checklist

- [ ] **Atlas IP allowlist** includes the VPS IP, or the API can't connect (health = `degraded`).
- [ ] `server/.env` has `NODE_ENV=production`, `ALLOWED_ORIGINS`, and `TRUST_PROXY=1`.
      Without `ALLOWED_ORIGINS`, the public site's API calls are CORS-blocked in production.
- [ ] Website was built **with** `REACT_APP_API_URL` set — otherwise it calls itself
      (`sandhyagrand.in/api/...`), which 404s. Rebuild if you change the value.
- [ ] Keep PM2 at **one instance** — see the note in `ecosystem.config.cjs`.
- [ ] Uploads (`server/uploads/`) live on the VPS disk. Include that folder in your backups;
      it is not in git and not on Atlas.
- [ ] If nginx errors with "duplicate map $connection_upgrade", remove the map block from
      `admin.sandhyagrand.in.conf` (your nginx.conf already defines it).
- [ ] **Control plane (if deployed):** the nginx vhost denies all by default — add your own
      IPs before wondering why the console 403s. Keep `sandhya-platform` at one instance
      (its rate limiter counts in process memory). Back up the `pms_control` database
      separately from the hotel databases. Delete `PLATFORM_SETUP_KEY` once the first
      operator exists.
