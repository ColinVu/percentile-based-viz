/**
 * Horizontal View
 * Shows beeswarm plot with horizontal value axis
 */

function renderIdentifierMetricList() {
  const listEl = document.getElementById('indicator-list');
  if (!listEl) return;
  const metrics = window.getNumericMetrics();
  listEl.innerHTML = '';
  metrics.forEach(metricKey => {
    const btn = document.createElement('button');
    btn.className = 'indicator-item';
    btn.textContent = window.formatMetricName(metricKey);
    btn.dataset.metricKey = metricKey;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.indicator-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBeeswarm(metricKey);
    });
    listEl.appendChild(btn);
  });
}

// Render beeswarm chart for selected metric
function renderBeeswarm(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  // Use container width to make responsive (subtract padding)
  const width = (container.clientWidth - 20) || 800; // 20px padding adjustment
  const height = container.clientHeight*0.9 || 400;
  svg.attr('width', width)
     .attr('height', height)
     .style('display', 'block');
  console.log('Horizontal view width:', width, 'container:', container.clientWidth);

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
    return;
  }

  const sortedVals = values.map(v => v.value).slice().sort((a, b) => a - b);
  const withPct = values.map(d => {
    const smaller = sortedVals.filter(v => v < d.value).length;
    const equal = sortedVals.filter(v => v === d.value).length;
    const percentile = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
    return { ...d, percentile };
  });

  // X scale over raw values (not percentile)
  const extent = d3.extent(sortedVals);
  const plotPaddingLeft = 40;
  const plotPaddingRight = 20;
  const plotPaddingTop = 10;
  const plotPaddingBottom = 35;
  const x = d3.scaleLinear().domain(extent).nice().range([plotPaddingLeft, width - plotPaddingRight]);
  const yCenter = height / 2;

  svg.selectAll('*').remove();
  // Frame around plot
  svg.append('rect')
    .attr('x', plotPaddingLeft)
    .attr('y', plotPaddingTop)
    .attr('width', (width - plotPaddingRight) - plotPaddingLeft)
    .attr('height', (height - plotPaddingBottom) - plotPaddingTop)
    .attr('fill', 'none')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1);

  // Setup axis
  const isPercentMetric = /Pct|percent|Percent/.test(metricKey);
  const axis = d3.axisBottom(x).ticks(10).tickFormat(d => isPercentMetric ? `${Math.round(d)}%` : d);
  const axisG = svg.append('g').attr('transform', `translate(0, ${height - 30})`).call(axis);
  axisG.selectAll('text').style('font-size', '10px');

  // Vertical guides at each 10th percentile (10..90)
  for (let p = 10; p < 100; p += 10) {
    const qVal = d3.quantileSorted(sortedVals, p / 100);
    if (qVal != null) {
      const qx = x(qVal);
      svg.append('line')
        .attr('x1', qx)
        .attr('x2', qx)
        .attr('y1', plotPaddingTop)
        .attr('y2', height - plotPaddingBottom)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    }
  }

  const nodes = withPct.map(d => ({
    x: x(d.value),
    y: yCenter,
    r: 4.5,
    data: d
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('x', d3.forceX(d => x(d.data.value)).strength(1))
    .force('y', d3.forceY(yCenter).strength(0.05))
    .force('collide', d3.forceCollide(d => d.r + 1.2))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  // Clamp node positions to stay within frame
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');

  svg.append('g')
    .attr('class', 'beeswarm-points')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => d.data.label === window.appState.selectedCountry ? d.r + 1.5 : d.r)
    .attr('fill', d => {
      const label = d.data.label;
      return label === window.appState.selectedCountry ? '#e74c3c' : '#3498db';
    })
    .attr('opacity', 0.85)
    .on('mouseenter', function(evt, d) {
      const html = `${d.data.label}<br>Value: ${window.formatValue(d.data.value, metricKey)}<br>Percentile: ${d.data.percentile}%`;
      tooltip.html(html)
        .classed('hidden', false)
        .style('top', (evt.offsetY - 28) + 'px');
      const tipWidth = tooltip.node() ? tooltip.node().offsetWidth : 0;
      const leftPos = Math.max(0, (evt.offsetX - tipWidth - 12));
      tooltip.style('left', leftPos + 'px');
      d3.select(this)
        .attr('stroke', '#1f6fa5')
        .attr('stroke-width', 2)
        .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#c0392b' : '#2d86c7'))
        .attr('r', d.r + 2.5);
    })
    .on('mousemove', function(evt) {
      const tipWidth = tooltip.node() ? tooltip.node().offsetWidth : 0;
      const leftPos = Math.max(0, (evt.offsetX - tipWidth - 12));
      tooltip.style('left', leftPos + 'px')
             .style('top', (evt.offsetY - 28) + 'px');
    })
    .on('mouseleave', function() {
      tooltip.classed('hidden', true);
      d3.select(this)
        .attr('stroke', 'none')
        .attr('fill', d => (d.data.label === window.appState.selectedCountry ? '#e74c3c' : '#3498db'))
        .attr('r', d => d.r);
    });

  // Hover vertical line and percentile label
  const hoverLine = svg.append('line')
    .attr('class', 'hover-line')
    .attr('y1', plotPaddingTop)
    .attr('y2', height - plotPaddingBottom)
    .attr('stroke', '#9aa5b1')
    .attr('stroke-dasharray', '4 4')
    .style('display', 'none');

  const hoverLabel = document.getElementById('beeswarm-hover-label');

  // Use SVG-level listeners so points can still receive events
  svg
    .on('mouseenter', function() {
      hoverLine.style('display', null);
      hoverLabel.classList.remove('hidden');
    })
    .on('mousemove', function(evt) {
      const [mx] = d3.pointer(evt);
      const clampedX = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, mx));
      hoverLine.attr('x1', clampedX).attr('x2', clampedX);
      const hoveredValue = x.invert(clampedX);
      // compute percentile at cursor
      const smaller = sortedVals.filter(v => v < hoveredValue).length;
      const equal = sortedVals.filter(v => v === hoveredValue).length;
      const p = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
      hoverLabel.textContent = `Percentile: ${p}%`;
      const labelWidth = hoverLabel.offsetWidth || 0;
      const leftLabel = Math.max(0, (clampedX - labelWidth - 10));
      hoverLabel.style.left = leftLabel + 'px';
      hoverLabel.style.top = (10) + 'px';
    })
    .on('mouseleave', function() {
      hoverLine.style('display', 'none');
      hoverLabel.classList.add('hidden');
    });

  svg.append('text')
    .attr('x', 40)
    .attr('y', 20)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));
}

// Export functions
window.renderIdentifierMetricList = renderIdentifierMetricList;
window.renderBeeswarm = renderBeeswarm;

