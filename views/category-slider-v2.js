/**
 * Category Slider (Color ramp)
 * Shows metrics with evenly spaced labels (not percentile-based positioning)
 */

// Render metric list with evenly spaced labels (Category Slider - Color ramp)
function renderCategoryMetricListV2() {
  const listEl = document.getElementById('indicator-list');
  if (!listEl) return;
  const metrics = window.getNumericMetrics();
  listEl.innerHTML = '';
  // Ensure currentPercentiles is computed
  if (window.appState.selectedCountry) {
    window.calculatePercentiles(window.appState.selectedCountry);
  }
  const decorated = metrics.map(m => ({
    key: m,
    pct: (window.appState.currentPercentiles[m] && typeof window.appState.currentPercentiles[m].percentile === 'number') ? window.appState.currentPercentiles[m].percentile : -1
  }));
  // Sort descending by percentile; unknowns go to bottom
  decorated.sort((a, b) => b.pct - a.pct);
  // Build slider layout
  const wrapper = document.createElement('div');
  wrapper.className = 'category-slider';
  const labelsCol = document.createElement('div');
  labelsCol.className = 'category-labels';
  const railCol = document.createElement('div');
  railCol.className = 'category-rail';
  const track = document.createElement('div');
  track.className = 'category-rail-track';
  const handle = document.createElement('div');
  handle.className = 'category-handle';
  track.appendChild(handle);
  railCol.appendChild(track);

  decorated.forEach(({ key, pct }) => {
    const item = document.createElement('div');
    item.className = 'category-label';
    item.dataset.metricKey = key;
    item.dataset.percentile = pct >= 0 ? pct : -1;
    
    // Create structured content with right-justified bold percentile
    const metricName = document.createElement('span');
    metricName.textContent = window.formatMetricName(key);
    
    const percentileSpan = document.createElement('span');
    percentileSpan.style.cssText = 'float: right; font-weight: bold; color: #000000;';
    percentileSpan.textContent = pct >= 0 ? `${pct}%` : '';
    
    item.appendChild(metricName);
    item.appendChild(percentileSpan);
    labelsCol.appendChild(item);
  });

  wrapper.appendChild(labelsCol);
  wrapper.appendChild(railCol);
  listEl.appendChild(wrapper);

  // Measure and build snap points after DOM paints
  requestAnimationFrame(() => {
    // Track height equals the visible labels column height
    track.style.height = labelsCol.clientHeight + 'px';

    const labelNodes = Array.from(labelsCol.querySelectorAll('.category-label'));
    
    // Position labels evenly spaced instead of based on percentiles
    const containerHeight = labelsCol.clientHeight;
    const labelCount = labelNodes.length;
    
    // Calculate even spacing
    const totalPadding = 20; // Top and bottom padding
    const availableHeight = containerHeight - totalPadding;
    const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;
    
    // Position labels evenly
    labelNodes.forEach((node, index) => {
      const position = totalPadding / 2 + (index * spacing);
      node.style.top = position + 'px';
    });

    const computeSnapPoints = () => {
      // Use the evenly spaced positions
      window.appState.categorySnapPoints = labelNodes.map(node => {
        return parseFloat(node.style.top) || 0;
      });
    };
    computeSnapPoints();

    // Apply color ramp to slider track based on percentiles
    const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
    const gradient = window.createPercentileGradient(percentiles);
    track.style.background = gradient;

    // Select initial metric
    const defaultIdx = Math.max(0, window.appState.categorySelectedMetricKey ? labelNodes.findIndex(n => n.dataset.metricKey === window.appState.categorySelectedMetricKey) : 0);
    selectCategoryIndexV2(defaultIdx, { render: true });

    // Label click -> snap
    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndexV2(idx, { render: true }));
    });

    // Drag interactions
    let dragging = false;
    const onPointerMove = (evt) => {
      evt.preventDefault(); // avoid page scroll during drag
      if (!dragging) return;
      const trackRect = track.getBoundingClientRect();
      const y = evt.clientY - trackRect.top;
      // Find nearest snap point
      let nearestIdx = 0;
      let minDist = Infinity;
      window.appState.categorySnapPoints.forEach((p, i) => {
        const d = Math.abs(p - y);
        if (d < minDist) { minDist = d; nearestIdx = i; }
      });
      selectCategoryIndexV2(nearestIdx, { render: true });
    };
    const onPointerUp = () => {
      dragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
    handle.addEventListener('pointerdown', (evt) => {
      evt.preventDefault();
      dragging = true;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
    // Clicking on track also snaps
    track.addEventListener('pointerdown', (evt) => {
      const trackRect = track.getBoundingClientRect();
      const y = evt.clientY - trackRect.top;
      let nearestIdx = 0;
      let minDist = Infinity;
      window.appState.categorySnapPoints.forEach((p, i) => {
        const d = Math.abs(p - y);
        if (d < minDist) { minDist = d; nearestIdx = i; }
      });
      selectCategoryIndexV2(nearestIdx, { render: true });
    });

    // Keep rail and handle in sync when the labels list scrolls or resizes
    const updatePositionsAndSnapPoints = () => {
      const newContainerHeight = labelsCol.clientHeight;
      track.style.height = newContainerHeight + 'px';
      
      // Reposition labels evenly
      const totalPadding = 20;
      const availableHeight = newContainerHeight - totalPadding;
      const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;
      
      labelNodes.forEach((node, index) => {
        const position = totalPadding / 2 + (index * spacing);
        node.style.top = position + 'px';
      });
      
      computeSnapPoints();
      
      // Reapply color ramp on resize
      const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
      const gradient = window.createPercentileGradient(percentiles);
      track.style.background = gradient;
      
      const active = listEl.querySelector('.category-label.active');
      if (active) {
        const labels = Array.from(listEl.querySelectorAll('.category-label'));
        const idx = labels.indexOf(active);
        if (idx >= 0 && window.appState.categorySnapPoints[idx] != null) {
          handle.style.top = window.appState.categorySnapPoints[idx] + 'px';
        }
      }
    };

    labelsCol.addEventListener('scroll', updatePositionsAndSnapPoints);
    window.addEventListener('resize', updatePositionsAndSnapPoints);
  });
  
  // Helper to set active, move handle, and render
  function selectCategoryIndexV2(index, opts = {}) {
    const { render = true } = opts;
    const labels = Array.from(listEl.querySelectorAll('.category-label'));
    if (index < 0 || index >= labels.length) return;
    labels.forEach(l => l.classList.remove('active'));
    const selected = labels[index];
    selected.classList.add('active');
    const metricKey = selected.dataset.metricKey;
    window.appState.categorySelectedMetricKey = metricKey;
    // Move handle to snap point
    if (window.appState.categorySnapPoints && window.appState.categorySnapPoints[index] != null) {
      handle.style.top = window.appState.categorySnapPoints[index] + 'px';
    }
    if (render) {
      window.renderBeeswarmCategory(metricKey);
    }
  }
}

// Export functions
window.renderCategoryMetricListV2 = renderCategoryMetricListV2;

