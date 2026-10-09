# MFEC PMA Tracker

Preventive Maintenance Plan tracking web application — import Excel PMA Plan and view monthly summaries instantly.

## 📋 Project Structure

```
.
├── index.html              # Landing page + App shell
├── styles.css              # All styles
├── js/
│   ├── app.js              # App controller
│   ├── plan.js             # Plan view (list + filters)
│   ├── report.js           # Summary Report view
│   ├── upload.js           # Excel file import handler
│   └── util.js             # State, storage, formatting
├── libs/
│   └── xlsx.full.min.js    # SheetJS library (read Excel)
├── pma-tracker.yaml        # OpenShift Pod + Service + Route
└── README.md
```

## 🚀 Deploy on OpenShift

### Prerequisites
- `oc` CLI (v4.22+)
- Access to cluster `api.ailab.mfec.co.th:6443`
- Username: `ocpadmin`

### 1. Login

```bash
oc login https://api.ailab.mfec.co.th:6443 \
  --insecure-skip-tls-verify \
  --username=ocpadmin \
  --password=<password>
```

### 2. Create Namespace

```bash
oc new-project mfec-pma-tools
```

### 3. Create ConfigMaps

ConfigMap keys cannot contain `/`, so subdirectory files must be split into separate ConfigMaps with flat keys.

```bash
# Root files (index.html, styles.css)
oc create configmap pma-tracker-root \
  --from-file=index.html=./index.html \
  --from-file=styles.css=./styles.css \
  -n mfec-pma-tools

# JS files
oc create configmap pma-tracker-js \
  --from-file=app.js=./js/app.js \
  --from-file=plan.js=./js/plan.js \
  --from-file=report.js=./js/report.js \
  --from-file=upload.js=./js/upload.js \
  --from-file=util.js=./js/util.js \
  -n mfec-pma-tools

# XLSX library (large file ~951KB — use replace for annotation limit)
oc create configmap pma-tracker-libs \
  --from-file=xlsx.full.min.js=./libs/xlsx.full.min.js \
  --dry-run=client -o json | oc replace -f - -n mfec-pma-tools
```

> **Note:** `xlsx.full.min.js` is ~951KB which exceeds the `oc apply` annotation limit (256KB). Use `oc create --dry-run=client -o json | oc replace -f -` to avoid the limit.

### 4. Deploy

```bash
oc apply -f pma-tracker.yaml -n mfec-pma-tools
```

The `pma-tracker.yaml` creates:
- **Pod**: `pma-tracker` with busybox:1.36 running httpd on port 8080
- **Service**: ClusterIP exposing port 8080
- **Route**: Edge TLS termination at `pma-tracker-mfec-pma-tools.apps.ailab.mfec.co.th`

### 5. Verify

```bash
oc get pod pma-tracker -n mfec-pma-tools
oc logs pma-tracker -n mfec-pma-tools
```

### 6. Access

**URL:** https://pma-tracker-mfec-pma-tools.apps.ailab.mfec.co.th

---

## 📁 Static Files Update

When source files change, update the ConfigMaps:

```bash
# Update root files
oc create configmap pma-tracker-root \
  --from-file=index.html=./index.html \
  --from-file=styles.css=./styles.css \
  --dry-run=client -o json | oc replace -f - -n mfec-pma-tools

# Update JS files
oc create configmap pma-tracker-js \
  --from-file=app.js=./js/app.js \
  --from-file=plan.js=./js/plan.js \
  --from-file=report.js=./js/report.js \
  --from-file=upload.js=./js/upload.js \
  --from-file=util.js=./js/util.js \
  --dry-run=client -o json | oc replace -f - -n mfec-pma-tools

# Update large library
oc create configmap pma-tracker-libs \
  --from-file=xlsx.full.min.js=./libs/xlsx.full.min.js \
  --dry-run=client -o json | oc replace -f - -n mfec-pma-tools
```

The Pod picks up new files automatically within ~1 minute (kubelet volume sync). No restart needed.

To force immediate reload:

```bash
oc delete pod pma-tracker -n mfec-pma-tools
```

---

## 🔧 How It Works

1. **Import**: Upload your `PMA Plan - YYYY-MM-DD.xlsx` (sheet `PMA Plan All`)
2. **Parse**: SheetJS reads all 32 columns including Project Code, Customer, PM, Product, Plan Date, Actual Date, Diff Days, PMA Status, Plan User
3. **Store**: Data persists in localStorage — no server uploads
4. **Track**: Filter by Month, Year, Customer, Product, Status
5. **Report**: Summary tables by Customer, Product, Plan User, and Monthly breakdown

### Excel Columns Mapped

| Column | Field |
|--------|-------|
| A | Project Code |
| B | Description |
| C | PM Code |
| D | PM |
| E | Sale |
| G | BU Name |
| H | PM# Detail |
| I | Plan User |
| K | Customer |
| M | Product |
| N | PMA Start Date |
| O | PMA End Date |
| T | Plan Date |
| U | Diff Days |
| V | Actual Date |
| AB | PMA Type |
| AC | PMA Status |
| AD | Remark |

---

## 🌐 Git Repository

**URL:** https://github.com/nookandnui-cloud/PMATracker

```bash
git clone git@github.com:nookandnui-cloud/PMATracker.git
```

---

## 📝 Notes

- Namespace must be lowercase RFC 1123: `mfec-pma-tools`
- ConfigMap keys cannot contain `/` — split by directory level
- `xlsx.full.min.js` ~951KB requires `oc replace` (not `oc apply`) to avoid 256KB annotation limit
- busybox:1.36 has no `USER` directive — safe to use with ConfigMap volumes on this cluster
- UBI images (nginx, httpd, python) fail with `setgroups: Invalid argument` on CRI-O + ConfigMap volumes
