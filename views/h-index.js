/**
 * H-index view
 * Displays all records with their H-index scores in a 2-column layout.
 * The H-index score represents how many metrics are at least k percentile points away from 50,
 * where k is the highest value such that at least k+1 metrics meet this criterion.
 */

/**
 * Renders the H-index pane with all records and their scores.
 * @param {HTMLElement} [container] - Optional container element. If not provided, uses #h-index-content.
 */
function renderHIndex(container) {
  const el = container || document.getElementById('h-index-content');
  if (!el) return;

  el.innerHTML = '<div class="h-index-loading">Computing H-index scores...</div>';

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
    header.className = 'h-index-header';
    header.textContent = 'H-Index Scores';
    el.appendChild(header);

    // Description
    const description = document.createElement('div');
    description.className = 'h-index-description';
    description.textContent = 'Measures how many metrics are at least k percentile points away from the median.';
    el.appendChild(description);

    if (records.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'h-index-empty';
      empty.textContent = 'No data available. Please load a dataset first.';
      el.appendChild(empty);
      return;
    }

    // Sort by H-index score (highest first, nulls last)
    const sortedRecords = records.slice().sort((a, b) => {
      if (a.hIndexScore === null && b.hIndexScore === null) return 0;
      if (a.hIndexScore === null) return 1;
      if (b.hIndexScore === null) return -1;
      return b.hIndexScore - a.hIndexScore;
    });

    // Create list container
    const list = document.createElement('div');
    list.className = 'h-index-list';

    sortedRecords.forEach(({ recordName, hIndexScore }) => {
      const row = document.createElement('div');
      row.className = 'h-index-row';

      // Left column: Record name
      const nameCol = document.createElement('div');
      nameCol.className = 'h-index-name';
      nameCol.textContent = recordName;

      // Right column: Score
      const scoreCol = document.createElement('div');
      scoreCol.className = 'h-index-score';
      scoreCol.textContent = hIndexScore !== null ? String(hIndexScore) : '—';

      row.appendChild(nameCol);
      row.appendChild(scoreCol);
      list.appendChild(row);
    });

    el.appendChild(list);
  }, 10);
}

window.renderHIndex = renderHIndex;
