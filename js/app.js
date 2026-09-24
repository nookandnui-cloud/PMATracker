/* app.js — main app controller for PMA Tracker */
"use strict";

(function() {
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    PMA.load();

    document.getElementById("mainNav").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-view]");
      if (!btn) return;
      switchView(btn.dataset.view);
    });

    document.getElementById("btnChangeFile").addEventListener("click", window.changeFile);
    document.getElementById("btnReset").addEventListener("click", window.resetData);
    document.getElementById("btnExcelSave").addEventListener("click", function() {
      // Use the export from report.js
      if (window.exportPMAExcel) window.exportPMAExcel();
    });

    document.getElementById("drawerBackdrop").addEventListener("click", closeDrawer);

    // If data already loaded, show app
    if (PMA.state && PMA.state.plans && PMA.state.plans.length > 0) {
      document.getElementById("landing").hidden = true;
      document.getElementById("app").hidden = false;
      document.getElementById("dataMeta").textContent =
        `${PMA.state.source?.fileName || "—"} · ${PMA.state.plans.length} items`;
      switchView("report");
    }
  }

  function switchView(name) {
    document.querySelectorAll("#mainNav button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    if (name === "report") window.renderReport();
    else if (name === "plan") window.renderPlan();
  }

  // ===== Drawer System =====
  window.showDrawer = function(id) {
    const p = PMA.byId(id);
    if (!p) return;

    const drawer = document.getElementById("drawer");
    const backdrop = document.getElementById("drawerBackdrop");

    const status = PMA.statusOf(p);
    const badgeClass = "st-" + status.replace(" ", "");

    drawer.innerHTML = `
      <div class="drawer-head">
        <div>
          <h3>${PMA.esc(p.description || "—")}</h3>
          <div class="sub">
            <span class="customer-chip">${PMA.esc(p.customer || "—")}</span>
            ${p.project_code ? `<span class="code" style="margin-left:6px">${PMA.esc(p.project_code)}</span>` : ""}
          </div>
        </div>
        <button class="close" onclick="closeDrawer()">✕</button>
      </div>
      <div class="drawer-body">
        <div class="tag-row" style="margin-bottom:14px">
          <span class="badge ${badgeClass}">${PMA.statusLabel(status)}</span>
          ${p.pm_detail ? `<span class="badge" style="background:#eef1f6;color:#47536b">${PMA.esc(p.pm_detail)}</span>` : ""}
        </div>

        <form class="frm" id="viewForm" onsubmit="return false;">
          <div class="row">
            <label>Project Code</label>
            <input type="text" name="project_code" value="${PMA.esc(p.project_code)}" placeholder="e.g. BFS220677">
          </div>
          <div class="row wide">
            <label>Description</label>
            <textarea name="description" rows="2">${PMA.esc(p.description)}</textarea>
          </div>
          <div class="row">
            <label>PM</label>
            <input type="text" name="pm" value="${PMA.esc(p.pm)}" placeholder="PM name">
          </div>
          <div class="row">
            <label>Sale</label>
            <input type="text" name="sale" value="${PMA.esc(p.sale)}" placeholder="Sale name">
          </div>
          <div class="row">
            <label>BU</label>
            <input type="text" name="bu_name" value="${PMA.esc(p.bu_name)}">
          </div>
          <div class="row">
            <label>PM# Detail</label>
            <input type="text" name="pm_detail" value="${PMA.esc(p.pm_detail)}" placeholder="e.g. PM1-15">
          </div>
          <div class="row">
            <label>PMA Type</label>
            <input type="text" name="pma_type" value="${PMA.esc(p.pma_type)}">
          </div>
          <div class="row">
            <label>Customer</label>
            <input type="text" name="customer" value="${PMA.esc(p.customer)}">
          </div>
          <div class="row">
            <label>Product</label>
            <input type="text" name="product" value="${PMA.esc(p.product)}">
          </div>
          <div class="row">
            <label>PMA Start Date</label>
            <input type="date" name="pma_start" value="${p.pma_start || ""}">
          </div>
          <div class="row">
            <label>PMA End Date</label>
            <input type="date" name="pma_end" value="${p.pma_end || ""}">
          </div>
          <div class="row">
            <label>Plan Date</label>
            <input type="date" name="plan_date" value="${p.plan_date || ""}">
          </div>
          <div class="row">
            <label>Actual Date</label>
            <input type="date" name="actual_date" value="${p.actual_date || ""}">
          </div>
          <div class="row">
            <label>Diff Days</label>
            <input type="number" name="diff_days" value="${p.diff_days ?? ""}">
          </div>
          <div class="row">
            <label>PMA Status</label>
            <select name="pma_status">
              <option value="">—</option>
              <option value="Finished" ${p.pma_status==="Finished"?"selected":""}>Finished</option>
              <option value="Postpone" ${p.pma_status==="Postpone"?"selected":""}>Postpone</option>
            </select>
          </div>
          <div class="row wide">
            <label>Actual User</label>
            <input type="text" name="actual_user" value="${PMA.esc(p.actual_user)}">
          </div>
          <div class="row wide">
            <label>Remark</label>
            <textarea name="remark" rows="3">${PMA.esc(p.remark)}</textarea>
          </div>
        </form>
      </div>
      <div class="drawer-foot">
        <button class="btn ghost" onclick="closeDrawer()">Close</button>
        <button class="btn primary" onclick="savePMA(${p.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Save
        </button>
      </div>
    `;

    backdrop.hidden = false;
    drawer.hidden = false;
  };

  function closeDrawer() {
    document.getElementById("drawer").hidden = true;
    document.getElementById("drawerBackdrop").hidden = true;
  }

  window.closeDrawer = closeDrawer;

  window.savePMA = function(id) {
    const p = PMA.byId(id);
    if (!p) return false;

    const form = document.getElementById("viewForm");
    const formData = new FormData(form);

    p.project_code = formData.get("project_code") || "";
    p.description = formData.get("description") || "";
    p.pm = formData.get("pm") || "";
    p.sale = formData.get("sale") || "";
    p.bu_name = formData.get("bu_name") || "";
    p.pm_detail = formData.get("pm_detail") || "";
    p.pma_type = formData.get("pma_type") || "";
    p.customer = formData.get("customer") || "";
    p.product = formData.get("product") || "";
    p.pma_start = formData.get("pma_start") || null;
    p.pma_end = formData.get("pma_end") || null;
    p.plan_date = formData.get("plan_date") || null;
    p.actual_date = formData.get("actual_date") || null;
    const diffVal = formData.get("diff_days");
    p.diff_days = diffVal !== null && diffVal !== "" ? parseInt(diffVal) : null;
    p.pma_status = formData.get("pma_status") || "";
    p.actual_user = formData.get("actual_user") || "";
    p.remark = formData.get("remark") || "";

    PMA.save();
    PMA.toast("PMA data saved successfully");
    closeDrawer();
    if (window.renderPlanTable) window.renderPlanTable();
    return false;
  };

  // Global data ready callback
  window.onDataReady = function() {
    switchView("dashboard");
  };
})();
