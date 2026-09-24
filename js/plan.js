/* plan.js — PMA Plan list with monthly view and filters */
"use strict";

(function() {
  let sortCol = "plan_date";
  let sortAsc = true;
  let filter = { customer: "", status: "", search: "", month: "", year: "" };
  let debounceTimer = null;

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

  function render() {
    const view = document.getElementById("view");
    const plans = PMA.plans();

    if (!plans.length) {
      view.innerHTML = '<div class="empty">No data — upload Excel file first</div>';
      return;
    }

    const customers = PMA.unique("customer");
    const years = [...new Set(plans.map(p => p.plan_date ? p.plan_date.slice(0,4) : null).filter(Boolean))].sort();

    const months = [
      { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" },
      { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
      { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
      { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
    ];

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
            <select id="filter-status">
              <option value="">All</option>
              <option value="finished" ${filter.status==="finished"?"selected":""}>Finished</option>
              <option value="planned" ${filter.status==="planned"?"selected":""}>Planned</option>
              <option value="overdue" ${filter.status==="overdue"?"selected":""}>Overdue</option>
              <option value="postpone" ${filter.status==="postpone"?"selected":""}>Postpone</option>
            </select>
          </div>
          <div>
            <label>Month</label>
            <select id="filter-month">
              <option value="">All</option>
              ${months.map(m => `<option value="${m.v}" ${filter.month===m.v?"selected":""}>${m.n}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Year</label>
            <select id="filter-year">
              <option value="">All</option>
              ${years.map(y => `<option value="${y}" ${filter.year===y?"selected":""}>${y}</option>`).join("")}
            </select>
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

    // Attach listeners
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
    document.getElementById("filter-status").addEventListener("change", (e) => {
      filter.status = e.target.value; renderTable();
    });
    document.getElementById("filter-month").addEventListener("change", (e) => {
      filter.month = e.target.value; renderTable();
    });
    document.getElementById("filter-year").addEventListener("change", (e) => {
      filter.year = e.target.value; renderTable();
    });

    document.querySelectorAll("#planTable thead th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) { sortAsc = !sortAsc; }
        else { sortCol = col; sortAsc = true; }
        renderTable();
      });
    });

    renderTable();
  }

  function applyFilters() {
    return PMA.plans().filter(p => {
      if (filter.customer && p.customer !== filter.customer) return false;
      if (filter.status === "finished" && PMA.statusOf(p) !== "Finished") return false;
      if (filter.status === "planned" && PMA.statusOf(p) !== "Planned") return false;
      if (filter.status === "overdue" && PMA.statusOf(p) !== "Overdue") return false;
      if (filter.status === "postpone" && PMA.statusOf(p) !== "Postpone") return false;
      if (filter.month) {
        if (!p.plan_date || !p.plan_date.includes("-" + filter.month + "-")) return false;
      }
      if (filter.year) {
        if (!p.plan_date || !p.plan_date.startsWith(filter.year)) return false;
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
      
      // Countdown logic: if Finished, show Plan - Actual; else show Plan - Today
      let days;
      if (status === "Finished" && p.actual_date && p.plan_date) {
        // Calculate plan - actual date difference
        const plan = new Date(p.plan_date);
        const actual = new Date(p.actual_date);
        plan.setHours(0, 0, 0, 0);
        actual.setHours(0, 0, 0, 0);
        days = Math.round((actual - plan) / 86400000);
      } else {
        days = daysUntil(p.plan_date);
      }
      
      // Format plan_user to show nickname if possible
      const planUserDisplay = p.plan_user || "—";
      
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
        <td>${PMA.esc(planUserDisplay)}</td>
        <td>${PMA.esc(p.product || "—")}</td>
      </tr>`;
    }).join("");
  }

  window.resetPlanFilters = function() {
    filter = { customer: "", status: "", search: "", month: "", year: "" };
    render();
  };

  window.renderPlan = render;
  window.renderPlanTable = renderTable;
})();
