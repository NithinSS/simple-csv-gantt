// chart.js — client module that fetches CSV timelines and draws Google Gantt charts
google.charts.load("current", { packages: ["gantt"] });

// ===== Google Charts Loading =====
let chartsReady = null;
function waitForCharts() {
  if (chartsReady) return chartsReady;
  if (google.visualization?.DataTable) {
    return (chartsReady = Promise.resolve());
  }
  return (chartsReady = new Promise((resolve) =>
    google.charts.setOnLoadCallback(resolve)
  ));
}

// ===== Data Conversion =====
function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

// Proper CSV parser that handles quoted values with commas
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  // Add last field
  values.push(current.trim());
  return values;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i] || ""));
      return obj;
    })
    .filter((row) => !Object.values(row).every((v) => !v));
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!isNaN(d)) return d;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, mm, dd, yy] = m;
    return new Date(yy < 100 ? 2000 + +yy : +yy, +mm - 1, +dd);
  }
  return null;
}

function getField(row, ...keys) {
  for (const key of keys) {
    const val = row[key] || row[key.toLowerCase()];
    if (val !== undefined && val !== "") return val;
  }
  return "";
}

function buildDataTable(rows) {
  const data = new google.visualization.DataTable();
  data.addColumn("string", "Task ID");
  data.addColumn("string", "Task Name");
  data.addColumn("string", "Resource");
  data.addColumn("date", "Start Date");
  data.addColumn("date", "End Date");
  data.addColumn("number", "Duration");
  data.addColumn("number", "Percent Complete");
  data.addColumn("string", "Dependencies");

  data.addRows(
    rows.map((r) => [
      getField(r, "id", "task id", "taskid", "name"),
      getField(r, "name", "task name", "title") || getField(r, "id", "task id"),
      getField(r, "resource", "res") || null,
      toDate(getField(r, "start", "start date", "startdate")),
      toDate(getField(r, "end", "end date", "enddate")),
      (getField(r, "duration", "dur", "days") &&
        daysToMs(+getField(r, "duration", "dur", "days"))) ||
        null,
      +getField(r, "percent", "percent complete", "complete") || 0,
      getField(r, "dependencies", "deps", "dep") || null,
    ])
  );

  return data;
}

async function drawChart(rows) {
  try {
    await waitForCharts();
    const data = buildDataTable(rows);
    const chart = new google.visualization.Gantt(
      document.getElementById("chart_div")
    );
    chart.draw(data, { height: 750 });
  } catch (err) {
    console.error("Error drawing chart:", err);
    document.getElementById("chart_div").textContent = "Error: " + err.message;
  }
}

// ===== Editor Table =====
function formatDate(v) {
  const d = toDate(v);
  return d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    : "";
}

function createRow(data = {}) {
  const tr = document.createElement("tr");
  const fields = [
    { key: "id", type: "text", value: getField(data, "id", "task id") },
    {
      key: "name",
      type: "text",
      value: getField(data, "name", "task name", "title"),
    },
    { key: "resource", type: "text", value: getField(data, "resource") },
    {
      key: "start",
      type: "date",
      value: formatDate(getField(data, "start", "start date")),
    },
    {
      key: "end",
      type: "date",
      value: formatDate(getField(data, "end", "end date")),
    },
    {
      key: "duration",
      type: "number",
      value: getField(data, "duration", "days"),
      min: 0,
    },
    {
      key: "percent",
      type: "number",
      value: getField(data, "percent", "percent complete"),
      min: 0,
      max: 100,
    },
    {
      key: "dependencies",
      type: "text",
      value: getField(data, "dependencies", "deps"),
    },
  ];

  const inputs = fields.map((f) => {
    const input = document.createElement("input");
    input.type = f.type;
    input.value = f.value;
    if (f.min !== undefined) input.min = f.min;
    if (f.max !== undefined) input.max = f.max;
    if (f.key === "dependencies") input.setAttribute("list", "taskIdList");
    return input;
  });

  inputs.forEach((input) =>
    tr.appendChild(document.createElement("td")).appendChild(input)
  );

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => {
    tr.remove();
    updateDatalist();
  };

  const dupBtn = document.createElement("button");
  dupBtn.textContent = "Duplicate";
  dupBtn.onclick = () => {
    const clone = Object.fromEntries(
      fields.map((f, i) => [f.key, inputs[i].value])
    );
    tr.parentNode.insertBefore(createRow(clone), tr.nextSibling);
    updateDatalist();
  };

  const actionTd = document.createElement("td");
  actionTd.appendChild(dupBtn);
  actionTd.appendChild(document.createTextNode(" "));
  actionTd.appendChild(delBtn);
  tr.appendChild(actionTd);

  inputs[0].addEventListener("input", updateDatalist);
  return tr;
}

function updateDatalist() {
  const list = document.getElementById("taskIdList");
  if (!list) return;
  list.innerHTML = "";
  // Only get Task ID values (first input in each row)
  new Set(
    [...document.querySelectorAll("#dataTable tbody tr")]
      .map((tr) => {
        const idInput = tr.querySelector("td:first-child input");
        return idInput ? idInput.value.trim() : "";
      })
      .filter(Boolean)
  ).forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    list.appendChild(opt);
  });
}

function populateTable(rows) {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  rows.forEach((r) => tbody.appendChild(createRow(r)));
  updateDatalist();
}

function getTableRows() {
  return [...document.querySelectorAll("#dataTable tbody tr")].map((tr) => {
    const inputs = tr.querySelectorAll("input");
    return {
      id: inputs[0].value.trim(),
      name: inputs[1].value.trim(),
      resource: inputs[2].value.trim(),
      start: inputs[3].value,
      end: inputs[4].value,
      duration: inputs[5].value,
      percent: inputs[6].value,
      dependencies: inputs[7].value,
    };
  });
}

async function exportCSV() {
  const rows = getTableRows();
  const headers = [
    "id",
    "name",
    "resource",
    "start",
    "end",
    "duration",
    "percent",
    "dependencies",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = String(r[h] || "");
          return v.includes(",") || v.includes('"')
            ? `"${v.replace(/"/g, '""')}"`
            : v;
        })
        .join(",")
    ),
  ].join("\n");

  // Use File System Access API if available, otherwise fall back to download
  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: "timeline.csv",
        types: [
          {
            description: "CSV files",
            accept: { "text/csv": [".csv"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(csv);
      await writable.close();
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error saving file:", err);
        // Fall back to download
        downloadCSV(csv);
      }
    }
  } else {
    downloadCSV(csv);
  }
}

function downloadCSV(csv) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "timeline.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
}

// ===== Sample Data =====
const SAMPLE_DATA = `id,name,start,end,percent
Research,Find sources,2025-01-01,2025-01-05,100
Outline,Outline paper,2025-01-06,2025-01-06,100
Write,Write paper,2025-01-07,2025-01-09,25
Cite,Create bibliography,2025-01-07,2025-01-07,20
Complete,Hand in paper,2025-01-10,2025-01-10,0`;

// ===== Initialization =====
let originalData = null; // Store original uploaded CSV data

async function init() {
  const importInput = document.getElementById("importFile");
  const addBtn = document.getElementById("addRowBtn");
  const clearBtn = document.getElementById("clearRowsBtn");
  const renderBtn = document.getElementById("renderBtn");
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");

  function loadData(text) {
    const rows = parseCSV(text);
    originalData = text; // Store original for reset
    populateTable(rows);
    updateDatalist();
    drawChart(rows);
  }

  // Show sample chart on startup
  loadData(SAMPLE_DATA);

  importInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadData(ev.target.result);
    reader.readAsText(file);
  };

  addBtn.onclick = () => {
    document.querySelector("#dataTable tbody").appendChild(createRow());
    updateDatalist();
  };

  clearBtn.onclick = () => {
    document.querySelector("#dataTable tbody").innerHTML = "";
    updateDatalist();
  };

  renderBtn.onclick = () => drawChart(getTableRows());

  resetBtn.onclick = () => {
    if (originalData) {
      loadData(originalData);
    }
  };

  exportBtn.onclick = exportCSV;
}

document.addEventListener("DOMContentLoaded", init);
