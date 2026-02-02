/**
 * H-index view
 * Displays the currently selected location and a spreadsheet-style framework table
 * derived from the record's percentiles.
 *
 * Framework rules (per your spreadsheet):
 * - k values: 50,45,...,10,5,1
 * - "CUMULATIVE # of appearances at or above k" means:
 *     count of metrics where |percentile - 50| >= k
 *   Examples:
 *     k=50 -> only percentiles 0 and 100
 *     k=10 -> include all except those in [40,60] (i.e., include <=40 or >=60)
 * - "score" column mirrors the spreadsheet's boolean-style column (TRUE/FALSE).
 */

function computeTrueScore(percentileValues) {
  let best = null;

  for (let k = 1; k <= 50; k++) {
    let count = 0;
    for (const p of percentileValues) {
      if (Math.abs(p - 50) >= k) count++;
    }
    if (count > k) best = k;
  }

  return best;
}

function getKValuesForDisplay() {
  const ks = [];
  for (let k = 50; k >= 10; k -= 5) ks.push(k);
  ks.push(5, 1);
  return ks;
}



function getKValues() {
  // 50 down to 10 by 5, then 5 and 1
  const ks = [];
  for (let k = 50; k >= 10; k -= 5) ks.push(k);
  ks.push(5, 1);
  return ks;
}

function isValidPercentile(p) {
  return typeof p === 'number' && isFinite(p) && p >= 0 && p <= 100;
}

function countAtOrAboveKDistanceFrom50(percentileValues, k) {
  // "At or above k" means distance from 50 is >= k
  // Uses a tiny epsilon so floats like 59.999999 don't behave weirdly.
  const EPS = 1e-9;
  let count = 0;
  for (const p of percentileValues) {
    if (Math.abs(p - 50) + EPS >= k) count++;
  }
  return count;
}

function computeFrameworkRows(percentiles) {
  const pctValues = (percentiles || [])
    .map(d => d?.percentile)
    .filter(p => typeof p === 'number' && p >= 0 && p <= 100);

  // TRUE score (1–50, all integers)
  const trueScore = computeTrueScore(pctValues);

  // Display rows (spreadsheet-style)
  const rows = getKValuesForDisplay().map(k => {
    const cumulative = pctValues.filter(p => Math.abs(p - 50) >= k).length;
    const fiftyMinusK = 50 - k;
    const scoreBool = cumulative > k;

    return { k, fiftyMinusK, cumulative, scoreBool };
  });

  return {
    rows,
    score: trueScore,
    numVars: pctValues.length
  };
}


/**
 * Renders the H-index pane with the given data.
 * @param {Object} data
 * @param {string} data.selectedLocation - The currently selected location name
 * @param {Array<{metricKey: string, percentile: number, value: number}>} data.percentiles - Percentiles for each metric
 * @param {HTMLElement} [container] - Optional container element. If not provided, uses #h-index-content.
 */
function renderHIndex(data, container) {
  const el = container || document.getElementById('h-index-content');
  if (!el) return;

  const { selectedLocation, percentiles = [] } = data || {};
  el.replaceChildren();

  // Header: selected location
  const header = document.createElement('div');
  header.className = 'h-index-header';
  header.textContent = selectedLocation || 'No location selected';
  el.appendChild(header);

  if (!percentiles || percentiles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'h-index-empty';
    empty.textContent = 'No percentile data available. Select a location to see its percentiles.';
    el.appendChild(empty);
    return;
  }

  const formatMetricName =
    typeof window.formatMetricName === 'function' ? window.formatMetricName : (s) => s;
  const formatValue =
    typeof window.formatValue === 'function' ? window.formatValue : (v) => String(v);

  // ---- Framework table (spreadsheet-style) ----
  const { rows, score, numVars } = computeFrameworkRows(percentiles);

  const frameworkWrap = document.createElement('div');
  frameworkWrap.className = 'h-index-framework';

  const meta = document.createElement('div');
  meta.className = 'h-index-framework-meta';
  meta.textContent = `From ${numVars} variables`;
  frameworkWrap.appendChild(meta);

  const table = document.createElement('table');
  table.className = 'h-index-framework-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>k</th>
      <th>50-k</th>
      <th>Cum. var. &ge; k</th>
      <th>Valid?</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((r) => {
    const tr = document.createElement('tr');

    // Highlight the row that equals the final SCORE (optional but helpful)
    if (score != null && r.k === score) tr.className = 'h-index-framework-row--score';

    const tdK = document.createElement('td');
    tdK.textContent = String(r.k);

    const td50k = document.createElement('td');
    td50k.textContent = String(r.fiftyMinusK);

    const tdCum = document.createElement('td');
    tdCum.textContent = String(r.cumulative);

    const tdBool = document.createElement('td');
    // Fix encoding issues by using plain ASCII words (no checkmarks, no special symbols)
    tdBool.textContent = r.scoreBool ? 'TRUE' : 'FALSE';

    tr.appendChild(tdK);
    tr.appendChild(td50k);
    tr.appendChild(tdCum);
    tr.appendChild(tdBool);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  frameworkWrap.appendChild(table);

  // SCORE row (like the spreadsheet)
  const scoreRow = document.createElement('div');
  scoreRow.className = 'h-index-framework-score';
  scoreRow.textContent = `Score: ${score != null ? score : '—'}`;
  frameworkWrap.appendChild(scoreRow);

  el.appendChild(frameworkWrap);

  // ---- Existing metric list (kept, still useful for inspection) ----
  const list = document.createElement('div');
  list.className = 'h-index-list';

  // Keep the existing display order (descending percentile) like your original view.
  percentiles
    .slice()
    .sort((a, b) => (b?.percentile ?? -Infinity) - (a?.percentile ?? -Infinity))
    .forEach(({ metricKey, percentile, value }) => {
      const row = document.createElement('div');
      row.className = 'h-index-row';

      const metricSpan = document.createElement('span');
      metricSpan.className = 'h-index-metric';
      metricSpan.textContent = formatMetricName(metricKey);

      const pctSpan = document.createElement('span');
      pctSpan.className = 'h-index-percentile';
      pctSpan.textContent = isValidPercentile(percentile) ? `${percentile}%` : '—';

      const valueSpan = document.createElement('span');
      valueSpan.className = 'h-index-value';
      valueSpan.textContent = value != null && !isNaN(value) ? formatValue(value, metricKey) : '—';

      row.appendChild(metricSpan);
      row.appendChild(pctSpan);
      row.appendChild(valueSpan);
      list.appendChild(row);
    });

  //el.appendChild(list); uncomment to add variable list
}

window.renderHIndex = renderHIndex;
