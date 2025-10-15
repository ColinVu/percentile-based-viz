/**
 * Category Slider View
 * Shows metrics sorted by percentile with a vertical slider
 */

// Render metric list sorted by selected country's percentile and display that percentile
function renderCategoryMetricList() {
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
    const pctText = pct >= 0 ? ` — ${pct}%` : '';
    item.textContent = `${window.formatMetricName(key)}${pctText}`;
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
    
    // Position labels based on percentile values with buffering to prevent overlaps
    const containerHeight = labelsCol.clientHeight;
    const minLabelHeight = 9; // Minimum space needed for each label
    const labelPadding = 2; // Additional padding between labels
    const minSpacing = minLabelHeight + labelPadding;
    
    // Create array of label data with initial positions
    const labelData = labelNodes.map(node => {
      const percentile = parseFloat(node.dataset.percentile);
      const idealPosition = percentile >= 0 
        ? containerHeight * (1 - percentile / 100)
        : containerHeight - 20;
      return {
        node,
        percentile,
        idealPosition,
        actualPosition: idealPosition
      };
    });
    
    // Sort by percentile (descending) to maintain order from top to bottom
    labelData.sort((a, b) => b.percentile - a.percentile);
    
    // Apply buffering algorithm to prevent overlaps with bottom crowding handling
    for (let i = 1; i < labelData.length; i++) {
      const current = labelData[i];
      const above = labelData[i - 1];
      
      // If current label would overlap with the one above, push it down
      if (current.actualPosition < above.actualPosition + minSpacing) {
        current.actualPosition = above.actualPosition + minSpacing;
      }
    }
    
    // Handle bottom crowding by redistributing labels that would go beyond bounds
    const maxPosition = containerHeight - minLabelHeight;
    const overflowLabels = labelData.filter(data => data.actualPosition > maxPosition);
    
    if (overflowLabels.length > 0) {
      // Find the first label that starts the overflow
      const firstOverflowIndex = labelData.findIndex(data => data.actualPosition > maxPosition);
      const labelsToRedistribute = labelData.slice(firstOverflowIndex);
      
      if (labelsToRedistribute.length > 0) {
        // Calculate available space for redistribution
        const startPosition = firstOverflowIndex > 0 ? labelData[firstOverflowIndex - 1].actualPosition + minSpacing : 0;
        const availableSpace = maxPosition - startPosition;
        const neededSpace = (labelsToRedistribute.length - 1) * minSpacing;
        
        if (availableSpace >= neededSpace) {
          // Redistribute evenly in available space
          labelsToRedistribute.forEach((data, i) => {
            data.actualPosition = startPosition + (i * minSpacing);
          });
        } else {
          // Not enough space - use minimum spacing and clamp to bounds
          labelsToRedistribute.forEach((data, i) => {
            data.actualPosition = Math.min(startPosition + (i * minSpacing), maxPosition);
          });
        }
      }
    }
    
    // Final bounds check
    labelData.forEach(data => {
      data.actualPosition = Math.max(0, Math.min(data.actualPosition, maxPosition));
    });
    
    // Apply the calculated positions
    labelData.forEach(data => {
      data.node.style.top = data.actualPosition + 'px';
    });

    const computeSnapPoints = () => {
      // Use the actual positions from the DOM since we've applied buffering
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
    selectCategoryIndex(defaultIdx, { render: true });

    // Label click -> snap
    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndex(idx, { render: true }));
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
      selectCategoryIndex(nearestIdx, { render: true });
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
      selectCategoryIndex(nearestIdx, { render: true });
    });

    // Keep rail and handle in sync when the labels list scrolls or resizes
    const updatePositionsAndSnapPoints = () => {
      const newContainerHeight = labelsCol.clientHeight;
      track.style.height = newContainerHeight + 'px';
      
      // Reposition labels with buffering logic
      const minLabelHeight = 6;
      const labelPadding = 2;
      const minSpacing = minLabelHeight + labelPadding;
      
      const labelData = labelNodes.map(node => {
        const percentile = parseFloat(node.dataset.percentile);
        const idealPosition = percentile >= 0 
          ? newContainerHeight * (1 - percentile / 100)
          : newContainerHeight - 20;
        return {
          node,
          percentile,
          idealPosition,
          actualPosition: idealPosition
        };
      });
      
      labelData.sort((a, b) => b.percentile - a.percentile);
      
      // Apply buffering algorithm to prevent overlaps with bottom crowding handling
      for (let i = 1; i < labelData.length; i++) {
        const current = labelData[i];
        const above = labelData[i - 1];
        
        if (current.actualPosition < above.actualPosition + minSpacing) {
          current.actualPosition = above.actualPosition + minSpacing;
        }
      }
      
      // Handle bottom crowding by redistributing labels that would go beyond bounds
      const maxPosition = newContainerHeight - minLabelHeight;
      const overflowLabels = labelData.filter(data => data.actualPosition > maxPosition);
      
      if (overflowLabels.length > 0) {
        // Find the first label that starts the overflow
        const firstOverflowIndex = labelData.findIndex(data => data.actualPosition > maxPosition);
        const labelsToRedistribute = labelData.slice(firstOverflowIndex);
        
        if (labelsToRedistribute.length > 0) {
          // Calculate available space for redistribution
          const startPosition = firstOverflowIndex > 0 ? labelData[firstOverflowIndex - 1].actualPosition + minSpacing : 0;
          const availableSpace = maxPosition - startPosition;
          const neededSpace = (labelsToRedistribute.length - 1) * minSpacing;
          
          if (availableSpace >= neededSpace) {
            // Redistribute evenly in available space
            labelsToRedistribute.forEach((data, i) => {
              data.actualPosition = startPosition + (i * minSpacing);
            });
          } else {
            // Not enough space - use minimum spacing and clamp to bounds
            labelsToRedistribute.forEach((data, i) => {
              data.actualPosition = Math.min(startPosition + (i * minSpacing), maxPosition);
            });
          }
        }
      }
      
      // Apply positions with final bounds check
      labelData.forEach(data => {
        data.actualPosition = Math.max(0, Math.min(data.actualPosition, maxPosition));
        data.node.style.top = data.actualPosition + 'px';
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
  function selectCategoryIndex(index, opts = {}) {
    const { render = true } = opts;
    const labels = Array.from(listEl.querySelectorAll('.category-label'));
    if (index < 0 || index >= labels.length) return;
    labels.forEach(l => l.classList.remove('active'));
    const selected = labels[index];
    selected.classList.add('active');
    // Scroll behavior not needed with absolute positioning based on percentiles
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
window.renderCategoryMetricList = renderCategoryMetricList;

