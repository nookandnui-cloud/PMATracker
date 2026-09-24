/* upload.js — Excel file ingestion for PMA Plan */
"use strict";

(function() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const btnBrowse = document.getElementById("btnBrowse");
  const btnContinue = document.getElementById("btnContinue");
  const landingError = document.getElementById("landingError");
  const landing = document.getElementById("landing");
  const app = document.getElementById("app");

  function checkExisting() {
    const raw = localStorage.getItem(PMA.LS_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s && s.plans && s.plans.length > 0 && s.source) {
          btnContinue.hidden = false;
        }
      } catch(e) {}
    }
  }
  checkExisting();

  btnContinue.addEventListener("click", () => {
    if (PMA.state && PMA.state.plans.length > 0) {
      showApp();
    }
  });

  btnBrowse.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target !== btnBrowse) fileInput.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag");
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      handleFile(fileInput.files[0]);
    }
  });

  function showError(msg) {
    landingError.textContent = msg;
    landingError.hidden = false;
  }

  function handleFile(file) {
    landingError.hidden = false;
    landingError.textContent = "Reading file...";
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        let sheetName = "PMA Plan All";
        if (!workbook.Sheets[sheetName]) {
          sheetName = workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const plans = parseRows(rows);

        if (plans.length === 0) {
          showError("No PMA Plan data found in file");
          return;
        }

        PMA.ingest(plans, file.name, sheetName);
        showApp();
      } catch (err) {
        console.error(err);
        showError("Failed to read file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function findColumn(headers, patterns) {
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      for (const p of patterns) {
        if (lower === p || lower.startsWith(p + " ") || lower === p + ":") {
          return headers.indexOf(h);
        }
      }
    }
    for (const h of headers) {
      const lower = h.toLowerCase().trim();
      for (const p of patterns) {
        if (lower.includes(p)) {
          return headers.indexOf(h);
        }
      }
    }
    return -1;
  }

  function parseRows(rows) {
    let headerRow = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(c => String(c).toLowerCase());
      if (row.some(c => c.includes("project code")) && row.some(c => c.includes("pma start date"))) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) return [];

    const headers = rows[headerRow].map(c => String(c).trim());

    const col = {};
    col.project_code = findColumn(headers, ["project code"]);
    col.description = findColumn(headers, ["description"]);
    col.pm_code = findColumn(headers, ["pm code"]);
    col.pm = headers.findIndex(h => h.toLowerCase().trim() === "pm");
    col.sale = headers.findIndex(h => h.toLowerCase().trim() === "sale");
    col.bu_code = findColumn(headers, ["bu code"]);
    col.bu_name = findColumn(headers, ["bu name"]);
    col.pm_detail = findColumn(headers, ["pm# detail"]);
    col.plan_user = findColumn(headers, ["plan user"]);
    col.active_flag = findColumn(headers, ["active flag"]);
    col.customer = headers.findIndex(h => h.toLowerCase().trim() === "customer");
    col.customer_code = findColumn(headers, ["customer code"]);
    col.product = findColumn(headers, ["product"]);
    col.pma_start = findColumn(headers, ["pma start date"]);
    col.pma_end = findColumn(headers, ["pma end date"]);
    col.customer_start = findColumn(headers, ["customer start date"]);
    col.customer_end = findColumn(headers, ["customer end date"]);
    col.has_plan_delay = findColumn(headers, ["has plan delay"]);
    col.plan_delay = findColumn(headers, ["plan delay"]);
    col.plan_date = findColumn(headers, ["plan date"]);
    col.diff_days = findColumn(headers, ["diff days"]);
    col.actual_date = findColumn(headers, ["actual date"]);
    col.actual_user = findColumn(headers, ["actual user"]);
    col.actual_user_code = findColumn(headers, ["actual user code"]);
    col.actual_nickname = findColumn(headers, ["actual nickname"]);
    col.actual_user_status = findColumn(headers, ["actual user status"]);
    col.postpone_date = findColumn(headers, ["postpone date"]);
    col.pma_type = findColumn(headers, ["pma type"]);
    col.pma_status = findColumn(headers, ["pma status"]);
    col.remark = findColumn(headers, ["remark"]);
    col.created_at = findColumn(headers, ["created at"]);
    col.created_by = findColumn(headers, ["created by"]);

    const plans = [];
    let id = 1;
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const projectCode = col.project_code >= 0 ? String(row[col.project_code] || "").trim() : "";
      const description = col.description >= 0 ? String(row[col.description] || "").trim() : "";
      const pmDetail = col.pm_detail >= 0 ? String(row[col.pm_detail] || "").trim() : "";

      if (!projectCode && !description && !pmDetail) continue;

      plans.push({
        id: id++,
        project_code: projectCode,
        description: description,
        pm_code: col.pm_code >= 0 ? String(row[col.pm_code] || "").trim() : "",
        pm: col.pm >= 0 ? String(row[col.pm] || "").trim() : "",
        sale: col.sale >= 0 ? String(row[col.sale] || "").trim() : "",
        bu_code: col.bu_code >= 0 ? String(row[col.bu_code] || "").trim() : "",
        bu_name: col.bu_name >= 0 ? String(row[col.bu_name] || "").trim() : "",
        pm_detail: pmDetail,
        plan_user: col.plan_user >= 0 ? String(row[col.plan_user] || "").trim() : "",
        active_flag: col.active_flag >= 0 ? row[col.active_flag] : null,
        customer: col.customer >= 0 ? String(row[col.customer] || "").trim() : "",
        customer_code: col.customer_code >= 0 ? String(row[col.customer_code] || "").trim() : "",
        product: col.product >= 0 ? String(row[col.product] || "").trim() : "",
        pma_start: col.pma_start >= 0 ? parseExcelDateValue(row[col.pma_start]) : null,
        pma_end: col.pma_end >= 0 ? parseExcelDateValue(row[col.pma_end]) : null,
        customer_start: col.customer_start >= 0 ? parseExcelDateValue(row[col.customer_start]) : null,
        customer_end: col.customer_end >= 0 ? parseExcelDateValue(row[col.customer_end]) : null,
        has_plan_delay: col.has_plan_delay >= 0 ? row[col.has_plan_delay] : null,
        plan_delay: col.plan_delay >= 0 ? row[col.plan_delay] : null,
        plan_date: col.plan_date >= 0 ? parseExcelDateValue(row[col.plan_date]) : null,
        diff_days: col.diff_days >= 0 ? row[col.diff_days] : null,
        actual_date: col.actual_date >= 0 ? parseExcelDateValue(row[col.actual_date]) : null,
        actual_user: col.actual_user >= 0 ? String(row[col.actual_user] || "").trim() : "",
        actual_user_code: col.actual_user_code >= 0 ? String(row[col.actual_user_code] || "").trim() : "",
        actual_nickname: col.actual_nickname >= 0 ? String(row[col.actual_nickname] || "").trim() : "",
        actual_user_status: col.actual_user_status >= 0 ? String(row[col.actual_user_status] || "").trim() : "",
        postpone_date: col.postpone_date >= 0 ? parseExcelDateValue(row[col.postpone_date]) : null,
        pma_type: col.pma_type >= 0 ? String(row[col.pma_type] || "").trim() : "",
        pma_status: col.pma_status >= 0 ? String(row[col.pma_status] || "").trim() : "",
        remark: col.remark >= 0 ? String(row[col.remark] || "").trim() : "",
        created_at: col.created_at >= 0 ? parseExcelDateValue(row[col.created_at]) : null,
        created_by: col.created_by >= 0 ? String(row[col.created_by] || "").trim() : ""
      });
    }
    return plans;
  }

  function parseExcelDateValue(v) {
    if (!v && v !== 0) return null;
    if (typeof v === "number" && v > 40000 && v < 60000) {
      const base = new Date(1899, 11, 30);
      const d = new Date(base.getTime() + v * 86400000);
      return d.toISOString().slice(0, 10);
    }
    if (typeof v === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
      if (m) return v.slice(0, 10);
      return v || null;
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }

  function showApp() {
    landing.hidden = true;
    app.hidden = false;
    document.getElementById("dataMeta").textContent =
      `${PMA.state.source.fileName} · ${PMA.state.plans.length} items`;
    if (window.onDataReady) window.onDataReady();
  }

  window.changeFile = function() {
    app.hidden = true;
    landing.hidden = false;
    checkExisting();
  };

  window.resetData = function() {
    if (confirm("Clear all data and return to upload page?")) {
      PMA.reset();
      app.hidden = true;
      landing.hidden = false;
      btnContinue.hidden = true;
    }
  };
})();
