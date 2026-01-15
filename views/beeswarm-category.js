/**
 * Beeswarm chart rendering for category sliders
 * Shared across Category Slider, V2, V3 views
 */

// Render beeswarm with axes swapped (value on Y, swarm along X), selected country in colored dot
function renderBeeswarmCategory(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = (container.clientWidth - 20) || 800; // 20px padding adjustment
  const height = container.clientHeight || 400;
  svg.attr('width', width)
     .attr('height', height)
     .style('display', 'block');
  console.log('Beeswarm category width:', width, 'container:', container.clientWidth);

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
  const plotPaddingRight = 70; // Increase right padding to make room for right-side percentile labels
  const plotPaddingTop = 40; // Increased to prevent tooltip cutoff
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  // Store existing circles for transition
  const existingCircles = svg.selectAll('.beeswarm-points circle');
  const isFirstRender = existingCircles.empty();

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
      // optional guide line
      svg.append('line')
        .attr('x1', plotPaddingLeft)
        .attr('x2', width - plotPaddingRight)
        .attr('y1', qy)
        .attr('y2', qy)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
      // label
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

  // Bind data to circles
  const circles = circleGroup.selectAll('circle')
    .data(nodes, d => d.data.label); // Use label as key for object constancy

  // Handle entering circles (new data points)
  const enteringCircles = circles.enter()
    .append('circle')
    .attr('cx', d => {
      // If we have previous positions for this label, start from there
      const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
      return prev ? prev.x : d.x;
    })
    .attr('cy', d => {
      const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
      return prev ? prev.y : d.y;
    })
    .attr('r', d => d.data.label === window.appState.selectedCountry ? d.r + 1.5 : d.r)
    .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#e74c3c' : '#9b59b6'))
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
    .attr('r', d => d.data.label === window.appState.selectedCountry ? d.r + 1.5 : d.r)
    .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#e74c3c' : '#9b59b6'));

  // Store current positions for next transition
  window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

  // Add interaction handlers to all circles
  allCircles
    .on('mouseenter', function(evt, d) {
      const html = `${d.data.label}<br>Value: ${window.formatValue(d.data.value, metricKey)}<br>Percentile: ${d.data.percentile}%`;
      tooltip.html(html)
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px') // 20px right from original +12px
        .style('top', (evt.offsetY - 48) + 'px'); // 20px up from original -28px
      d3.select(this)
        .attr('stroke', '#1f6fa5')
        .attr('stroke-width', 2)
        .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#c0392b' : '#8e44ad'))
        .attr('r', d.r + 2.5);
    })
    .on('mousemove', function(evt) {
      tooltip
        .style('left', (evt.offsetX + 32) + 'px') // 20px right from original +12px
        .style('top', (evt.offsetY - 48) + 'px'); // 20px up from original -28px
    })
    .on('click', function(evt, d) {
      // Click to select region and refresh current Category view
      const newSelection = d.data.label;
      if (!newSelection) return;
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
      // Re-render current metric for the active category view and refresh labels/gradient
      if (window.appState && window.appState.viewMode === 'category' && window.renderCategoryMetricList) {
        window.renderCategoryMetricList();
      } else if (window.appState && window.appState.viewMode === 'category-v2' && window.renderCategoryMetricListV2) {
        window.renderCategoryMetricListV2();
      } else if (window.appState && window.appState.viewMode === 'category-v3' && window.renderCategoryMetricListV3) {
        window.renderCategoryMetricListV3();
      } else if (window.appState && window.appState.viewMode === 'category-v4' && window.renderCategoryMetricListV4) {
        window.renderCategoryMetricListV4();
      } else if (window.appState && window.appState.viewMode === 'category-v5' && window.renderCategoryMetricListV5) {
        window.renderCategoryMetricListV5();
      } else if (window.appState && window.appState.viewMode === 'category-final' && window.renderCategoryMetricListFinal) {
        window.renderCategoryMetricListFinal();
      } else if (window.renderCategoryMetricList) {
        // Fallback to the original Category view if viewMode not set
        window.renderCategoryMetricList();
      }
      if (window.appState.categorySelectedMetricKey) {
        window.renderBeeswarmCategory(window.appState.categorySelectedMetricKey);
      } else if (d && d.data) {
        // Fallback to re-render current metric key if available in scope
        window.renderBeeswarmCategory(metricKey);
      }
    })
    .on('mouseleave', function() {
      tooltip.classed('hidden', true);
      d3.select(this)
        .attr('stroke', 'none')
        .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#e74c3c' : '#9b59b6'))
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
      // Ensure no box styling even if CSS is cached
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
      hoverLabel.style.left = '75px'; // Position on left side near y-axis
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
}

// Export functions
window.renderBeeswarmCategory = renderBeeswarmCategory;

