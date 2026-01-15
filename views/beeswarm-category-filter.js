/**
 * Beeswarm chart for Filter Select view
 * Renders filtered dataset without selection interactions
 */

function renderBeeswarmCategoryFilter(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  filterSelectEnsureState();

  const filteredRows = Array.isArray(window.appState.filterSelectFilteredRows)
    ? window.appState.filterSelectFilteredRows
    : (Array.isArray(window.appState.jsonData) ? window.appState.jsonData : []);

  const allRows = Array.isArray(window.appState.jsonData) ? window.appState.jsonData : [];

  const width = (container.clientWidth - 20) || 800;
  const height = container.clientHeight || 400;
  svg
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  const values = allRows
    .map(row => {
      const raw = row[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || Number.isNaN(v)) return null;
      let label;
      if (window.appState.geoMode === 'country') {
        label = row.Country;
      } else if (window.appState.geoMode === 'county') {
        label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
      } else {
        label = row[window.appState.dataColumn];
      }
      if (!label) return null;
      const isFiltered = filteredRows.includes(row);
      return { label, value: v, highlighted: isFiltered };
    })
    .filter(Boolean);

  svg.selectAll('*').remove();

  if (values.length === 0) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 14)
      .text('No data for this metric with the current filters.');
    window.appState.previousBeeswarmNodes = [];
    return;
  }

  const sortedVals = values.map(v => v.value).slice().sort((a, b) => a - b);
  const extent = d3.extent(sortedVals);
  const plotPaddingLeft = 50;
  const plotPaddingRight = 70;
  const plotPaddingTop = 40;
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

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
  svg.append('g')
    .attr('transform', `translate(${plotPaddingLeft}, 0)`)
    .call(axis)
    .selectAll('text')
    .style('font-size', '10px');

  for (let p = 10; p < 100; p += 10) {
    const qVal = d3.quantileSorted(sortedVals, p / 100);
    if (qVal == null) continue;
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
      .text(`${p}%`);
  }

  const endpoints = [0, 100];
  endpoints.forEach(p => {
    const qVal = d3.quantileSorted(sortedVals, p / 100);
    if (qVal == null) return;
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
      .text(`${p}%`);
  });

  const nodes = values.map(d => ({
    x: xCenter,
    y: y(d.value),
    r: 4.5,
    data: d
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('y', d3.forceY(d => y(d.data.value)).strength(1))
    .force('x', d3.forceX(xCenter).strength(0.05))
    .force('collide', d3.forceCollide(d => d.r + 1.6))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');

  let circleGroup = svg.select('.beeswarm-points');
  if (circleGroup.empty()) {
    circleGroup = svg.append('g').attr('class', 'beeswarm-points');
  }

  const previous = Array.isArray(window.appState.previousBeeswarmNodes)
    ? window.appState.previousBeeswarmNodes
    : [];

  const circles = circleGroup.selectAll('circle')
    .data(nodes, d => d.data.label);

  const entering = circles.enter()
    .append('circle')
    .attr('cx', d => {
      const prev = previous.find(p => p.data && p.data.label === d.data.label);
      return prev ? prev.x : d.x;
    })
    .attr('cy', d => {
      const prev = previous.find(p => p.data && p.data.label === d.data.label);
      return prev ? prev.y : d.y;
    })
    .attr('r', d => d.r)
    .attr('fill', d => d.data.highlighted ? '#ef4444' : '#2563eb')
    .attr('opacity', 0.9);

  circles.exit().remove();

  const allCircles = entering.merge(circles);

  allCircles.transition()
    .duration(600)
    .ease(d3.easeQuadOut)
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => d.r)
    .attr('fill', d => d.data.highlighted ? '#ef4444' : '#2563eb');

  window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

  allCircles
    .on('mouseenter', function(evt, d) {
      const html = `${d.data.label}<br>Value: ${window.formatValue ? window.formatValue(d.data.value, metricKey) : d.data.value}`;
      tooltip.html(html)
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
      d3.select(this)
        .attr('stroke', d.data.highlighted ? '#7f1d1d' : '#0f172a')
        .attr('stroke-width', 2)
        .attr('r', d.r + 2);
    })
    .on('mousemove', function(evt) {
      tooltip
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
    })
    .on('mouseleave', function() {
      tooltip.classed('hidden', true);
      d3.select(this)
        .attr('stroke', 'none')
        .attr('stroke-width', 0)
        .attr('r', d => d.r);
    })
    .on('click', function(evt) {
      evt.stopPropagation();
    });

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
      if (hoverLabel) {
        hoverLabel.classList.remove('hidden');
        hoverLabel.style.background = 'transparent';
        hoverLabel.style.border = 'none';
        hoverLabel.style.padding = '0';
        hoverLabel.style.borderRadius = '0';
        hoverLabel.style.fontWeight = 'normal';
      }
    })
    .on('mousemove', function(evt) {
      if (!hoverLabel) return;
      const [, my] = d3.pointer(evt);
      const clampedY = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, my));
      hoverLine.attr('y1', clampedY).attr('y2', clampedY);
      const hoveredValue = y.invert(clampedY);
      const smaller = sortedVals.filter(v => v < hoveredValue).length;
      const equal = sortedVals.filter(v => v === hoveredValue).length;
      const percentile = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
      hoverLabel.textContent = `Percentile: ${percentile}%`;
      hoverLabel.style.left = '75px';
      hoverLabel.style.top = (clampedY - 6) + 'px';
    })
    .on('mouseleave', function() {
      hoverLine.style('display', 'none');
      if (hoverLabel) hoverLabel.classList.add('hidden');
    })
    .on('click', function(evt) {
      evt.stopPropagation();
    });

  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName ? window.formatMetricName(metricKey) : metricKey);
}

window.renderBeeswarmCategoryFilter = renderBeeswarmCategoryFilter;

