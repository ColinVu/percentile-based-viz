/**
 * Summation index view
 * Displays all records with their Summation scores in a 2-column layout.
 * The summation score is calculated by summing (k × percentage of variables in each k-band),
 * where k represents the distance from the median (50th percentile).
 */

/**
 * Renders the Summation pane with all records and their scores.
 * @param {HTMLElement} [container] - Optional container element. If not provided, uses #summation-content.
 */
function renderSummation(container) {
  const el = container || document.getElementById('summation-content');
  if (!el) return;

  el.innerHTML = '<div class="summation-loading">Computing Summation scores...</div>';

  // Run computation asynchronously to avoid blocking UI
  setTimeout(() => {
    // Check if derived data cache is computed
    if (!window.appState.derivedDataCache.computed) {
      if (typeof window.computeAllDerivedData === 'function') {
        window.computeAllDerivedData();
      }
    }

    const records = window.appState.derivedDataCache.records || [];
    
    el.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'summation-header';
    header.textContent = 'Summation Scores (Experimental)';
    el.appendChild(header);

    // Description
    const description = document.createElement('div');
    description.className = 'summation-description';
    description.textContent = 'Weighted sum showing how far each record deviates from the median across all metrics.';
    el.appendChild(description);

    if (records.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'summation-empty';
      empty.textContent = 'No data available. Please load a dataset first.';
      el.appendChild(empty);
      return;
    }

    // Sort by Summation score (highest first, nulls last)
    const sortedRecords = records.slice().sort((a, b) => {
      if (a.summationScore === null && b.summationScore === null) return 0;
      if (a.summationScore === null) return 1;
      if (b.summationScore === null) return -1;
      return b.summationScore - a.summationScore;
    });

    // Create list container
    const list = document.createElement('div');
    list.className = 'summation-list';

    sortedRecords.forEach(({ recordName, summationScore }) => {
      const row = document.createElement('div');
      row.className = 'summation-row';

      // Left column: Record name
      const nameCol = document.createElement('div');
      nameCol.className = 'summation-name';
      nameCol.textContent = recordName;

      // Right column: Score
      const scoreCol = document.createElement('div');
      scoreCol.className = 'summation-score';
      scoreCol.textContent = summationScore !== null ? summationScore.toFixed(2) : '—';

      row.appendChild(nameCol);
      row.appendChild(scoreCol);
      list.appendChild(row);
    });

    el.appendChild(list);
  }, 10);
}

window.renderSummation = renderSummation;
