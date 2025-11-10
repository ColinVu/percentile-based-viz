/**
 * Beeswarm chart for Category Slider (Multi-Select)
 * Supports multi-selection with shift-click and selection box syncing
 */

function renderBeeswarmCategoryMultiSelect(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  multiSelectEnsureState();

  const width = (container.clientWidth - 20) || 800;
  const height = container.clientHeight || 400;
  svg
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  const values = window.appState.jsonData
    .map(d => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || Number.isNaN(v)) return null;
      const label = window.appState.geoMode === 'country'
        ? d.Country
        : (d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`);
      if (!label) return null;
      return { label, value: v };
    })
    .filter(Boolean);

  const availableLabels = new Set(values.map(v => v.label));
  window.appState.multiSelectAvailableLabels = availableLabels;
  if (typeof window.multiSelectUpdateBox === 'function') {
    window.multiSelectUpdateBox();
  }

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
  const plotPaddingRight = 80;
  const plotPaddingTop = 40;
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  svg.selectAll('*').remove();

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
      svg.append('text')
        .attr('x', width - plotPaddingRight + 6)
        .attr('y', qy + 3)
        .attr('fill', '#475569')
        .attr('font-size', 10)
        .text(`${p}%`);
    }
  }

  [0, 100].forEach(P => {
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

  const selections = new Set(window.appState.multiSelectedLabels || []);
  const primary = window.appState.selectedCountry;

  const primaryColor = '#ef4444';
  const secondaryColor = '#2563eb';
  const defaultColor = '#9b59b6';

  const previousNodes = Array.isArray(window.appState.previousBeeswarmNodes)
    ? window.appState.previousBeeswarmNodes
    : [];

  const circles = circleGroup.selectAll('circle')
    .data(nodes, d => d.data.label);

  const enteringCircles = circles.enter()
    .append('circle')
    .attr('cx', d => {
      const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
      return prev ? prev.x : d.x;
    })
    .attr('cy', d => {
      const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
      return prev ? prev.y : d.y;
    })
    .attr('r', d => {
      const label = d.data.label;
      const isPrimary = label === primary;
      const isSelected = selections.has(label);
      if (isPrimary) return d.r + 2.5;
      if (isSelected) return d.r + 1;
      return d.r;
    })
    .attr('fill', d => {
      const label = d.data.label;
      if (label === primary) return primaryColor;
      if (selections.has(label)) return secondaryColor;
      return defaultColor;
    })
    .attr('stroke', d => {
      const label = d.data.label;
      if (label === primary) return '#0f172a';
      if (selections.has(label)) return '#1d4ed8';
      return 'none';
    })
    .attr('stroke-width', d => {
      const label = d.data.label;
      if (label === primary) return 2.2;
      if (selections.has(label)) return 1.6;
      return 0;
    })
    .attr('opacity', 0.9);

  circles.exit().remove();

  const allCircles = enteringCircles.merge(circles);

  allCircles.transition()
    .duration(600)
    .ease(d3.easeQuadOut)
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => {
      const label = d.data.label;
      const isPrimary = label === primary;
      const isSelected = selections.has(label);
      if (isPrimary) return d.r + 2.5;
      if (isSelected) return d.r + 1;
      return d.r;
    })
    .attr('fill', d => {
      const label = d.data.label;
      if (label === primary) return primaryColor;
      if (selections.has(label)) return secondaryColor;
      return defaultColor;
    })
    .attr('stroke', d => {
      const label = d.data.label;
      if (label === primary) return '#0f172a';
      if (selections.has(label)) return '#1d4ed8';
      return 'none';
    })
    .attr('stroke-width', d => {
      const label = d.data.label;
      if (label === primary) return 2.2;
      if (selections.has(label)) return 1.6;
      return 0;
    });

  window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

  allCircles
    .on('mouseenter', function(evt, d) {
      const html = `${d.data.label}<br>Value: ${window.formatValue(d.data.value, metricKey)}<br>Percentile: ${d.data.percentile}%`;
      tooltip.html(html)
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
      d3.select(this)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 2.4)
        .attr('r', function(circleData) {
          const label = circleData.data.label;
          const isPrimary = label === primary;
          const isSelected = selections.has(label);
          if (isPrimary) return circleData.r + 3;
          if (isSelected) return circleData.r + 2;
          return circleData.r + 1.5;
        });
    })
    .on('mousemove', function(evt) {
      tooltip
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
    })
    .on('click', function(evt, d) {
      evt.stopPropagation();
      const label = d.data.label;
      if (evt.shiftKey) {
        multiSelectAddLabel(label);
        multiSelectUpdateBox();
        setTimeout(() => {
          renderBeeswarmCategoryMultiSelect(metricKey);
        }, 0);
      } else {
        multiSelectSetPrimary(label, { preserveOthers: false });
        multiSelectUpdateBox();
        if (typeof window.renderCategoryMetricListV7 === 'function') {
          window.renderCategoryMetricListV7();
        } else {
          renderBeeswarmCategoryMultiSelect(metricKey);
        }
      }
    })
    .on('mouseleave', function(evt, d) {
      tooltip.classed('hidden', true);
      const label = d.data.label;
      const isPrimary = label === primary;
      const isSelected = selections.has(label);
      d3.select(this)
        .attr('stroke', isPrimary ? '#0f172a' : (isSelected ? '#1d4ed8' : 'none'))
        .attr('stroke-width', isPrimary ? 2.2 : (isSelected ? 1.6 : 0))
        .attr('r', () => {
          if (isPrimary) return d.r + 2.5;
          if (isSelected) return d.r + 1;
          return d.r;
        });
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
      const p = Math.round((smaller + 0.5 * equal) / sortedVals.length * 100);
      hoverLabel.textContent = `Percentile: ${p}%`;
      hoverLabel.style.left = '75px';
      hoverLabel.style.top = (clampedY - 6) + 'px';
    })
    .on('mouseleave', function() {
      hoverLine.style('display', 'none');
      if (hoverLabel) {
        hoverLabel.classList.add('hidden');
      }
    })
    .on('click', function(evt) {
      if (evt.shiftKey) return;
      if (evt.target !== svg.node()) return;
      multiSelectClearSecondary();
      multiSelectUpdateBox();
      renderBeeswarmCategoryMultiSelect(metricKey);
    });

  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));
}

window.renderBeeswarmCategoryMultiSelect = renderBeeswarmCategoryMultiSelect;

