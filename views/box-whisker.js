/**
 * Box and Whisker View
 * Shows metrics with box plot visualization
 */

// Render metric list with evenly spaced labels (Box and Whisker view)
function renderCategoryMetricListBox() {
  const listEl = document.getElementById('indicator-list');
  if (!listEl) return;
  const metrics = window.getNumericMetrics();
  listEl.innerHTML = '';
  if (window.appState.selectedCountry) {
    window.calculatePercentiles(window.appState.selectedCountry);
  }
  const decorated = metrics.map(m => ({
    key: m,
    pct: (window.appState.currentPercentiles[m] && typeof window.appState.currentPercentiles[m].percentile === 'number') ? window.appState.currentPercentiles[m].percentile : -1
  }));
  decorated.sort((a, b) => b.pct - a.pct);

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

  requestAnimationFrame(() => {
    track.style.height = labelsCol.clientHeight + 'px';
    const labelNodes = Array.from(labelsCol.querySelectorAll('.category-label'));
    const containerHeight = labelsCol.clientHeight;
    const labelCount = labelNodes.length;
    const totalPadding = 20;
    const availableHeight = containerHeight - totalPadding;
    const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;
    labelNodes.forEach((node, index) => {
      const position = totalPadding / 2 + (index * spacing);
      node.style.top = position + 'px';
    });

    const computeSnapPoints = () => {
      window.appState.categorySnapPoints = labelNodes.map(node => parseFloat(node.style.top) || 0);
    };
    computeSnapPoints();

    const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
    const gradient = window.createPercentileGradient(percentiles);
    track.style.background = gradient;

    const defaultIdx = Math.max(0, window.appState.categorySelectedMetricKey ? labelNodes.findIndex(n => n.dataset.metricKey === window.appState.categorySelectedMetricKey) : 0);
    selectCategoryIndexBox(defaultIdx, { render: true });

    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndexBox(idx, { render: true }));
    });

    // Drag interactions (enable scrolling between indicators)
    let dragging = false;
    const onPointerMove = (evt) => {
      evt.preventDefault();
      if (!dragging) return;
      const trackRect = track.getBoundingClientRect();
      const y = evt.clientY - trackRect.top;
      let nearestIdx = 0;
      let minDist = Infinity;
      window.appState.categorySnapPoints.forEach((p, i) => {
        const d = Math.abs(p - y);
        if (d < minDist) { minDist = d; nearestIdx = i; }
      });
      selectCategoryIndexBox(nearestIdx, { render: true });
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
      selectCategoryIndexBox(nearestIdx, { render: true });
    });

    const updatePositionsAndSnapPoints = () => {
      const newContainerHeight = labelsCol.clientHeight;
      track.style.height = newContainerHeight + 'px';
      const totalPadding = 20;
      const availableHeight = newContainerHeight - totalPadding;
      const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;
      labelNodes.forEach((node, index) => {
        const position = totalPadding / 2 + (index * spacing);
        node.style.top = position + 'px';
      });
      computeSnapPoints();
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

  function selectCategoryIndexBox(index, opts = {}) {
    const { render = true } = opts;
    const labels = Array.from(listEl.querySelectorAll('.category-label'));
    if (index < 0 || index >= labels.length) return;
    labels.forEach(l => l.classList.remove('active'));
    const selected = labels[index];
    selected.classList.add('active');
    const metricKey = selected.dataset.metricKey;
    window.appState.categorySelectedMetricKey = metricKey;
    if (window.appState.categorySnapPoints && window.appState.categorySnapPoints[index] != null) {
      const handle = listEl.querySelector('.category-handle');
      if (handle) handle.style.top = window.appState.categorySnapPoints[index] + 'px';
    }
    if (render) {
      window.renderBoxPlotCategory(metricKey);
    }
  }
}

// Export functions
window.renderCategoryMetricListBox = renderCategoryMetricListBox;

