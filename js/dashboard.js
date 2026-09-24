/* dashboard.js — overview stats and charts for PMA Tracker */
"use strict";

(function() {
  function render() {
    const view = document.getElementById("view");
    const plans = PMA.plans();

    if (!plans.length) {
      view.innerHTML = '<div class="empty">No data — upload Excel file first</div>';
      return;
    }

    const stats = computeStats(plans);
    const customers = countBy(plans, "customer");
    const products = countBy(plans, "product");
    const statuses = countByStatus(plans);
    const months = countByMonth(plans);

    view.innerHTML = `
      <div class="view-head">
        <h1>PMA Plan Overview</h1>
        <span class="sub">${plans.length} items · Updated ${PMA.state.source ? new Date(PMA.state.source.ingestedAt).toLocaleDateString("en-US") : "—"}</span>
        <div class="spacer"></div>
      </div>

      <div class="grid cols-5 mb-4">
        <div class="kpi-card total">
          <div class="kpi-value">${stats.total}</div>
          <div class="kpi-label">Total</div>
        </div>
        <div class="kpi-card active">
          <div class="kpi-value">${stats.finished}</div>
          <div class="kpi-label">Finished</div>
        </div>
        <div class="kpi-card completed">
          <div class="kpi-value">${stats.planned}</div>
          <div class="kpi-label">Planned</div>
        </div>
        <div class="kpi-card overdue">
          <div class="kpi-value">${stats.overdue}</div>
          <div class="kpi-label">Overdue</div>
        </div>
        <div class="kpi-card ma">
          <div class="kpi-value">${stats.postpone}</div>
          <div class="kpi-label">Postpone</div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>PMA Status Distribution</h2></div>
          <div class="card-body">
            ${renderStatusBars(statuses)}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Top 5 Customers</h2></div>
          <div class="card-body">
            ${renderCustomerBars(customers)}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Top 5 Products</h2></div>
          <div class="card-body">
            ${renderProductBars(products)}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Monthly Plan (Plan Date)</h2></div>
          <div class="card-body">
            ${renderMonthBars(months)}
          </div>
        </div>
      </div>
    `;
  }

  function computeStats(plans) {
    const now = new Date();
    let finished = 0, planned = 0, overdue = 0, postpone = 0;
    plans.forEach(p => {
      const status = PMA.statusOf(p);
      if (status === "Finished") finished++;
      else if (status === "Overdue") overdue++;
      else if (status === "Planned") planned++;
      else if (status === "Postpone") postpone++;
    });
    return { total: plans.length, finished, planned, overdue, postpone };
  }

  function countBy(plans, key) {
    const m = {};
    plans.forEach(p => {
      const k = p[key] || "—";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }

  function countByStatus(plans) {
    const m = { Finished: 0, Planned: 0, Overdue: 0, Postpone: 0, None: 0 };
    plans.forEach(p => {
      const s = PMA.statusOf(p);
      m[s] = (m[s] || 0) + 1;
    });
    return Object.entries(m);
  }

  function countByMonth(plans) {
    const m = {};
    plans.forEach(p => {
      if (p.plan_date) {
        const month = p.plan_date.slice(0, 7); // YYYY-MM
        m[month] = (m[month] || 0) + 1;
      }
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  }

  function renderStatusBars(statuses) {
    const total = statuses.reduce((s, [_, v]) => s + v, 0) || 1;
    const colors = { Finished: "#22c55e", Planned: "#3b82f6", Overdue: "#ef4444", Postpone: "#f59e0b", None: "#94a3b8" };
    return `<div class="chart-bar-container">
      ${statuses.map(([k, v]) => {
        const pct = Math.max(2, (v / total) * 60);
        const color = colors[k] || "#64748b";
        return `<div class="chart-col" title="${k}: ${v}">
          <div class="chart-bar-outer">
            <div class="chart-bar" style="height:${pct}px;background:${color}"></div>
          </div>
          <div class="chart-bar-label">${k}</div>
          <div class="chart-bar-val" style="color:${color}">${v}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function renderCustomerBars(data) {
    const max = Math.max(...data.map(d => d[1]), 1);
    return `<div class="chart-bar-container">
      ${data.map(([k, v]) => {
        const pct = Math.max(2, (v / max) * 60);
        return `<div class="chart-col" title="${k}: ${v}">
          <div class="chart-bar-outer">
            <div class="chart-bar" style="height:${pct}px;background:#c8102e"></div>
          </div>
          <div class="chart-bar-label">${PMA.esc(k)}</div>
          <div class="chart-bar-val">${v}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function renderProductBars(data) {
    const max = Math.max(...data.map(d => d[1]), 1);
    return `<div class="chart-bar-container">
      ${data.map(([k, v]) => {
        const pct = Math.max(2, (v / max) * 60);
        return `<div class="chart-col" title="${k}: ${v}">
          <div class="chart-bar-outer">
            <div class="chart-bar" style="height:${pct}px;background:#86198f"></div>
          </div>
          <div class="chart-bar-label">${PMA.esc(k)}</div>
          <div class="chart-bar-val">${v}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function renderMonthBars(data) {
    const max = Math.max(...data.map(d => d[1]), 1);
    return `<div class="chart-bar-container">
      ${data.map(([k, v]) => {
        const pct = Math.max(2, (v / max) * 60);
        const label = k; // YYYY-MM
        return `<div class="chart-col" title="${k}: ${v}">
          <div class="chart-bar-outer">
            <div class="chart-bar" style="height:${pct}px;background:#1d4ed8"></div>
          </div>
          <div class="chart-bar-label">${label}</div>
          <div class="chart-bar-val">${v}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  window.renderDashboard = render;
})();
