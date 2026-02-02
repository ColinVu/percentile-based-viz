/**
 * Summation index view
 * Implements the additive framework from Book1.xlsx
 * Score = SUM over k-bands of (k × pct of variables in that band)
 */

function getKValuesForSummation() {
  // Same bands as spreadsheet
  return [49.9, 49, 45, 40, 35, 30, 25, 20, 15, 10, 5, 1];
}

function isValidPercentile(p) {
  return typeof p === 'number' && isFinite(p) && p >= 0 && p <= 100;
}

function computeSummationFramework(percentiles) {
  const values = (percentiles || [])
    .map(d => d?.percentile)
    .filter(isValidPercentile);

  const N = values.length;
  if (N === 0) return { rows: [], totalScore: null };

  // Distances from 50
  const distances = values.map(p => Math.abs(p - 50));

  const ks = getKValuesForSummation();
  const rows = [];

  let prevK = Infinity;
  let totalScore = 0;

  ks.forEach(k => {
    const inBand = distances.filter(d => d >= k && d < prevK).length;
    const pct = inBand / N;
    const score = k * pct;

    rows.push({
      k,
      lower: 50 - k,
      upper: 50 + k,
      pct,
      score
    });

    totalScore += score;
    prevK = k;
  });

  return { rows, totalScore };
}

/**
 * Renders the summation pane with the given data.
 */
function renderSummation(data, container) {
  const el = container || document.getElementById('summation-content');
  if (!el) return;

  const { selectedLocation, percentiles = [] } = data || {};
  el.replaceChildren();

  const header = document.createElement('div');
  header.className = 'h-index-header';
  header.textContent = selectedLocation || 'No location selected';
  el.appendChild(header);

  if (!percentiles.length) {
    const empty = document.createElement('div');
    empty.className = 'h-index-empty';
    empty.textContent = 'No percentile data available.';
    el.appendChild(empty);
    return;
  }

  const { rows, totalScore } = computeSummationFramework(percentiles);

  const table = document.createElement('table');
  table.className = 'h-index-framework-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>variable k</th>
        <th>50 - k</th>
        <th>50 + k</th>
        <th>pct of vars. in this range</th>
        <th>score</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.k}</td>
      <td>${r.lower.toFixed(1)}</td>
      <td>${r.upper.toFixed(1)}</td>
      <td>${r.pct.toFixed(2)}</td>
      <td>${r.score.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.appendChild(table);

  const total = document.createElement('div');
  total.className = 'h-index-framework-score';
  total.textContent = `Total score: ${totalScore.toFixed(2)}`;
  el.appendChild(total);
}

window.renderSummation = renderSummation;
