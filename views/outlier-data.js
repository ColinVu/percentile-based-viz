/**
 * Outlier Data view
 * Shows which records are outliers (top 5% or bottom 5%) for each variable
 */

/**
 * Computes outlier data for all records in the dataset.
 * For each metric, identifies records in top 5% and bottom 5%.
 * @returns {Array<{recordName: string, outliers: Array<{metric: string, position: 'top'|'bottom', percentile: number}>}>}
 */
function computeOutlierData() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) {
    return [];
  }

  // Get numeric metrics (exclude FIPS codes)
  const metrics = (typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [])
    .filter(m => {
      const norm = (m || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm !== 'fipscode';
    });

  if (metrics.length === 0) return [];

  const data = window.appState.jsonData;
  
  // Determine record identifier column
  let idColumn;
  if (window.appState.geoMode === 'country') {
    idColumn = 'Country';
  } else if (window.appState.geoMode === 'county') {
    idColumn = '__displayName';
  } else {
    idColumn = window.appState.dataColumn;
  }

  // For each record, find which metrics they're an outlier in
  const results = [];

  data.forEach(record => {
    const recordName = record[idColumn] || 'Unknown';
    const outliers = [];

    metrics.forEach(metric => {
      const value = record[metric];
      
      // Skip invalid values
      if (value === '..' || value === undefined || value === null) return;
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) return;

      // Get all valid values for this metric
      const validValues = data
        .map(d => d[metric])
        .filter(v => v !== '..' && v !== undefined && v !== null)
        .map(v => typeof v === 'number' ? v : parseFloat(v))
        .filter(v => !isNaN(v));

      if (validValues.length < 3) return;

      // Calculate percentile
      validValues.sort((a, b) => a - b);
      const smaller = validValues.filter(v => v < numValue).length;
      const equal = validValues.filter(v => v === numValue).length;
      const percentile = Math.round((smaller + 0.5 * equal) / validValues.length * 100);

      // Check if outlier (top 5% or bottom 5%)
      if (percentile <= 5) {
        outliers.push({
          metric: metric,
          position: 'bottom',
          percentile: percentile,
          value: numValue
        });
      } else if (percentile >= 95) {
        outliers.push({
          metric: metric,
          position: 'top',
          percentile: percentile,
          value: numValue
        });
      }
    });

    // Only include records that have at least one outlier
    if (outliers.length > 0) {
      results.push({
        recordName: recordName,
        outliers: outliers
      });
    }
  });

  // Sort by number of outliers (most outliers first)
  results.sort((a, b) => b.outliers.length - a.outliers.length);

  return results;
}

/**
 * Renders the outlier data view.
 * @param {HTMLElement} [container] - Optional container element. If not provided, uses #outlier-data-content.
 */
function renderOutlierData(container) {
  const el = container || document.getElementById('outlier-data-content');
  if (!el) return;

  el.innerHTML = '<div class="outlier-data-loading">Computing outliers...</div>';

  // Run computation asynchronously to avoid blocking UI
  setTimeout(() => {
    const outlierData = computeOutlierData();
    
    el.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'outlier-data-header';
    header.textContent = `Outlier Analysis (Top/Bottom 5%)`;
    el.appendChild(header);

    if (outlierData.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'outlier-data-empty';
      empty.textContent = 'No outliers found in the dataset.';
      el.appendChild(empty);
      return;
    }

    // List container
    const list = document.createElement('div');
    list.className = 'outlier-data-list';

    const formatMetricName = typeof window.formatMetricName === 'function' 
      ? window.formatMetricName 
      : (s) => s;

    outlierData.forEach(({ recordName, outliers }) => {
      const row = document.createElement('div');
      row.className = 'outlier-data-row';

      // Left column: Record name
      const nameCol = document.createElement('div');
      nameCol.className = 'outlier-data-name';
      nameCol.textContent = recordName;

      // Right column: Outlier metrics
      const metricsCol = document.createElement('div');
      metricsCol.className = 'outlier-data-metrics';

      outliers.forEach(({ metric, percentile, position }) => {
        const line = document.createElement('div');
        line.className = `outlier-data-metric-line outlier-${position}`;
        line.textContent = `${formatMetricName(metric)} ${percentile}%`;
        metricsCol.appendChild(line);
      });

      row.appendChild(nameCol);
      row.appendChild(metricsCol);
      list.appendChild(row);
    });

    el.appendChild(list);
  }, 10);
}

window.renderOutlierData = renderOutlierData;
window.computeOutlierData = computeOutlierData;
