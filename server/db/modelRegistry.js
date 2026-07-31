// ── Per-connection model registry ────────────────────────────────────────────
//
// In a single-database app you compile a model once: `mongoose.model("Room", …)`
// binds it to the default connection forever. With one database per hotel we
// instead need the *same* schema compiled on each tenant's connection, and every
// `import Room from "../models/Room.js"` must transparently talk to whichever
// hotel's database the current request belongs to.
//
// So each model file calls registerModel("Room", schema) instead of
// mongoose.model(...). That:
//   1. stores the schema centrally, and
//   2. returns a Proxy that, on every access, resolves the real model on the
//      current tenant's connection (from tenantContext) and forwards to it.
//
// The net effect: controllers keep writing `Room.find(...)`, but the query runs
// against the current hotel's database with zero changes at the call site.

import { getTenantConnection } from "./tenantContext.js";

// name → Schema. Populated as model files are imported.
const schemas = new Map();

// Compile (or fetch the cached) model for `name` on a specific connection.
// conn.model(name, schema) throws if already compiled, so guard on conn.models.
export const getModelOn = (conn, name) => {
  const existing = conn.models[name];
  if (existing) return existing;
  const schema = schemas.get(name);
  if (!schema) {
    throw new Error(`Model "${name}" is not registered`);
  }
  return conn.model(name, schema);
};

// Resolve a model on the *current* tenant connection. Use this inside model
// files / hooks that reference another model by name (was: mongoose.model("X")).
export const modelFor = (name) => getModelOn(getTenantConnection(), name);

// Ensure every registered schema is compiled on `conn`. Called when a tenant
// connection is first used so cross-model populate() (which looks models up by
// ref name on the connection) always finds them. Cheap and idempotent.
export const ensureModels = (conn) => {
  for (const [name, schema] of schemas) {
    if (!conn.models[name]) conn.model(name, schema);
  }
};

// Build the tenant-aware Proxy that a model file exports as its default.
const buildModelProxy = (name) => {
  const resolve = () => getModelOn(getTenantConnection(), name);

  // Target is a function so the `construct` trap (new Model()) is legal.
  return new Proxy(function () {}, {
    get(_target, prop) {
      const model = resolve();
      const value = model[prop];
      // Bind statics/query builders so `this` is the real model, not the proxy.
      return typeof value === "function" ? value.bind(model) : value;
    },
    set(_target, prop, value) {
      resolve()[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in resolve();
    },
    construct(_target, args) {
      const Model = resolve();
      return new Model(...args);
    },
    apply(_target, _thisArg, args) {
      // Some Mongoose helpers call the model as a function (hydration).
      return resolve()(...args);
    },
    getPrototypeOf() {
      return Object.getPrototypeOf(resolve());
    },
  });
};

// Register a schema and return its tenant-aware model proxy. Drop-in replacement
// for `mongoose.model(name, schema)` in model files.
export const registerModel = (name, schema) => {
  schemas.set(name, schema);
  return buildModelProxy(name);
};

export const registeredModelNames = () => [...schemas.keys()];
