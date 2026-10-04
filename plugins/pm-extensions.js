// Patches index.html's globals from outside -- "the core" stays untouched.
// With every field below left blank, a row renders exactly as the core alone would.
(function () {
  const BASE_FIELDS = ['id', 'name', 'resource', 'start', 'end', 'duration', 'percent', 'deps'];
  const NEW_FIELDS = [
    { name: 'deadline', label: 'Deadline', field: dateField },
    { name: 'risk', label: 'Risk', field: () => selectField(['', 'medium', 'high'], '(low)') },
    { name: 'size', label: 'Size', field: () => selectField(['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'], '(default)') }
  ];
  const ALL_FIELDS = [...BASE_FIELDS, ...NEW_FIELDS.map(c => c.name)];
  const INDEX = Object.fromEntries(ALL_FIELDS.map((name, i) => [name, i]));

  const RISK_STROKE = {
    // low: (default) no outline, so no entry here
    medium: { stroke: '#d4a017', 'stroke-width': 3 },
    high: { stroke: '#c1121f', 'stroke-width': 3 }
  };
  const SIZE_FRACTION = {
    XS: 0.25, S: 0.37, M: 0.5, L: 0.63, XL: 0.75, '2XL': 0.87, '3XL': 0.97
  };

  // -- the story --------------------------------------------------------
  // Everything below is the whole plugin: grow the table with three more
  // columns, keep decorating the chart every time it's redrawn, and teach
  // CSV import/export the wider row shape. The "how" of each step is in
  // the supporting definitions further down.

  addNewFieldHeaders();

  const coreAdd = window.add;
  window.add = (v = {}) => {
    coreAdd(v);
    growLastRow(v);
  };

  let lastRows = [];
  const coreDraw = window.draw;
  window.draw = () => {
    coreDraw();
    lastRows = getAllRows();
  };

  const chartBox = document.getElementById('chart');
  new MutationObserver(redecorate).observe(chartBox, { childList: true, subtree: true });
  
  // Google's own tooltip-hover redraw can also strip our decoration, on its
  // own schedule; settle shortly after the mouse goes idle rather than
  // trying to race it.
  let moveTimer;
  chartBox.addEventListener('mousemove', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(redecorate, 50);
  });

  fixOverflowingDataPanel();

  window.exp = exportCSV;
  document.getElementById('import').onchange = importCSV;

  // -- growing the table -------------------------------------------------

  function addNewFieldHeaders() {
    const headerRow = document.querySelector('#tbl tr');
    const blank = headerRow.lastElementChild;
    NEW_FIELDS.forEach(col => headerRow.insertBefore(th(col.label), blank));
  }

  function growLastRow(v) {
    const tbl = document.getElementById('tbl');
    const tr = tbl.rows[tbl.rows.length - 1];
    const deleteCell = tr.lastElementChild;
    NEW_FIELDS.forEach(col => {
      const input = col.field();
      input.value = v[col.name] || '';
      input.oninput = () => window.draw();
      const td = document.createElement('td');
      td.appendChild(input);
      tr.insertBefore(td, deleteCell);
    });
  }

  function th(label) {
    const el = document.createElement('th');
    el.textContent = label;
    return el;
  }

  function dateField() {
    const inp = document.createElement('input');
    inp.type = 'date';
    return inp;
  }

  function selectField(options, placeholderLabel) {
    const sel = document.createElement('select');
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt || placeholderLabel;
      sel.appendChild(o);
    });
    return sel;
  }

  function getAllRows() {
    return [...document.querySelectorAll('#tbl tr:not(:first-child)')];
  }

  function valueAt(row, field) {
    return row.cells[INDEX[field]].children[0].value;
  }

  // -- decorating the chart ----------------------------------------------
  // For every row that has one, this paints a risk outline, a size-scaled
  // bar, and a deadline tick directly onto Google's rendered SVG -- the
  // one thing the chart library has no column for.

  let decorating = false;

  function redecorate() {
    if (!decorating) decorate(lastRows);
  }

  function decorate(rows) {
    const svg = getChartSVG();
    if (!svg || !rows.length) return;
    decorating = true;

    const trackHeight = trackHeightOf(svg, rows.length);
    svg.querySelectorAll('line.deadline-marker').forEach(l => l.remove());
    const bars = barsOf(svg);
    const progress = progressOverlaysOf(svg);

    rows.forEach((row, i) => {
      const bar = bars[i];
      if (!bar) return;
      resizeBar(svg, bar, progress[i], valueAt(row, 'size'), trackHeight);
      outlineRisk(bar, valueAt(row, 'risk'));
      markDeadline(svg, bar, row, i, trackHeight, valueAt(row, 'deadline'));
    });

    // The MutationObserver above would otherwise see these very writes and
    // re-enter immediately; its callback is already microtask-queued by this
    // point, so deferring the reset (rather than clearing it before we
    // return) lets it still see `true`.
    Promise.resolve().then(() => { decorating = false; });
  }

  function resizeBar(svg, bar, progress, size, trackHeight) {
    const fraction = SIZE_FRACTION[size];
    if (!fraction) return;

    const origHeight = +bar.getAttribute('height');
    const x = +bar.getAttribute('x'), width = +bar.getAttribute('width');
    const targetHeight = Math.min(fraction * trackHeight, trackHeight - 2);
    const factor = targetHeight / origHeight;
    const cx = x + width / 2, cy = +bar.getAttribute('y') + origHeight / 2;
    const transform = `translate(${cx} ${cy}) scale(1 ${factor}) translate(${-cx} ${-cy})`;

    [bar, progress, shadowOf(svg, bar)].forEach(el => el && el.setAttribute('transform', transform));
  }

  function outlineRisk(bar, risk) {
    const stroke = RISK_STROKE[risk];
    if (stroke) Object.entries(stroke).forEach(([k, v]) => bar.setAttribute(k, v));
  }

  function markDeadline(svg, bar, row, rowIndex, trackHeight, deadline) {
    if (!deadline) return;
    const start = new Date(valueAt(row, 'start'));
    const end = new Date(valueAt(row, 'end'));
    const spanMs = end - start;
    if (!spanMs) return;

    const pxPerMs = +bar.getAttribute('width') / spanMs;
    const x = +bar.getAttribute('x') + (new Date(deadline) - start) * pxPerMs;
    const y = rowIndex * trackHeight;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'deadline-marker');
    line.setAttribute('x1', x);
    line.setAttribute('x2', x);
    line.setAttribute('y1', y + 4);
    line.setAttribute('y2', y + trackHeight - 4);
    line.setAttribute('stroke', '#e63946');
    line.setAttribute('stroke-width', 2);
    svg.appendChild(line);
  }

  function getChartSVG() {
    return document.querySelector('#chart svg');
  }

  // Core's height is `rows.length * trackHeight + 45`; reading it back off
  // the rendered SVG sidesteps needing trackHeight from THEME, which (like
  // the chart instance itself) is a top-level `const` in a classic script
  // and so never attaches to `window` -- there's no reaching it from here.
  function trackHeightOf(svg, rowCount) {
    return (+svg.getAttribute('height') - 45) / rowCount;
  }

  function barsOf(svg) {
    return [...svg.querySelectorAll('rect[rx="10"]')].filter(r => r.getAttribute('fill') !== '#424242');
  }

  function progressOverlaysOf(svg) {
    return [...svg.querySelectorAll('path')].filter(p => {
      const fill = p.getAttribute('fill');
      return fill && fill !== 'none';
    });
  }

  // Google renders one of these behind a bar on the critical path, at the
  // bar's native (pre-resize) geometry -- not one per row, so it can't be
  // paired up by index the way bars and progress-overlays can. Matched by
  // position instead, once we already know which bar it belongs to.
  function shadowOf(svg, bar) {
    const x = +bar.getAttribute('x'), width = +bar.getAttribute('width');
    return [...svg.querySelectorAll('rect[fill="#424242"]')].find(s =>
      Math.abs(+s.getAttribute('x') - x) < 0.5 && Math.abs(+s.getAttribute('width') - width) < 0.5
    );
  }

  // -- the data panel ------------------------------------------------------

  function fixOverflowingDataPanel() {
    const style = document.createElement('style');
    style.textContent = '#csvSection { max-width: 100vw; }';
    document.head.appendChild(style);
  }

  // -- CSV --------------------------------------------------------------

  async function exportCSV() {
    const rows = getAllRows();
    if (!rows.length) return alert('No data to export');
    const csv = [ALL_FIELDS.join(','), ...rows.map(r =>
      [...r.querySelectorAll('input,select')].map(i => quote(i.value)).join(',')
    )].join('\n');

    const importedFile = document.getElementById('import').files[0];
    const defaultName = importedFile?.name || 'gantt.csv';

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(csv);
        await writable.close();
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv]));
    a.download = defaultName;
    a.click();
  }

  function importCSV(e) {
    const file = e.target.files[0];
    document.querySelector('.file-name-display').textContent = file?.name;
    document.title = file?.name;
    if (!file) return;

    file.text().then(text => {
      getAllRows().forEach(r => r.remove());
      text.split('\n').slice(1).forEach(line => {
        const values = parseCSVLine(line);
        const row = Object.fromEntries(ALL_FIELDS.map((name, i) => [name, values[i]]));
        if (row.id) window.add(row);
      });
      window.draw();
    });
  }

  function parseCSVLine(line) {
    const parts = [];
    let current = '', inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
      else current += char;
    }
    parts.push(current.trim());
    return parts;
  }

  function quote(value) {
    return value.includes(',') ? `"${value}"` : value;
  }
})();
