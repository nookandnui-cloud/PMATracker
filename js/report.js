/* report.js — summary view with month/year filters for PMA Tracker */
"use strict";

(function() {
  let reportFilter = { month: "", year: "", customer: "", product: "" };

  function render() {
    const view = document.getElementById("view");
    const plans = PMA.plans();

    if (!plans.length) {
      view.innerHTML = '<div class="empty">No data</div>';
      return;
    }

    const years = [...new Set(plans.map(p => p.plan_date ? p.plan_date.slice(0,4) : null).filter(Boolean))].sort();
    const months = [
      { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" },
      { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
      { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
      { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
    ];

    const filtered = applyReportFilter(plans);
    const statusCounts = countStatuses(filtered);
    const customerStats = aggregateBy(filtered, "customer");
    const productStats = aggregateBy(filtered, "product");
    const planUserStats = aggregateByPlanUser(filtered);
    const monthlyStats = monthlyAggregate(filtered);

    view.innerHTML = `
      <div class="view-head">
        <h1>Summary Report</h1>
        <span class="sub">${filtered.length} items</span>
        <div class="spacer"></div>
        <button class="btn primary" onclick="exportPMAExcel()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Export Excel
        </button>
      </div>

      <div class="card mb-4">
        <div class="filters">
          <div>
            <label>Month</label>
            <select id="report-month" onchange="updatePMARreport()">
              <option value="">All</option>
              ${months.map(m => `<option value="${m.v}" ${reportFilter.month===m.v?"selected":""}>${m.n}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Year</label>
            <select id="report-year" onchange="updatePMARreport()">
              <option value="">All</option>
              ${years.map(y => `<option value="${y}" ${reportFilter.year===y?"selected":""}>${y}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Customer</label>
            <select id="report-customer" onchange="updatePMARreport()">
              <option value="">All</option>
              ${PMA.unique("customer").map(c => `<option value="${PMA.esc(c)}" ${reportFilter.customer===c?"selected":""}>${PMA.esc(c)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Product</label>
            <select id="report-product" onchange="updatePMARreport()">
              <option value="">All</option>
              ${PMA.unique("product").map(p => `<option value="${PMA.esc(p)}" ${reportFilter.product===p?"selected":""}>${PMA.esc(p)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>&nbsp;</label>
            <button class="btn ghost small" onclick="resetReportFilters()">Clear Filters</button>
          </div>
        </div>
        <div class="card-body">
          <div class="grid cols-4">
            <div class="kpi-card total">
              <div class="kpi-value">${filtered.length}</div>
              <div class="kpi-label">Items</div>
            </div>
            <div class="kpi-card active">
              <div class="kpi-value">${statusCounts.Finished}</div>
              <div class="kpi-label">Finished</div>
            </div>
            <div class="kpi-card completed">
              <div class="kpi-value">${statusCounts.Planned}</div>
              <div class="kpi-label">Planned</div>
            </div>
            <div class="kpi-card overdue">
              <div class="kpi-value">${statusCounts.Overdue}</div>
              <div class="kpi-label">Overdue</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-head"><h2>Summary by Customer</h2></div>
          <div class="card-body tight">
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th class="num">Total</th>
                    <th class="num">Finished</th>
                    <th class="num">Planned</th>
                    <th class="num">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${customerStats.length ? customerStats.map(([k, s]) => `
                    <tr>
                      <td><span class="customer-chip">${PMA.esc(k)}</span></td>
                      <td class="num">${s.total}</td>
                      <td class="num" style="color:var(--win)">${s.finished}</td>
                      <td class="num" style="color:var(--prog)">${s.planned}</td>
                      <td class="num" style="color:var(--lost)">${s.overdue}</td>
                    </tr>
                  `).join("") : '<tr><td colspan="5" class="empty">No data</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Summary by Product</h2></div>
          <div class="card-body tight">
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th class="num">Total</th>
                    <th class="num">Finished</th>
                    <th class="num">Planned</th>
                    <th class="num">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${productStats.length ? productStats.map(([k, s]) => `
                    <tr>
                      <td>${PMA.esc(k)}</td>
                      <td class="num">${s.total}</td>
                      <td class="num" style="color:var(--win)">${s.finished}</td>
                      <td class="num" style="color:var(--prog)">${s.planned}</td>
                      <td class="num" style="color:var(--lost)">${s.overdue}</td>
                    </tr>
                  `).join("") : '<tr><td colspan="5" class="empty">No data</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Summary by Plan User</h2></div>
          <div class="card-body tight">
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Plan User</th>
                    <th class="num">Total</th>
                    <th class="num">Finished</th>
                    <th class="num">Planned</th>
                    <th class="num">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${planUserStats.length ? planUserStats.map(([k, s]) => `
                    <tr>
                      <td>${PMA.esc(k)}</td>
                      <td class="num">${s.total}</td>
                      <td class="num" style="color:var(--win)">${s.finished}</td>
                      <td class="num" style="color:var(--prog)">${s.planned}</td>
                      <td class="num" style="color:var(--lost)">${s.overdue}</td>
                    </tr>
                  `).join("") : '<tr><td colspan="5" class="empty">No data</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Monthly Summary (Plan Date)</h2></div>
          <div class="card-body tight">
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th class="num">Total</th>
                    <th class="num">Finished</th>
                    <th class="num">Planned</th>
                    <th class="num">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthlyStats.length ? monthlyStats.map(([k, s]) => `
                    <tr>
                      <td>${k}</td>
                      <td class="num">${s.total}</td>
                      <td class="num" style="color:var(--win)">${s.finished}</td>
                      <td class="num" style="color:var(--prog)">${s.planned}</td>
                      <td class="num" style="color:var(--lost)">${s.overdue}</td>
                    </tr>
                  `).join("") : '<tr><td colspan="5" class="empty">No data</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function applyReportFilter(plans) {
    return plans.filter(p => {
      if (reportFilter.customer && p.customer !== reportFilter.customer) return false;
      if (reportFilter.product && p.product !== reportFilter.product) return false;
      if (reportFilter.year && p.plan_date && !p.plan_date.startsWith(reportFilter.year)) return false;
      if (reportFilter.month && p.plan_date && !p.plan_date.includes("-" + reportFilter.month + "-")) return false;
      return true;
    });
  }

  function countStatuses(plans) {
    const m = { Finished: 0, Planned: 0, Overdue: 0 };
    plans.forEach(p => {
      const s = PMA.statusOf(p);
      if (s === "Finished" || s === "Planned" || s === "Overdue") m[s]++;
    });
    return m;
  }

  function aggregateBy(plans, key) {
    const m = {};
    plans.forEach(p => {
      const k = p[key] || "—";
      if (!m[k]) m[k] = { total: 0, finished: 0, planned: 0, overdue: 0 };
      m[k].total++;
      const s = PMA.statusOf(p);
      if (s === "Finished") m[k].finished++;
      else if (s === "Planned") m[k].planned++;
      else if (s === "Overdue") m[k].overdue++;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }

  // Extract the first user listed in the plan_user field.
  // Format: "1.thanawat_m : คุณแม็กซ์ (Resigned)\n2.natchanon : คุณเกม\n3."
  // Some rows leave line 1 blank ("1.") with the real name on line 2, so scan
  // every line and take the first one that actually carries a name.
  function extractFirstPlanUser(planUserStr) {
    if (!planUserStr) return null;
    const lines = String(planUserStr).split(/\r?\n/);
    for (const line of lines) {
      const m = /^\s*\d+\.\s*([^:]+?)\s*(?::.*)?$/.exec(line);
      if (m && m[1].trim()) return m[1].trim();
    }
    return null;
  }

  function aggregateByPlanUser(plans) {
    const m = {};
    plans.forEach(p => {
      const user = extractFirstPlanUser(p.plan_user);
      if (!user) return;
      if (!m[user]) m[user] = { total: 0, finished: 0, planned: 0, overdue: 0 };
      m[user].total++;
      const s = PMA.statusOf(p);
      if (s === "Finished") m[user].finished++;
      else if (s === "Planned") m[user].planned++;
      else if (s === "Overdue") m[user].overdue++;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }

  function monthlyAggregate(plans) {
    const m = {};
    plans.forEach(p => {
      if (!p.plan_date) return;
      const month = p.plan_date.slice(0, 7);
      if (!m[month]) m[month] = { total: 0, finished: 0, planned: 0, overdue: 0 };
      m[month].total++;
      const s = PMA.statusOf(p);
      if (s === "Finished") m[month].finished++;
      else if (s === "Planned") m[month].planned++;
      else if (s === "Overdue") m[month].overdue++;
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }

  window.updatePMARreport = function() {
    reportFilter.month = document.getElementById("report-month").value;
    reportFilter.year = document.getElementById("report-year").value;
    reportFilter.customer = document.getElementById("report-customer").value;
    reportFilter.product = document.getElementById("report-product").value;
    render();
  };

  window.resetReportFilters = function() {
    reportFilter = { month: "", year: "", customer: "", product: "" };
    render();
  };

  window.exportPMAExcel = function() {
    const plans = PMA.plans();
    if (!plans.length) {
      PMA.toast("No data to export");
      return;
    }

    const data = plans.map(p => ({
      "Project Code": p.project_code,
      "Description": p.description,
      "PM Code": p.pm_code,
      "PM": p.pm,
      "Sale": p.sale,
      "BU Code": p.bu_code,
      "BU Name": p.bu_name,
      "PM# Detail": p.pm_detail,
      "Plan User": p.plan_user,
      "Active Flag": p.active_flag || "",
      "Customer": p.customer,
      "Customer Code": p.customer_code,
      "Product": p.product,
      "PMA Start Date": p.pma_start || "",
      "PMA End Date": p.pma_end || "",
      "Plan Date": p.plan_date || "",
      "Actual Date": p.actual_date || "",
      "Diff Days": p.diff_days || "",
      "PMA Status": p.pma_status,
      "Remark": p.remark
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 14 }, { wch: 50 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 6 },
      { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PMA Plan");

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    const fileName = `PMA_Plan_Report_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    PMA.toast(`Excel export successful: ${fileName}`);
  };

  window.renderReport = render;
})();
