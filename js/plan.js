/* plan.js — PMA Plan list with monthly view and multi-select filters */
"use strict";

(function() {
  let sortCol = "plan_date";
  let sortAsc = true;
  // Status / Month / Year are multi-select (arrays of values)
  let filter = { customer: "", status: [], month: [], year: [], search: "" };
  let debounceTimer = null;

  const MONTHS = [
    { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" },
    { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
    { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
    { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
  ];

  const STATUS_OPTIONS = [
    { v: "finished", n: "Finished" },
    { v: "planned",  n: "Planned" },
    { v: "overdue",  n: "Overdue" },
    { v: "postpone", n: "Postpone" }
  ];

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - now) / 86400000);
  }

  function formatCountdown(days) {
    if (days === null) return `<span style="color:#94a3b8">—</span>`;
    if (days < 0) return `<span style="color:#b91c1c;font-weight:700">Overdue ${Math.abs(days)} days</span>`;
    if (days === 0) return `<span style="color:#f59e0b;font-weight:700">Today</span>`;
    if (days <= 30) return `<span style="color:#f59e0b;font-weight:700">${days} days</span>`;
    const months = Math.floor(days / 30);
    const remain = days % 30;
    if (remain > 0) return `<span style="color:#15803d;font-weight:600">${months} months ${remain} days</span>`;
    return `<span style="color:#15803d;font-weight:600">${months} months</span>`;
  }

  // ---------- multi-select rendering ----------
  function msButton(id, label, selected, total) {
    const active = selected.length > 0 && selected.length < total;
    const text = selected.length === 0 ? "All"
      : selected.length === total ? "All"
      : selected.length === 1 ? label(selected[0])
      : `${selected.length} selected`;
    return `<button type="button" class="ms-btn ${active ? "active" : ""}" id="${id}-btn" aria-expanded="false">
      <span class="ms-label">${PMA.esc(text)}</span><span class="caret">▼</span>
    </button>`;
  }

  function msPanel(id, options, selected) {
    return `<div class="ms-panel" id="${id}-panel" hidden>
      <div class="ms-actions">
        <button type="button" data-ms-all="${id}">Select all</button>
        <button type="button" data-ms-none="${id}">Clear</button>
      </div>
      ${options.map(o => `<label class="ms-opt">
        <input type="checkbox" data-ms="${id}" value="${PMA.esc(o.v)}" ${selected.includes(o.v) ? "checked" : ""}>
        <span>${PMA.esc(o.n)}</span>
      </label>`).join("")}
    </div>`;
  }

  function render() {
    const view = document.getElementById("view");
    const plans = PMA.plans();

    if (!plans.length) {
      view.innerHTML = '<div class="empty">No data — upload Excel file first</div>';
      return;
    }

    const customers = PMA.unique("customer");
    const years = [...new Set(plans.map(p => p.plan_date ? p.plan_date.slice(0,4) : null).filter(Boolean))].sort();
    const yearOptions = years.map(y => ({ v: y, n: y }));

    view.innerHTML = `
      <div class="view-head">
        <h1>Plan</h1>
        <span class="sub">${plans.length} items</span>
        <div class="spacer"></div>
      </div>

      <div class="card mb-4">
        <div class="filters">
          <div>
            <label>Search</label>
            <input type="search" id="search-input" placeholder="Project code, description..." value="${PMA.esc(filter.search)}" style="width:200px">
          </div>
          <div>
            <label>Customer</label>
            <select id="filter-customer">
              <option value="">All</option>
              ${customers.map(c => `<option value="${PMA.esc(c)}" ${filter.customer===c?"selected":""}>${PMA.esc(c)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Status</label>
            <div class="ms" id="ms-status">
              ${msButton("ms-status", v => (STATUS_OPTIONS.find(o => o.v === v) || {}).n || v, filter.status, STATUS_OPTIONS.length)}
              ${msPanel("ms-status", STATUS_OPTIONS, filter.status)}
            </div>
          </div>
          <div>
            <label>Month</label>
            <div class="ms" id="ms-month">
              ${msButton("ms-month", v => (MONTHS.find(m => m.v === v) || {}).n || v, filter.month, MONTHS.length)}
              ${msPanel("ms-month", MONTHS, filter.month)}
            </div>
          </div>
          <div>
            <label>Year</label>
            <div class="ms" id="ms-year">
              ${msButton("ms-year", v => v, filter.year, yearOptions.length)}
              ${msPanel("ms-year", yearOptions, filter.year)}
            </div>
          </div>
          <div style="margin-left:auto">
            <label>&nbsp;</label>
            <button class="btn ghost small" onclick="resetPlanFilters()">
              Clear Filters
            </button>
          </div>
        </div>
        <div class="tbl-wrap">
          <table class="tbl" id="planTable">
            <thead>
              <tr>
                <th class="sortable" data-sort="customer">Customer</th>
                <th class="sortable" data-sort="project_code">Project Code</th>
                <th class="sortable" data-sort="description">Description</th>
                <th class="sortable" data-sort="pm_detail">PM Detail</th>
                <th class="sortable" data-sort="plan_date">Plan Date</th>
                <th class="sortable" data-sort="actual_date">Actual Date</th>
                <th>Remaining</th>
                <th class="sortable" data-sort="pma_status">Status</th>
                <th class="sortable" data-sort="plan_user">Plan User</th>
                <th class="sortable" data-sort="product">Product</th>
              </tr>
            </thead>
            <tbody id="planTableBody"></tbody>
          </table>
        </div>
        <div id="no-results" class="empty" hidden>No items match your filters</div>
      </div>
    `;

    wireMultiSelects();
    wireListeners();
    renderTable();
  }

  // ---------- multi-select behaviour ----------
  function wireMultiSelects() {
    // open / close panels
    ["ms-status", "ms-month", "ms-year"].forEach(id => {
      const btn = document.getElementById(id + "-btn");
      const panel = document.getElementById(id + "-panel");
      if (!btn || !panel) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !panel.hidden;
        closeAllPanels();
        panel.hidden = open;
        btn.setAttribute("aria-expanded", String(!open));
      });
    });

    // checkbox changes
    document.querySelectorAll("input[data-ms]").forEach(cb => {
      cb.addEventListener("change", () => {
        syncFromDom();
        renderTable();
        refreshButtons();
      });
    });

    // select all / clear
    document.querySelectorAll("[data-ms-all]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.msAll;
        document.querySelectorAll(`input[data-ms="${id}"]`).forEach(cb => { cb.checked = true; });
        syncFromDom(); renderTable(); refreshButtons();
      });
    });
    document.querySelectorAll("[data-ms-none]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.msNone;
        document.querySelectorAll(`input[data-ms="${id}"]`).forEach(cb => { cb.checked = false; });
        syncFromDom(); renderTable(); refreshButtons();
      });
    });

    // click outside closes panels
    document.addEventListener("click", closeAllPanels);
    document.getElementById("ms-status")?.addEventListener("click", e => e.stopPropagation());
    document.getElementById("ms-month")?.addEventListener("click", e => e.stopPropagation());
    document.getElementById("ms-year")?.addEventListener("click", e => e.stopPropagation());
  }

  function closeAllPanels() {
    document.querySelectorAll(".ms-panel").forEach(p => { p.hidden = true; });
    document.querySelectorAll(".ms-btn").forEach(b => b.setAttribute("aria-expanded", "false"));
  }

  // read checkbox state back into `filter`
  function syncFromDom() {
    ["status", "month", "year"].forEach(k => {
      const boxes = document.querySelectorAll(`input[data-ms="ms-${k}"]`);
      if (!boxes.length) return;
      filter[k] = Array.from(boxes).filter(cb => cb.checked).map(cb => cb.value);
    });
  }

  // update the trigger labels after a change (without a full re-render)
  function refreshButtons() {
    const sets = [
      { id: "ms-status", opts: STATUS_OPTIONS },
      { id: "ms-month",  opts: MONTHS },
      { id: "ms-year",   opts: [...new Set(PMA.plans().map(p => p.plan_date ? p.plan_date.slice(0,4) : null).filter(Boolean))].sort().map(y => ({ v: y, n: y })) }
    ];
    sets.forEach(({ id, opts }) => {
      const key = id.replace("ms-", "");
      const btn = document.getElementById(id + "-btn");
      if (!btn) return;
      const sel = filter[key];
      const total = opts.length;
      const active = sel.length > 0 && sel.length < total;
      const text = sel.length === 0 || sel.length === total
        ? "All"
        : sel.length === 1
          ? ((opts.find(o => o.v === sel[0]) || {}).n || sel[0])
          : `${sel.length} selected`;
      btn.querySelector(".ms-label").textContent = text;
      btn.classList.toggle("active", active);
    });
  }

  function wireListeners() {
    document.getElementById("search-input").addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filter.search = e.target.value;
        renderTable();
      }, 200);
    });
    document.getElementById("filter-customer").addEventListener("change", (e) => {
      filter.customer = e.target.value; renderTable();
    });

    document.querySelectorAll("#planTable thead th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) { sortAsc = !sortAsc; }
        else { sortCol = col; sortAsc = true; }
        renderTable();
      });
    });
  }

  function applyFilters() {
    return PMA.plans().filter(p => {
      if (filter.customer && p.customer !== filter.customer) return false;

      if (filter.status.length) {
        const s = PMA.statusOf(p).toLowerCase();
        if (!filter.status.includes(s)) return false;
      }
      if (filter.month.length) {
        if (!p.plan_date) return false;
        const mm = p.plan_date.slice(5, 7);
        if (!filter.month.includes(mm)) return false;
      }
      if (filter.year.length) {
        if (!p.plan_date) return false;
        if (!filter.year.includes(p.plan_date.slice(0, 4))) return false;
      }
      if (filter.search) {
        const hay = `${p.customer} ${p.project_code} ${p.description} ${p.pm} ${p.sale} ${p.product}`.toLowerCase();
        if (!hay.includes(filter.search.toLowerCase())) return false;
      }
      return true;
    });
  }

  function sortProjects(list) {
    list.sort((a, b) => {
      let av, bv;
      if (sortCol === "diff_days") {
        av = a.diff_days || 0; bv = b.diff_days || 0;
      } else if (sortCol === "plan_date" || sortCol === "actual_date") {
        av = a[sortCol] || ""; bv = b[sortCol] || "";
      } else {
        av = (a[sortCol]||"").toString().toLowerCase();
        bv = (b[sortCol]||"").toString().toLowerCase();
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function renderTable() {
    const tbody = document.getElementById("planTableBody");
    const noResults = document.getElementById("no-results");
    if (!tbody) return;

    let list = applyFilters();
    sortProjects(list);

    document.querySelectorAll("#planTable thead th[data-sort] .arrow").forEach(el => el.textContent = "");
    const activeTh = document.querySelector(`#planTable thead th[data-sort="${sortCol}"]`);
    if (activeTh) {
      let arrowEl = activeTh.querySelector(".arrow");
      if (!arrowEl) {
        arrowEl = document.createElement("span");
        arrowEl.className = "arrow";
        activeTh.appendChild(arrowEl);
      }
      arrowEl.textContent = sortAsc ? " ↑" : " ↓";
    }

    if (list.length === 0) {
      tbody.innerHTML = "";
      noResults.hidden = false;
      return;
    }
    noResults.hidden = true;

    tbody.innerHTML = list.map(p => {
      const status = PMA.statusOf(p);
      const badgeClass = "st-" + status.replace(" ", "");

      // Countdown: if Finished, show Actual - Plan; else Plan - Today
      let days;
      if (status === "Finished" && p.actual_date && p.plan_date) {
        const plan = new Date(p.plan_date);
        const actual = new Date(p.actual_date);
        plan.setHours(0, 0, 0, 0);
        actual.setHours(0, 0, 0, 0);
        days = Math.round((actual - plan) / 86400000);
      } else {
        days = daysUntil(p.plan_date);
      }

      return `<tr onclick="showDrawer(${p.id})">
        <td><span class="customer-chip">${PMA.esc(p.customer || "—")}</span></td>
        <td><span class="code">${PMA.esc(p.project_code || "—")}</span></td>
        <td class="clamp2 strong">${PMA.esc(p.description || "—")}</td>
        <td class="nowrap">${PMA.esc(p.pm_detail || "—")}</td>
        <td class="nowrap">${PMA.fmtDate(p.plan_date)}</td>
        <td class="nowrap">${PMA.fmtDate(p.actual_date)}</td>
        <td class="nowrap" style="font-size:12px">${formatCountdown(days)}</td>
        <td>
          <span class="badge ${badgeClass}">${PMA.statusLabel(status)}</span>
        </td>
        <td>${PMA.esc(p.plan_user || "—")}</td>
        <td>${PMA.esc(p.product || "—")}</td>
      </tr>`;
    }).join("");
  }

  window.resetPlanFilters = function() {
    filter = { customer: "", status: [], month: [], year: [], search: "" };
    render();
  };

  window.renderPlan = render;
  window.renderPlanTable = renderTable;
})();
