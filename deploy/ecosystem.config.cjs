// PM2 process definition for the Sandhya Grand API/admin server.
//
// SINGLE fork instance, on purpose: the app runs in-process schedulers (JWT
// rotation, tentative-hold expiry sweep) and uses Socket.IO with the default
// in-memory adapter. Cluster mode would duplicate those timers and split socket
// rooms across workers, so do NOT bump `instances` without adding a Redis
// adapter + a shared job lock first.
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
  ],
};
