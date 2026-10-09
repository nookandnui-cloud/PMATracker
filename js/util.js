/* util.js — state, storage, formatting for PMA Tracker */
"use strict";

const PMA = (() => {
  const LS_KEY = "mfec-pma-tracker-v1";

  // ---------- date helpers ----------
  // Stored dates are "YYYY-MM-DD" strings. Parse to a local-midnight Date so
  // calendar-date comparisons (e.g. overdue checks) behave correctly.
  function parseExcelDate(v) {
    if (!v) return null;
    if (typeof v === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      return null;
    }
    if (typeof v === "number" && v > 40000 && v < 60000) {
      // Excel serial -> UTC calendar date -> local midnight (no TZ shift)
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    if (v instanceof Date) return v;
    return null;
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = parseExcelDate(d);
    if (!dt) return "—";
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtShort(d) {
    if (!d) return "—";
    const dt = parseExcelDate(d);
    if (!dt) return "—";
    return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  // ---------- status ----------
  // PMA Status: Finished, In Progress, Not Started, Overdue, Postpone
  function statusOf(p) {
    if (p.pma_status && p.pma_status === "Finished") return "Finished";
    if (p.pma_status && p.pma_status === "Postpone") return "Postpone";
    const planDate = parseExcelDate(p.plan_date);
    const actualDate = parseExcelDate(p.actual_date);
    if (actualDate) return "Finished";
    if (planDate && planDate < new Date()) return "Overdue";
    if (planDate) return "Planned";
    return "None";
  }

  function statusLabel(s) {
    return {
      "Finished": "Finished",
      "Overdue": "Overdue",
      "Planned": "Planned",
      "Postpose": "Postpone",
      "None": "—"
    }[s] || "—";
  }

  function statusColor(s) {
    return {
      "Finished": "#15803d",
      "Overdue": "#b91c1c",
      "Planned": "#1d4ed8",
      "Postpone": "#f59e0b",
      "None": "#92400e"
    }[s] || "#92400e";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- state ----------
  let state = null;

  function defaultState() {
    return {
      version: 1,
      source: null,
      plans: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version === 1 && Array.isArray(s.plans)) {
          state = s;
          return;
        }
      }
    } catch (e) { /* corrupt -> fresh */ }
    state = defaultState();
  }

  function ingest(plans, fileName, sheetName) {
    state = {
      version: 1,
      source: { fileName, sheetName, ingestedAt: new Date().toISOString(), count: plans.length },
      plans: JSON.parse(JSON.stringify(plans))
    };
    save();
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      setSaveState("Saved " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setSaveState("Save failed");
    }
  }

  function setSaveState(t) {
    const el = document.getElementById("saveState");
    if (el) el.textContent = t;
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    load();
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function plans() { return state.plans; }
  function byId(id) { return state.plans.find(p => p.id === id); }

  function unique(key) {
    return [...new Set(plans().map(p => p[key]).filter(Boolean))].sort();
  }

  return {
    LS_KEY,
    parseExcelDate, fmtDate, fmtShort,
    statusOf, statusColor, statusLabel, esc,
    load, ingest, save, reset, setSaveState,
    toast, plans, byId, unique,
    get state() { return state; }
  };
})();
