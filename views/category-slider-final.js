/**
 * Category Slider (Final View)
 * Shows metrics with toggle between evenly-spaced and distributed positioning
 */

function renderCategoryMetricListFinal() {
  const listEl = document.getElementById('indicator-list');
  if (!listEl) return;
  // Exclude FIPS code metrics (handle variants: "FIPS_Code", "F I P S Code", "FIPS Code", etc.)
  const metrics = window.getNumericMetrics().filter(m => {
    const norm = (m || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm !== 'fipscode';
  });
  listEl.innerHTML = '';

  if (window.appState.selectedCountry) {
    window.calculatePercentiles(window.appState.selectedCountry);
  }

  const decorated = metrics.map(m => ({
    key: m,
    pct: (window.appState.currentPercentiles[m] && typeof window.appState.currentPercentiles[m].percentile === 'number')
      ? window.appState.currentPercentiles[m].percentile
      : -1
  }));

  decorated.sort((a, b) => b.pct - a.pct);

  const wrapper = document.createElement('div');
  wrapper.className = 'category-slider';
  wrapper.style.position = 'relative';
  
  const labelsCol = document.createElement('div');
  labelsCol.className = 'category-labels';
  labelsCol.style.paddingTop = '28px'; // Make space for the fixed header (reduced for compact display)
  
  const railCol = document.createElement('div');
  railCol.className = 'category-rail';
  railCol.style.paddingTop = '28px'; // Match the padding of labelsCol
  
  const track = document.createElement('div');
  track.className = 'category-rail-track';
  const handle = document.createElement('div');
  handle.className = 'category-handle';
  track.appendChild(handle);
  railCol.appendChild(track);

  // Create checkbox toggle in bottom right corner
  const checkboxContainer = document.createElement('div');
  checkboxContainer.style.cssText = 'position: absolute; bottom: 10px; right: 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; z-index: 100; background: white; padding: 6px 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'distributed-mode-checkbox';
  checkbox.checked = window.appState.finalViewDistributedMode || false;
  checkbox.style.cssText = 'cursor: pointer;';
  
  const checkboxLabel = document.createElement('label');
  checkboxLabel.htmlFor = 'distributed-mode-checkbox';
  checkboxLabel.textContent = 'Distributed';
  checkboxLabel.style.cssText = 'cursor: pointer; user-select: none; color: #475569;';
  
  checkboxContainer.appendChild(checkbox);
  checkboxContainer.appendChild(checkboxLabel);

  // Add header row (fixed position at top)
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; padding: 6px 8px; font-weight: bold; font-size: 10px; color: #475569; border-bottom: 1px solid #e2e8f0; background: #f8fafc; z-index: 10;';
  
  const metricHeader = document.createElement('span');
  const metricLabel = window.appState.selectedCountry
    ? `Metrics for ${window.appState.selectedCountry}`
    : 'Metric';
  metricHeader.textContent = metricLabel.length > 40 ? metricLabel.slice(0, 40) + '...' : metricLabel;
  
  const percentileHeader = document.createElement('span');
  percentileHeader.textContent = 'Percentile/100%';
  
  headerRow.appendChild(metricHeader);
  headerRow.appendChild(percentileHeader);
  wrapper.appendChild(headerRow); // Add to wrapper instead of labelsCol

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
  wrapper.appendChild(checkboxContainer);
  listEl.appendChild(wrapper);

  // Function to apply evenly-spaced positioning (like V6/encoded)
  function applyEvenSpacing(labelNodes, containerHeight) {
    const headerOffset = 28; // Offset for header
    const labelCount = labelNodes.length;
    const totalPadding = 20;
    const availableHeight = containerHeight - totalPadding;
    const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;

    labelNodes.forEach((node, index) => {
      const position = totalPadding / 2 + (index * spacing) + headerOffset;
      node.style.top = position + 'px';
    });

    // Color gradient disabled - using grey instead
    // To re-enable color, uncomment the following 2 lines and comment out the grey line:
    // const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
    // const gradient = window.createPercentileGradient(percentiles);
    // track.style.background = gradient;
    track.style.background = '#cbd5e1';
  }

  // Function to apply distributed/percentile-based positioning (like original category-slider.js)
  function applyDistributedSpacing(labelNodes, containerHeight) {
    const headerOffset = 28; // Offset for header
    const minLabelHeight = 7; // Reduced for more compact display
    const labelPadding = 1.5;
    const minSpacing = minLabelHeight + labelPadding;

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

    labelData.sort((a, b) => b.percentile - a.percentile);

    // Apply buffering algorithm to prevent overlaps
    for (let i = 1; i < labelData.length; i++) {
      const current = labelData[i];
      const above = labelData[i - 1];
      if (current.actualPosition < above.actualPosition + minSpacing) {
        current.actualPosition = above.actualPosition + minSpacing;
      }
    }

    // Handle bottom crowding
    const maxPosition = containerHeight - minLabelHeight;
    const overflowLabels = labelData.filter(data => data.actualPosition > maxPosition);

    if (overflowLabels.length > 0) {
      const firstOverflowIndex = labelData.findIndex(data => data.actualPosition > maxPosition);
      const labelsToRedistribute = labelData.slice(firstOverflowIndex);

      if (labelsToRedistribute.length > 0) {
        const startPosition = firstOverflowIndex > 0 ? labelData[firstOverflowIndex - 1].actualPosition + minSpacing : 0;
        const availableSpace = maxPosition - startPosition;
        const neededSpace = (labelsToRedistribute.length - 1) * minSpacing;

        if (availableSpace >= neededSpace) {
          labelsToRedistribute.forEach((data, i) => {
            data.actualPosition = startPosition + (i * minSpacing);
          });
        } else {
          labelsToRedistribute.forEach((data, i) => {
            data.actualPosition = Math.min(startPosition + (i * minSpacing), maxPosition);
          });
        }
      }
    }

    labelData.forEach(data => {
      data.node.style.top = (data.actualPosition + headerOffset) + 'px';
    });

    // Remove gradient for distributed mode
    track.style.background = '#cbd5e1';
  }

  requestAnimationFrame(() => {
    // Account for header padding when setting track height
    const headerPadding = 28;
    track.style.height = (labelsCol.clientHeight - headerPadding) + 'px';

    const labelNodes = Array.from(labelsCol.querySelectorAll('.category-label'));
    const containerHeight = labelsCol.clientHeight - headerPadding;

    const computeSnapPoints = () => {
      window.appState.categorySnapPoints = labelNodes.map(node => parseFloat(node.style.top) || 0);
    };

    const applyPositioning = () => {
      const useDistributed = checkbox.checked;
      window.appState.finalViewDistributedMode = useDistributed;

      if (useDistributed) {
        applyDistributedSpacing(labelNodes, containerHeight);
      } else {
        applyEvenSpacing(labelNodes, containerHeight);
      }

      computeSnapPoints();

      // Update handle position
      const active = listEl.querySelector('.category-label.active');
      if (active) {
        const labels = Array.from(listEl.querySelectorAll('.category-label'));
        const idx = labels.indexOf(active);
        if (idx >= 0 && window.appState.categorySnapPoints[idx] != null) {
          // Subtract header offset since handle is positioned relative to track
          const headerOffset = 28;
          handle.style.top = (window.appState.categorySnapPoints[idx] - headerOffset) + 'px';
        }
      }
    };

    // Initial positioning
    applyPositioning();

    // Select initial metric
    const defaultIdx = Math.max(
      0,
      window.appState.categorySelectedMetricKey
        ? labelNodes.findIndex(n => n.dataset.metricKey === window.appState.categorySelectedMetricKey)
        : 0
    );
    selectCategoryIndexFinal(defaultIdx, { render: true });

    // Label click -> snap
    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndexFinal(idx, { render: true }));
    });

    // Checkbox change handler
    checkbox.addEventListener('change', () => {
      applyPositioning();
    });

    // Drag interactions
    let dragging = false;
    const headerOffset = 28;
    const onPointerMove = (evt) => {
      evt.preventDefault();
      if (!dragging) return;
      const trackRect = track.getBoundingClientRect();
      // Add header offset to mouse position to match snap point coordinate system
      const y = evt.clientY - trackRect.top + headerOffset;
      let nearestIdx = 0;
      let minDist = Infinity;
      window.appState.categorySnapPoints.forEach((p, i) => {
        const d = Math.abs(p - y);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      });
      selectCategoryIndexFinal(nearestIdx, { render: true });
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
    track.addEventListener('pointerdown', (evt) => {
      const trackRect = track.getBoundingClientRect();
      // Add header offset to mouse position to match snap point coordinate system
      const y = evt.clientY - trackRect.top + headerOffset;
      let nearestIdx = 0;
      let minDist = Infinity;
      window.appState.categorySnapPoints.forEach((p, i) => {
        const d = Math.abs(p - y);
        if (d < minDist) {
          minDist = d;
          nearestIdx = i;
        }
      });
      selectCategoryIndexFinal(nearestIdx, { render: true });
    });

    const updatePositionsAndSnapPoints = () => {
      const headerPadding = 28;
      const newContainerHeight = labelsCol.clientHeight - headerPadding;
      track.style.height = newContainerHeight + 'px';
      const useDistributed = checkbox.checked;

      if (useDistributed) {
        // Distributed mode with advanced buffering
        const minLabelHeight = 5; // Reduced for more compact display
        const labelPadding = 1.5;
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

        const maxPosition = newContainerHeight - minLabelHeight;
        const minPosition = 0;

        labelData.forEach(d => {
          d.actualPosition = Math.max(minPosition, Math.min(d.actualPosition, maxPosition));
        });
        for (let i = 1; i < labelData.length; i++) {
          const prev = labelData[i - 1];
          const cur = labelData[i];
          const minPos = prev.actualPosition + minSpacing;
          if (cur.actualPosition < minPos) cur.actualPosition = minPos;
        }
        for (let i = labelData.length - 2; i >= 0; i--) {
          const next = labelData[i + 1];
          const cur = labelData[i];
          const maxPos = next.actualPosition - minSpacing;
          if (cur.actualPosition > maxPos) cur.actualPosition = maxPos;
        }

        // Shift block if overflowing
        const bottomOverflow = labelData[labelData.length - 1].actualPosition - maxPosition;
        const topUnderflow = minPosition - labelData[0].actualPosition;
        let blockShift = 0;
        if (bottomOverflow > 0) blockShift -= bottomOverflow;
        if (topUnderflow > 0) blockShift += topUnderflow;
        if (Math.abs(blockShift) > 0.1) {
          labelData.forEach(d => {
            d.actualPosition = Math.max(minPosition, Math.min(maxPosition, d.actualPosition + blockShift));
          });
        }

        // Gentle recenter
        const span = labelData[labelData.length - 1].actualPosition - labelData[0].actualPosition;
        if (span < maxPosition - minPosition) {
          const desiredStart = (maxPosition - span) / 2;
          const shift = desiredStart - labelData[0].actualPosition;
          if (isFinite(shift) && Math.abs(shift) > 0.1) {
            labelData.forEach(d => {
              d.actualPosition = Math.max(minPosition, Math.min(maxPosition, d.actualPosition + shift));
            });
          }
        }

        labelData.forEach(data => {
          data.node.style.top = (data.actualPosition + headerPadding) + 'px';
        });

        track.style.background = '#cbd5e1';
      } else {
        // Even spacing mode
        const labelCount = labelNodes.length;
        const totalPadding = 20;
        const availableHeight = newContainerHeight - totalPadding;
        const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;

        labelNodes.forEach((node, index) => {
          const position = totalPadding / 2 + (index * spacing) + headerPadding;
          node.style.top = position + 'px';
        });

        // Color gradient disabled - using grey instead
        // To re-enable color, uncomment the following 2 lines and comment out the grey line:
        // const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
        // const gradient = window.createPercentileGradient(percentiles);
        // track.style.background = gradient;
        track.style.background = '#cbd5e1';
      }

      computeSnapPoints();

      const active = listEl.querySelector('.category-label.active');
      if (active) {
        const labels = Array.from(listEl.querySelectorAll('.category-label'));
        const idx = labels.indexOf(active);
        if (idx >= 0 && window.appState.categorySnapPoints[idx] != null) {
          // Subtract header offset since handle is positioned relative to track
          const headerOffset = 28;
          handle.style.top = (window.appState.categorySnapPoints[idx] - headerOffset) + 'px';
        }
      }
    };

    labelsCol.addEventListener('scroll', updatePositionsAndSnapPoints);
    window.addEventListener('resize', updatePositionsAndSnapPoints);
  });

  function selectCategoryIndexFinal(index, opts = {}) {
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
      if (handle) {
        // Subtract header offset since handle is positioned relative to track
        const headerOffset = 28;
        handle.style.top = (window.appState.categorySnapPoints[index] - headerOffset) + 'px';
      }
    }
    if (render && typeof window.renderBeeswarmCategoryFinal === 'function') {
      window.renderBeeswarmCategoryFinal(metricKey);
    }
  }
}

window.renderCategoryMetricListFinal = renderCategoryMetricListFinal;


