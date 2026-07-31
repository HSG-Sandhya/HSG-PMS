// Platform operator console. Vanilla JS, no inline handlers (production CSP is
// script-src 'self'). Talks to the same-origin control-plane API at /api/platform.
(() => {
  "use strict";

  const API = "/api/platform";
  const TOKEN_KEY = "platformToken";

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    admin: null,
    needsSetup: false,
    authMode: "login", // "login" | "setup"
    editingId: null, // hotel id when editing, null when creating
    hotels: [],
  };

  const $ = (id) => document.getElementById(id);
  const show = (id) => $(id).removeAttribute("hidden");
  const hide = (id) => $(id).setAttribute("hidden", "");
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  let toastTimer;
  const toast = (msg, kind) => {
    const el = $("toast");
    el.textContent = msg;
    el.className = "toast" + (kind ? " " + kind : "");
    el.removeAttribute("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.setAttribute("hidden", ""), 3200);
  };

  // ── API ──────────────────────────────────────────────────────────────────
  async function api(path, { method = "GET", body, headers = {} } = {}) {
    const opts = { method, headers: { ...headers } };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (state.token) opts.headers["Authorization"] = "Bearer " + state.token;

    const res = await fetch(API + path, opts);
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    if (res.status === 401 && state.token) {
      // Token expired/invalid → back to login.
      logout(true);
      throw new Error(data.message || "Session expired. Please sign in again.");
    }
    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Request failed (" + res.status + ")");
    }
    return data;
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  function showOnly(viewId) {
    ["view-loading", "view-auth", "view-dashboard"].forEach((v) =>
      v === viewId ? show(v) : hide(v)
    );
  }

  function renderAuth() {
    const setup = state.authMode === "setup";
    $("auth-subtitle").textContent = setup
      ? "Create the first platform administrator."
      : "Sign in to manage hotels.";
    $("auth-submit").textContent = setup ? "Create admin" : "Sign in";
    $("auth-email-field").hidden = !setup;
    $("auth-setupkey-field").hidden = !setup;
    $("auth-error").hidden = true;
    showOnly("view-auth");
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    const btn = $("auth-submit");
    const err = $("auth-error");
    err.hidden = true;
    btn.disabled = true;
    try {
      const username = $("auth-username").value.trim();
      const password = $("auth-password").value;
      if (state.authMode === "setup") {
        const headers = {};
        const key = $("auth-setupkey").value.trim();
        if (key) headers["x-setup-key"] = key;
        const data = await api("/setup", {
          method: "POST",
          headers,
          body: { username, password, email: $("auth-email").value.trim() },
        });
        setToken(data.token, data.admin);
      } else {
        const data = await api("/login", { method: "POST", body: { username, password } });
        setToken(data.token, data.admin);
      }
      await enterDashboard();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  }

  function setToken(token, admin) {
    state.token = token;
    state.admin = admin || null;
    localStorage.setItem(TOKEN_KEY, token);
  }

  function logout(silent) {
    state.token = null;
    state.admin = null;
    localStorage.removeItem(TOKEN_KEY);
    $("auth-form").reset();
    state.authMode = state.needsSetup ? "setup" : "login";
    renderAuth();
    if (!silent) toast("Logged out");
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  async function enterDashboard() {
    $("whoami").textContent = state.admin ? "@" + state.admin.username : "";
    showOnly("view-dashboard");
    await loadHotels();
  }

  async function loadHotels() {
    const params = new URLSearchParams();
    const q = $("search").value.trim();
    const status = $("status-filter").value;
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    try {
      const data = await api("/hotels" + (params.toString() ? "?" + params : ""));
      state.hotels = data.hotels || [];
      renderHotels();
    } catch (ex) {
      toast(ex.message, "err");
    }
  }

  function renderHotels() {
    const body = $("hotels-body");
    const empty = $("hotels-empty");
    if (!state.hotels.length) {
      body.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = state.hotels
      .map((h) => {
        const created = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—";
        const host = h.customDomain || h.subdomain;
        const toggle =
          h.status === "suspended"
            ? `<button class="btn sm" data-act="activate" data-id="${h._id}">Activate</button>`
            : `<button class="btn sm" data-act="suspend" data-id="${h._id}">Suspend</button>`;
        return `<tr>
          <td><div class="hotel-name">${esc(h.name)}</div><div class="hotel-sub">${esc(h.slug)}</div></td>
          <td>${esc(host)}</td>
          <td><span class="badge ${esc(h.status)}">${esc(h.status)}</span></td>
          <td>${esc(h.plan || "—")}</td>
          <td>${esc(created)}</td>
          <td><div class="cell-actions">
            <button class="btn sm ghost" data-act="edit" data-id="${h._id}">Edit</button>
            ${toggle}
          </div></td>
        </tr>`;
      })
      .join("");
  }

  async function onTableClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const { act, id } = btn.dataset;
    const hotel = state.hotels.find((h) => h._id === id);
    if (act === "edit") return openModal(hotel);
    if (act === "suspend" || act === "activate") {
      btn.disabled = true;
      try {
        await api(`/hotels/${id}/${act}`, { method: "POST" });
        toast(`Hotel ${act === "suspend" ? "suspended" : "activated"}`, "ok");
        await loadHotels();
      } catch (ex) {
        toast(ex.message, "err");
        btn.disabled = false;
      }
    }
  }

  // ── Modal (create / edit) ─────────────────────────────────────────────────
  function openModal(hotel) {
    state.editingId = hotel ? hotel._id : null;
    const editing = !!hotel;
    $("modal-title").textContent = editing ? "Edit hotel" : "New hotel";
    $("modal-submit").textContent = editing ? "Save changes" : "Create hotel";
    $("modal-error").hidden = true;
    $("hotel-form").reset();

    // Admin fields + notes visibility differ by mode.
    $("admin-fieldset").hidden = editing;
    $("notes-field").hidden = !editing;
    // Subdomain can't be changed for the base hotel, but is editable otherwise.
    $("f-subdomain").disabled = false;

    if (editing) {
      $("f-name").value = hotel.name || "";
      $("f-subdomain").value = hotel.subdomain || "";
      $("f-plan").value = hotel.plan || "";
      $("f-customdomain").value = hotel.customDomain || "";
      $("f-contact").value = hotel.contactEmail || "";
      $("f-notes").value = hotel.notes || "";
    }
    show("modal");
  }

  function closeModal() {
    hide("modal");
    state.editingId = null;
  }

  async function handleHotelSubmit(e) {
    e.preventDefault();
    const err = $("modal-error");
    const btn = $("modal-submit");
    err.hidden = true;
    btn.disabled = true;
    try {
      if (state.editingId) {
        const body = {
          name: $("f-name").value.trim(),
          subdomain: $("f-subdomain").value.trim(),
          plan: $("f-plan").value.trim(),
          customDomain: $("f-customdomain").value.trim(),
          contactEmail: $("f-contact").value.trim(),
          notes: $("f-notes").value,
        };
        await api(`/hotels/${state.editingId}`, { method: "PATCH", body });
        toast("Hotel updated", "ok");
      } else {
        const body = {
          name: $("f-name").value.trim(),
          subdomain: $("f-subdomain").value.trim() || undefined,
          plan: $("f-plan").value.trim() || undefined,
          customDomain: $("f-customdomain").value.trim() || undefined,
          contactEmail: $("f-contact").value.trim() || undefined,
          admin: {
            username: $("f-admin-username").value.trim(),
            password: $("f-admin-password").value,
            phone: $("f-admin-phone").value.trim(),
            firstName: $("f-admin-firstname").value.trim(),
            lastName: $("f-admin-lastname").value.trim() || undefined,
            email: $("f-admin-email").value.trim() || undefined,
          },
        };
        await api("/hotels", { method: "POST", body });
        toast("Hotel created", "ok");
      }
      closeModal();
      await loadHotels();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  async function boot() {
    // Wire events once.
    $("auth-form").addEventListener("submit", handleAuthSubmit);
    $("btn-logout").addEventListener("click", () => logout());
    $("btn-new").addEventListener("click", () => openModal(null));
    $("hotels-body").addEventListener("click", onTableClick);
    $("hotel-form").addEventListener("submit", handleHotelSubmit);
    let searchTimer;
    $("search").addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadHotels, 250);
    });
    $("status-filter").addEventListener("change", loadHotels);
    document.querySelectorAll('[data-close]').forEach((el) =>
      el.addEventListener("click", closeModal)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("modal").hidden) closeModal();
    });

    try {
      const status = await api("/setup-status");
      state.needsSetup = !!status.needsSetup;
    } catch {
      state.needsSetup = false;
    }

    if (state.needsSetup) {
      state.authMode = "setup";
      state.token = null;
      localStorage.removeItem(TOKEN_KEY);
      return renderAuth();
    }

    if (state.token) {
      try {
        const me = await api("/me");
        state.admin = me.admin;
        return enterDashboard();
      } catch {
        // fall through to login
      }
    }
    state.authMode = "login";
    renderAuth();
  }

  boot();
})();
