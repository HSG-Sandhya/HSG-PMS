// PM2 process definition for the Sandhya Grand API/admin server.
//
// SINGLE fork instance, on purpose. Five things live in process memory and break
// with a second worker: the Socket.IO in-memory adapter (rooms split), OTP codes
// (send and verify land on different workers), logout/session revocation (a
// logout binds only on the worker that served it), the in-process schedulers
// (JWT rotation + hold-expiry sweep run once PER worker), and rate limits
// (per-worker counters multiply every limit, login lockout included).
//
// Do NOT bump `instances` without Redis backing all of those plus a job lock.
// The full verified inventory, and what each scaling step needs, is in
// server/MULTI_TENANT.md → "Why the API runs as ONE process".
//
// Usage (from the repo root on the VPS):
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save            # persist across reboots (pair with `pm2 startup`)
//   pm2 logs sandhya-api
//   pm2 reload sandhya-api   # zero-downtime restart after a server-code deploy

module.exports = {
  apps: [
    {
      name: "sandhya-api",
      cwd: "/var/www/sandhyagrand/server",
      script: "server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      // NODE_ENV is set here AND in server/.env. PM2's value wins because the
      // app's dotenv loader does not override already-set process.env vars.
      env: {
        NODE_ENV: "production",
      },
      // Everything else (MONGODB_URI, JWT_SECRET, secrets…) is read from
      // server/.env by config/env.js — do not duplicate secrets in this file.
      error_file: "/var/log/sandhya/api-error.log",
      out_file: "/var/log/sandhya/api-out.log",
      merge_logs: true,
      time: true,
    },

    // ── Control plane (multi-tenant operator console) ────────────────────────
    // Separate process, separate port, separate database — it imports no hotel
    // schemas and must not share this app's lifecycle. Start it only once the
    // platform is actually in use; a single-hotel deployment does not need it.
    //
    //   pm2 start deploy/ecosystem.config.cjs --only sandhya-platform
    //
    // Config comes from platform/.env (see deploy/env/platform.env.production.example).
    {
      name: "sandhya-platform",
      cwd: "/var/www/sandhyagrand/platform",
      script: "server.js",
      interpreter: "node",
      exec_mode: "fork",
      // Single instance, like the API: the rate limiter keeps its counters in
      // process memory, so a second worker would double every effective limit.
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/sandhya/platform-error.log",
      out_file: "/var/log/sandhya/platform-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
