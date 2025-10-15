/**
 * Beeswarm chart rendering for Category Slider V3
 * Uses country codes as text labels with optional continent colors
 */

function renderBeeswarmCategoryV3(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = 800;
  const height = container.clientHeight || 400;
  svg.attr('width', width).attr('height', height).style('width', width + 'px');

  // Check if CountryCode/Continent columns exist
  const hasCountryCode = window.appState.jsonData.length > 0 && window.appState.jsonData[0].hasOwnProperty('CountryCode');
  const hasContinent = window.appState.jsonData.length > 0 && window.appState.jsonData[0].hasOwnProperty('Continent');

  // Ensure V2 dots (circles) do not linger when switching to V3
  svg.selectAll('.beeswarm-points circle').remove();

  const values = window.appState.jsonData
    .map(d => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || isNaN(v)) return null;
      const label = window.appState.geoMode === 'country' ? d.Country : (d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`);
      const countryCode = hasCountryCode ? d.CountryCode : null;
      const continent = hasContinent ? d.Continent : null;
      return { label, value: v, countryCode, continent };
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
  const plotPaddingTop = 10;
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  // Store existing elements for transition
  const existingElements = svg.selectAll('.beeswarm-points circle, .beeswarm-points text');
  const isFirstRender = existingElements.empty();

  // Clear non-data elements but keep data points for transition
  svg.selectAll('*:not(.beeswarm-points):not(.beeswarm-points circle):not(.beeswarm-points text)').remove();
  // Remove any previous continent legend
  svg.selectAll('.continent-legend').remove();
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
    .force('collide', d3.forceCollide(d => d.r + 2.2))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');

  // Continent color map (used only if hasContinent)
  const continentColor = hasContinent ? (c => ({
    'Africa': '#e67e22',
    'Asia': '#f1c40f',
    'Europe': '#2ecc71',
    'North America': '#9b59b6',
    'South America': '#9b59b6',
    'Oceania': '#16a085',
    'Antarctica': '#95a5a6'
  })[c] || '#64748b') : (() => '#9b59b6');

  // Create or update data points group
  let dataGroup = svg.select('.beeswarm-points');
  if (dataGroup.empty()) {
    dataGroup = svg.append('g').attr('class', 'beeswarm-points');
  }

  if (hasCountryCode) {
    // Use text elements instead of circles
    const texts = dataGroup.selectAll('text')
      .data(nodes, d => d.data.label); // Use label as key for object constancy

    // Handle entering text elements (new data points)
    const enteringTexts = texts.enter()
      .append('text')
      .attr('x', d => {
        // If we have previous positions for this label, start from there
        const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
        return prev ? prev.x : d.x;
      })
      .attr('y', d => {
        const prev = window.appState.previousBeeswarmNodes.find(p => p.data.label === d.data.label);
        return prev ? prev.y : d.y;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', d => (d.data.label === window.appState.selectedCountry ? '800' : 'bold'))
      .style('text-decoration', d => (d.data.label === window.appState.selectedCountry ? 'underline' : 'none'))
      .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'))
      .text(d => d.data.countryCode || '?');

    // Handle exiting text elements (data points that are no longer present)
    texts.exit().remove();

    // Merge entering and updating text elements
    const allTexts = enteringTexts.merge(texts);

    // Animate to new positions
    allTexts.transition()
      .duration(600)
      .ease(d3.easeQuadOut)
      .attr('x', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
      .attr('y', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
      .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'))
      .attr('font-weight', d => (d.data.label === window.appState.selectedCountry ? '800' : 'bold'))
      .style('text-decoration', d => (d.data.label === window.appState.selectedCountry ? 'underline' : 'none'));

    // Store current positions for next transition
    window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

    // Add interaction handlers to all text elements
    allTexts
      .on('mouseenter', function(evt, d) {
        const html = `${d.data.label}<br>Value: ${window.formatValue(d.data.value, metricKey)}<br>Percentile: ${d.data.percentile}%`;
        tooltip.html(html)
          .classed('hidden', false)
          .style('left', (evt.offsetX + 32) + 'px') // 20px right from original +12px
          .style('top', (evt.offsetY - 48) + 'px'); // 20px up from original -28px
        d3.select(this)
          .attr('stroke', '#d35400')
          .attr('stroke-width', 1.5)
          .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#d4ac0d' : '#8e44ad'))
          .attr('font-size', '10px');
      })
      .on('mousemove', function(evt) {
        tooltip
          .style('left', (evt.offsetX + 32) + 'px') // 20px right from original +12px
          .style('top', (evt.offsetY - 48) + 'px'); // 20px up from original -28px
      })
      .on('click', function(evt, d) {
        // Click to select region in Category Slider V3
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
        // Re-render current metric in V3 and refresh labels/gradient
        window.renderCategoryMetricListV3();
        if (window.appState.categorySelectedMetricKey) {
          window.renderBeeswarmCategoryV3(window.appState.categorySelectedMetricKey);
        } else if (d && d.data) {
          // Fallback to re-render current metric key if available in scope
          window.renderBeeswarmCategoryV3(metricKey);
        }
      })
      .on('mouseleave', function() {
        tooltip.classed('hidden', true);
        d3.select(this)
          .attr('stroke', 'none')
          .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'))
          .attr('font-size', '8px')
          .attr('font-weight', d => (d.data.label === window.appState.selectedCountry ? '800' : 'bold'))
          .style('text-decoration', d => (d.data.label === window.appState.selectedCountry ? 'underline' : 'none'));
      });

  } else {
    // Fallback to circles if no CountryCode column
    const circles = dataGroup.selectAll('circle')
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
      .attr('r', d => d.r)
      .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'))
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
      .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'));

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
          .attr('stroke', '#d35400')
          .attr('stroke-width', 2)
          .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#d4ac0d' : '#8e44ad'))
          .attr('r', d.r + 2.5);
      })
      .on('mousemove', function(evt) {
        tooltip
          .style('left', (evt.offsetX + 32) + 'px') // 20px right from original +12px
          .style('top', (evt.offsetY - 48) + 'px'); // 20px up from original -28px
      })
      .on('click', function(evt, d) {
        // Click to select region in Category Slider V3
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
        // Re-render current metric in V3 and refresh labels/gradient
        window.renderCategoryMetricListV3();
        if (window.appState.categorySelectedMetricKey) {
          window.renderBeeswarmCategoryV3(window.appState.categorySelectedMetricKey);
        } else if (d && d.data) {
          // Fallback to re-render current metric key if available in scope
          window.renderBeeswarmCategoryV3(metricKey);
        }
      })
      .on('mouseleave', function() {
        tooltip.classed('hidden', true);
        d3.select(this)
          .attr('stroke', 'none')
          .attr('fill', d => hasContinent ? continentColor(d.data.continent) : (d.data.label === window.appState.selectedCountry ? '#f1c40f' : '#9b59b6'))
          .attr('r', d => d.r);
      });
  }

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

  // Add legend if continent data exists
  if (hasContinent) {
    const presentContinents = Array.from(new Set(withPct.map(d => d.continent).filter(Boolean)));
    const legend = svg.append('g').attr('class', 'continent-legend');
    // Place legend inside the plot area near the top-right, leaving room for right axis labels
    const legendX = (width - plotPaddingRight) - 120; // shift ~120px into plot
    let legendY = plotPaddingTop + 12;
    legend.selectAll('g.item')
      .data(presentContinents)
      .enter()
      .append('g')
      .attr('class', 'item')
      .each(function(c, i) {
        const g = d3.select(this);
        g.append('rect')
          .attr('x', legendX)
          .attr('y', legendY + i * 16 - 8)
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', continentColor(c))
          .attr('stroke', '#334155')
          .attr('stroke-width', 0.5);
        g.append('text')
          .attr('x', legendX + 14)
          .attr('y', legendY + i * 16)
          .attr('fill', '#475569')
          .attr('font-size', 10)
          .text(c);
      });
  }

  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));
}

// Export functions
window.renderBeeswarmCategoryV3 = renderBeeswarmCategoryV3;

