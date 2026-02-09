/**
 * Outlier Data view
 * Shows which records are outliers (top 5% or bottom 5%) for each variable
 */

/**
 * Renders the outlier data view using cached derived data.
 * @param {HTMLElement} [container] - Optional container element. If not provided, uses #outlier-data-content.
 */
function renderOutlierData(container) {
  const el = container || document.getElementById('outlier-data-content');
  if (!el) return;

  el.innerHTML = '<div class="outlier-data-loading">Computing outliers...</div>';

  // Run computation asynchronously to avoid blocking UI
  setTimeout(() => {
    // Check if derived data cache is computed
    if (!window.appState.derivedDataCache.computed) {
      if (typeof window.computeAllDerivedData === 'function') {
        window.computeAllDerivedData();
      }
    }

    const records = window.appState.derivedDataCache.records || [];
    const isCompactMode = window.appState.outlierCompactMode || false;
    
    // In compact mode, include all records. In full mode, only show records with outliers.
    const outlierRecords = records
      .filter(r => isCompactMode || (r.outliers && r.outliers.length > 0))
      .map(r => ({
        recordName: r.recordName,
        outliers: r.outliers || []
      }));

    // Sort by number of outliers (most outliers first)
    outlierRecords.sort((a, b) => b.outliers.length - a.outliers.length);
    
    el.innerHTML = '';

    // Header with toggle
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
    
    const headerLeft = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'outlier-data-header';
    header.textContent = 'Outlier Analysis (Top/Bottom 5%)';
    header.style.marginBottom = '4px';
    
    const description = document.createElement('div');
    description.className = 'outlier-data-description';
    description.textContent = 'Shows records in the top or bottom 5% for each metric.';
    
    headerLeft.appendChild(header);
    headerLeft.appendChild(description);
    
    // Toggle button
    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 11px; background: white; padding: 6px 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
    
    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'outlier-compact-mode-checkbox';
    toggleCheckbox.checked = isCompactMode;
    toggleCheckbox.style.cssText = 'cursor: pointer;';
    
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'outlier-compact-mode-checkbox';
    toggleLabel.textContent = 'Compact';
    toggleLabel.style.cssText = 'cursor: pointer; user-select: none; color: #475569; font-weight: 500;';
    
    toggleContainer.appendChild(toggleCheckbox);
    toggleContainer.appendChild(toggleLabel);
    
    headerContainer.appendChild(headerLeft);
    headerContainer.appendChild(toggleContainer);
    el.appendChild(headerContainer);
    
    // Add event listener for toggle
    toggleCheckbox.addEventListener('change', function() {
      window.appState.outlierCompactMode = this.checked;
      renderOutlierData(container);
    });

    if (outlierRecords.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'outlier-data-empty';
      empty.textContent = 'No data available. Please load a dataset first.';
      el.appendChild(empty);
      return;
    }

    // List container
    const list = document.createElement('div');
    list.className = 'outlier-data-list';

    const formatMetricName = typeof window.formatMetricName === 'function' 
      ? window.formatMetricName 
      : (s) => s;

    // Create or get tooltip element for compact mode
    let tooltip = document.getElementById('outlier-data-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'outlier-data-tooltip';
      tooltip.className = 'outlier-data-tooltip hidden';
      document.body.appendChild(tooltip);
    }

    outlierRecords.forEach(({ recordName, outliers }) => {
      const row = document.createElement('div');
      row.className = 'outlier-data-row';

      // Left column: Record name
      const nameCol = document.createElement('div');
      nameCol.className = 'outlier-data-name';
      nameCol.textContent = recordName;

      if (isCompactMode) {
        // Compact mode: show count
        const countCol = document.createElement('div');
        countCol.className = 'outlier-data-count';
        countCol.textContent = outliers.length;
        
        // Add hover functionality to show tooltip (only if there are outliers)
        if (outliers.length > 0) {
          row.addEventListener('mouseenter', function(evt) {
            // Build tooltip content
            const tooltipLines = outliers.map(({ metric, percentile, position }) => {
              return `<div class="outlier-tooltip-item outlier-${position}">${formatMetricName(metric)} ${percentile}%</div>`;
            });
            tooltip.innerHTML = tooltipLines.join('');
            tooltip.classList.remove('hidden');
          });
          
          row.addEventListener('mousemove', function(evt) {
            // Position tooltip near cursor
            tooltip.style.left = (evt.clientX + 15) + 'px';
            tooltip.style.top = (evt.clientY + 15) + 'px';
          });
          
          row.addEventListener('mouseleave', function() {
            tooltip.classList.add('hidden');
          });
        }
        
        row.appendChild(nameCol);
        row.appendChild(countCol);
      } else {
        // Full mode: show all outlier metrics
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
      }
      
      list.appendChild(row);
    });

    el.appendChild(list);
  }, 10);
}

window.renderOutlierData = renderOutlierData;
