// Provision a hotel from the command line (same as POST /api/platform/hotels).
//
//   node scripts/createTenant.js \
//     --name="Hotel Taj" --subdomain=taj \
//     --admin-username=manager --admin-password='Secret123@' \
//     --admin-phone=9876543210 --admin-firstname=Ravi --admin-lastname=Kumar
import "../config/env.js";
import { connectDB, closeDB } from "../config/db.js";
import { createTenant } from "../services/provisioning.js";

const flags = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : [];
  })
);

const run = async () => {
  const opts = {
    name: flags.name,
    slug: flags.slug,
    subdomain: flags.subdomain,
    dbName: flags.db,
    customDomain: flags["custom-domain"],
    plan: flags.plan,
    contactEmail: flags["contact-email"],
    admin: {
      username: flags["admin-username"],
      password: flags["admin-password"],
      phone: flags["admin-phone"],
      firstName: flags["admin-firstname"],
      lastName: flags["admin-lastname"],
      email: flags["admin-email"],
    },
  };

  if (!opts.name) throw new Error("--name is required");
  const a = opts.admin;
  if (!a.username || !a.password || !a.phone || !a.firstName) {
    throw new Error("--admin-username, --admin-password, --admin-phone, --admin-firstname are required");
  }
  if (!/^\d{10}$/.test(a.phone)) throw new Error("--admin-phone must be 10 digits");

  await connectDB();
  const tenant = await createTenant(opts);
  console.log("\n✅ Hotel provisioned:");
  console.log("   name      :", tenant.name);
  console.log("   subdomain :", tenant.subdomain);
  console.log("   database  :", tenant.dbName);
  console.log("   status    :", tenant.status);
  console.log("   admin     :", a.username, `(phone ${a.phone})\n`);
};

run()
  .then(async () => { await closeDB().catch(() => {}); process.exit(0); })
  .catch(async (err) => { console.error("\n❌", err.message, "\n"); await closeDB().catch(() => {}); process.exit(1); });
