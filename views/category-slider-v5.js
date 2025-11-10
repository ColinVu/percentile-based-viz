/**
 * Category Slider (Comparison)
 * Shows metrics with evenly spaced labels (not percentile-based positioning)
 */

// Render metric list with evenly spaced labels (Category Slider - Comparison)
function renderCategoryMetricListV5() {
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

  // Calculate comparison percentiles if comparison country is selected
  let comparisonPercentiles = {};
  if (window.appState.comparisonCountry && window.appState.comparisonCountry !== '') {
    // Temporarily calculate percentiles for comparison country
    const tempPercentiles = { ...window.appState.currentPercentiles };
    window.calculatePercentiles(window.appState.comparisonCountry);
    comparisonPercentiles = { ...window.appState.currentPercentiles };
    // Restore main country percentiles
    window.appState.currentPercentiles = tempPercentiles;
  }

  decorated.forEach(({ key, pct }) => {
    const item = document.createElement('div');
    item.className = 'category-label';
    item.dataset.metricKey = key;
    item.dataset.percentile = pct >= 0 ? pct : -1;
    
    // Create structured content with metric name on left
    const metricName = document.createElement('span');
    metricName.textContent = window.formatMetricName(key);
    
    // Create container for percentiles on right
    const percentilesContainer = document.createElement('span');
    percentilesContainer.style.cssText = 'float: right; font-weight: bold;';
    
    // Main location percentile (black)
    const mainPercentileSpan = document.createElement('span');
    mainPercentileSpan.style.cssText = 'color: #000000;';
    mainPercentileSpan.textContent = pct >= 0 ? `${pct}%` : '';
    percentilesContainer.appendChild(mainPercentileSpan);
    
    // Comparison location percentile (color-coded)
    if (window.appState.comparisonCountry && window.appState.comparisonCountry !== '') {
      const compPct = (comparisonPercentiles[key] && typeof comparisonPercentiles[key].percentile === 'number') 
        ? comparisonPercentiles[key].percentile 
        : -1;
      
      if (compPct >= 0) {
        const compPercentileSpan = document.createElement('span');
        const compColor = window.getPercentileColor(compPct);
        compPercentileSpan.style.cssText = `color: ${compColor}; margin-left: 8px;`;
        compPercentileSpan.textContent = `${compPct}%`;
        percentilesContainer.appendChild(compPercentileSpan);
      }
    }
    
    item.appendChild(metricName);
    item.appendChild(percentilesContainer);
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
    selectCategoryIndexV5(defaultIdx, { render: true });

    // Label click -> snap
    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndexV5(idx, { render: true }));
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
      selectCategoryIndexV5(nearestIdx, { render: true });
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
      selectCategoryIndexV5(nearestIdx, { render: true });
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
  function selectCategoryIndexV5(index, opts = {}) {
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
      window.renderBeeswarmCategoryComparison(metricKey);
    }
  }
}

// Render beeswarm with comparison - highlights both main and comparison country
function renderBeeswarmCategoryComparison(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = (container.clientWidth - 20) || 800; // 20px padding adjustment
  const height = container.clientHeight || 400;
  svg.attr('width', width)
     .attr('height', height)
     .style('display', 'block');
  console.log('Beeswarm comparison width:', width, 'container:', container.clientWidth);

  const values = window.appState.jsonData
    .map(d => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || isNaN(v)) return null;
      const label = window.appState.geoMode === 'country' ? d.Country : (d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`);
      return { label, value: v };
    })
    .filter(Boolean);

  if (values.length === 0) {
    svg.selectAll('*').remove();
    window.appState.previousBeeswarmNodes = [];
    return;
  }

  const sortedVals = values.map(v => v.value).slice().sort((a, b) => a - b);
  const withPct = values.map(d => {
    const smaller = sortedVals.filter(v => v < d.value).length;
    const equal = sortedVals.filter(v => v === d.value).length;
    const percentile = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
    return { ...d, percentile };
  });

  const extent = d3.extent(sortedVals);
  const plotPaddingLeft = 50;
  const plotPaddingRight = 70;
  const plotPaddingTop = 40; // Increased to prevent tooltip cutoff
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  // Store existing circles for transition
  const existingCircles = svg.selectAll('.beeswarm-points circle');

  // Clear non-circle elements but keep circles for transition
  svg.selectAll('*:not(.beeswarm-points):not(.beeswarm-points circle)').remove();
  
  // Frame
  svg.append('rect')
    .attr('x', plotPaddingLeft)
    .attr('y', plotPaddingTop)
    .attr('width', (width - plotPaddingRight) - plotPaddingLeft)
    .attr('height', (height - plotPaddingBottom) - plotPaddingTop)
    .attr('fill', 'none')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1);

  const isPercentMetric = /Pct|percent|Percent/.test(metricKey);
  const axis = d3.axisLeft(y).ticks(10).tickFormat(d => isPercentMetric ? `${Math.round(d)}%` : d);
  const axisG = svg.append('g').attr('transform', `translate(${plotPaddingLeft}, 0)`).call(axis);
  axisG.selectAll('text').style('font-size', '10px');

  // Horizontal guides at deciles
  for (let p = 10; p < 100; p += 10) {
    const qVal = d3.quantileSorted(sortedVals, p / 100);
    if (qVal != null) {
      const qy = y(qVal);
      svg.append('line')
        .attr('x1', plotPaddingLeft)
        .attr('x2', width - plotPaddingRight)
        .attr('y1', qy)
        .attr('y2', qy)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
      // Right-side percentile labels every 10%
      svg.append('text')
        .attr('x', width - plotPaddingRight + 6)
        .attr('y', qy + 3)
        .attr('fill', '#475569')
        .attr('font-size', 10)
        .text(`${p}%`);
    }
  }

  // Also include 0% and 100% labels (and guides)
  const endpoints = [0, 100];
  endpoints.forEach(P => {
    const qVal = d3.quantileSorted(sortedVals, P / 100);
    if (qVal != null) {
      const qy = y(qVal);
      svg.append('line')
        .attr('x1', plotPaddingLeft)
        .attr('x2', width - plotPaddingRight)
        .attr('y1', qy)
        .attr('y2', qy)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
      svg.append('text')
        .attr('x', width - plotPaddingRight + 6)
        .attr('y', qy + 3)
        .attr('fill', '#475569')
        .attr('font-size', 10)
        .text(`${P}%`);
    }
  });

  const nodes = withPct.map(d => ({
    x: xCenter,
    y: y(d.value),
    r: 4.5,
    data: d
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('y', d3.forceY(d => y(d.data.value)).strength(1))
    .force('x', d3.forceX(xCenter).strength(0.05))
    .force('collide', d3.forceCollide(d => d.r + 1.2))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');

  // Create or update circles with smooth transitions
  let circleGroup = svg.select('.beeswarm-points');
  if (circleGroup.empty()) {
    circleGroup = svg.append('g').attr('class', 'beeswarm-points');
  }

  // Helper function to determine color for each node
  function getNodeColor(label) {
    if (label === window.appState.selectedCountry) {
      return '#e74c3c'; // Red for main country
    } else if (label === window.appState.comparisonCountry && window.appState.comparisonCountry !== '') {
      return '#3498db'; // Blue for comparison country
    } else {
      return '#9b59b6'; // Purple for others
    }
  }

  // Helper function to determine radius for each node
  function getNodeRadius(label, baseRadius) {
    if (label === window.appState.selectedCountry || (label === window.appState.comparisonCountry && window.appState.comparisonCountry !== '')) {
      return baseRadius + 1.5; // Larger for selected countries
    }
    return baseRadius;
  }

  // Bind data to circles
  const circles = circleGroup.selectAll('circle')
    .data(nodes, d => d.data.label); // Use label as key for object constancy

  // Handle entering circles (new data points)
  const enteringCircles = circles.enter()
    .append('circle')
    .attr('cx', d => {
      const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
      return prev ? prev.x : d.x;
    })
    .attr('cy', d => {
      const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
      return prev ? prev.y : d.y;
    })
    .attr('r', d => getNodeRadius(d.data.label, d.r))
    .attr('fill', d => getNodeColor(d.data.label))
    .attr('opacity', 0.85);

  // Handle exiting circles (data points that are no longer present)
  circles.exit().remove();

  // Merge entering and updating circles
  const allCircles = enteringCircles.merge(circles);

  // Animate to new positions
  allCircles.transition()
    .duration(600)
    .ease(d3.easeQuadOut)
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => getNodeRadius(d.data.label, d.r))
    .attr('fill', d => getNodeColor(d.data.label));

  // Store current positions for next transition
  window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

  // Add interaction handlers to all circles
  allCircles
    .on('mouseenter', function(evt, d) {
      const html = `${d.data.label}<br>Value: ${window.formatValue(d.data.value, metricKey)}<br>Percentile: ${d.data.percentile}%`;
      tooltip.html(html)
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
      d3.select(this)
        .attr('stroke', '#1f6fa5')
        .attr('stroke-width', 2)
        .attr('fill', d => {
          if (d.data.label === window.appState.selectedCountry) return '#c0392b';
          if (d.data.label === window.appState.comparisonCountry && window.appState.comparisonCountry !== '') return '#2980b9';
          return '#8e44ad';
        })
        .attr('r', d.r + 2.5);
    })
    .on('mousemove', function(evt) {
      tooltip
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
    })
    .on('click', function(evt, d) {
      // Click to select region based on active radio button selection
      const newSelection = d.data.label;
      if (!newSelection) return;
      
      // Determine which location to update based on radio button selection
      const activeSelection = window.appState.activeLocationSelection || 'main';
      
      if (activeSelection === 'main') {
        // Update main location
        window.appState.selectedCountry = newSelection;
        // Sync the dropdown if option exists
        const selectEl = document.getElementById('countrySelect');
        if (selectEl) {
          const exists = Array.from(selectEl.options).some(o => o.value === newSelection);
          if (exists) selectEl.value = newSelection;
        }
        // Recompute and update UI
        window.calculatePercentiles(window.appState.selectedCountry);
        window.updateCountryInfo();
      } else if (activeSelection === 'comparison') {
        // Update comparison location
        window.appState.comparisonCountry = newSelection;
        // Sync the comparison dropdown if option exists
        const comparisonSelectEl = document.getElementById('comparisonCountrySelect');
        if (comparisonSelectEl) {
          const exists = Array.from(comparisonSelectEl.options).some(o => o.value === newSelection);
          if (exists) comparisonSelectEl.value = newSelection;
        }
      }
      
      // Re-render for comparison view
      window.renderCategoryMetricListV5();
      if (window.appState.categorySelectedMetricKey) {
        window.renderBeeswarmCategoryComparison(window.appState.categorySelectedMetricKey);
      }
    })
    .on('mouseleave', function() {
      tooltip.classed('hidden', true);
      d3.select(this)
        .attr('stroke', 'none')
        .attr('fill', d => getNodeColor(d.data.label))
        .attr('r', d => d.r);
    });

  // Hover horizontal line and percentile label
  const hoverLine = svg.append('line')
    .attr('class', 'hover-line')
    .attr('x1', plotPaddingLeft)
    .attr('x2', width - plotPaddingRight)
    .attr('stroke', '#9aa5b1')
    .attr('stroke-dasharray', '4 4')
    .style('display', 'none');

  const hoverLabel = document.getElementById('beeswarm-hover-label');

  svg
    .on('mouseenter', function() {
      hoverLine.style('display', null);
      hoverLabel.classList.remove('hidden');
      hoverLabel.style.background = 'transparent';
      hoverLabel.style.border = 'none';
      hoverLabel.style.padding = '0';
      hoverLabel.style.borderRadius = '0';
      hoverLabel.style.fontWeight = 'normal';
    })
    .on('mousemove', function(evt) {
      const [, my] = d3.pointer(evt);
      const clampedY = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, my));
      hoverLine.attr('y1', clampedY).attr('y2', clampedY);
      const hoveredValue = y.invert(clampedY);
      const smaller = sortedVals.filter(v => v < hoveredValue).length;
      const equal = sortedVals.filter(v => v === hoveredValue).length;
      const p = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
      hoverLabel.textContent = `Percentile: ${p}%`;
      hoverLabel.style.left = '75px';
      hoverLabel.style.top = (clampedY - 6) + 'px';
    })
    .on('mouseleave', function() {
      hoverLine.style('display', 'none');
      hoverLabel.classList.add('hidden');
    });

  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));

  // Add legend for comparison view
  const legendX = width - plotPaddingRight - 10;
  const legendY = plotPaddingTop + 10;
  const legendSpacing = 20;

  // Main location legend
  const mainLegend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`);
  mainLegend.append('circle')
    .attr('cx', -10)
    .attr('cy', 0)
    .attr('r', 5)
    .attr('fill', '#e74c3c');
  mainLegend.append('text')
    .attr('x', -20)
    .attr('y', 4)
    .attr('text-anchor', 'end')
    .attr('font-size', 11)
    .attr('fill', '#2c3e50')
    .text('Main location');

  // Comparison location legend (only if comparison is selected)
  if (window.appState.comparisonCountry && window.appState.comparisonCountry !== '') {
    const compLegend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY + legendSpacing})`);
    compLegend.append('circle')
      .attr('cx', -10)
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', '#3498db');
    compLegend.append('text')
      .attr('x', -20)
      .attr('y', 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', '#2c3e50')
      .text('Comparison');
  }
}

// Export functions
window.renderCategoryMetricListV5 = renderCategoryMetricListV5;
window.renderBeeswarmCategoryComparison = renderBeeswarmCategoryComparison;


