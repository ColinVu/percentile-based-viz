/**
 * Beeswarm chart for Category Slider (Encoded Data)
 * Displays circles colored by a selected categorical column
 */

function renderBeeswarmCategoryEncoded(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = (container.clientWidth - 20) || 800;
  const height = container.clientHeight || 400;
  svg
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  const encodingField = window.appState.categoryEncodedField;
  const hasEncodingField = encodingField && window.appState.jsonData.length > 0 && Object.prototype.hasOwnProperty.call(window.appState.jsonData[0], encodingField);
  const encodingLabel = encodingField ? window.formatMetricName(encodingField) : 'Group';
  const fallbackCategory = hasEncodingField ? 'Not specified' : 'All items';

  const values = window.appState.jsonData
    .map(d => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || Number.isNaN(v)) return null;
      const label = window.appState.geoMode === 'country'
        ? d.Country
        : (d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`);
      if (!label) return null;

      const rawCategory = hasEncodingField ? d[encodingField] : null;
      let categoryValue = fallbackCategory;
      if (hasEncodingField) {
        if (rawCategory === undefined || rawCategory === null || rawCategory === '..') {
          categoryValue = fallbackCategory;
        } else {
          const catStr = String(rawCategory).trim();
          categoryValue = catStr === '' ? fallbackCategory : catStr;
        }
      }

      return {
        label,
        value: v,
        category: categoryValue,
        rawCategory
      };
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
  const plotPaddingRight = 90;
  const plotPaddingTop = 40;
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  const previousNodes = Array.isArray(window.appState.previousBeeswarmNodes)
    ? window.appState.previousBeeswarmNodes
    : [];

  svg.selectAll('*').remove();

  const categories = Array.from(new Set(withPct.map(d => d.category))).filter(Boolean);
  if (categories.length === 0) {
    categories.push(fallbackCategory);
  }

  const colorScale = d3.scaleOrdinal()
    .domain(categories)
    .range(categories.map((_, idx) => {
      if (categories.length === 1) {
        return d3.interpolateRainbow(0.35);
      }
      return d3.interpolateRainbow(idx / categories.length);
    }));

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
    .force('collide', d3.forceCollide(d => d.r + 2.2))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');
  const dataGroup = svg.append('g').attr('class', 'beeswarm-points');

  const circles = dataGroup.selectAll('circle')
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
    .attr('r', d => d.data.label === window.appState.selectedCountry ? d.r + 1.5 : d.r)
    .attr('fill', d => colorScale(d.data.category))
    .attr('stroke', d => d.data.label === window.appState.selectedCountry ? '#0f172a' : '#ffffff')
    .attr('stroke-width', d => d.data.label === window.appState.selectedCountry ? 2 : 1)
    .attr('opacity', 0.92);

  circles.exit().remove();

  const allCircles = enteringCircles.merge(circles);

  allCircles.transition()
    .duration(600)
    .ease(d3.easeQuadOut)
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => d.data.label === window.appState.selectedCountry ? d.r + 1.5 : d.r)
    .attr('fill', d => colorScale(d.data.category))
    .attr('stroke', d => d.data.label === window.appState.selectedCountry ? '#0f172a' : '#ffffff')
    .attr('stroke-width', d => d.data.label === window.appState.selectedCountry ? 2 : 1);

  window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));

  const groupLabel = hasEncodingField ? encodingLabel : 'Category';
  allCircles
    .on('mouseenter', function(evt, d) {
      const htmlParts = [
        d.data.label,
        `Value: ${window.formatValue(d.data.value, metricKey)}`,
        `Percentile: ${d.data.percentile}%`
      ];
      if (hasEncodingField) {
        htmlParts.push(`${groupLabel}: ${d.data.category}`);
      }
      tooltip.html(htmlParts.join('<br>'))
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
      d3.select(this)
        .attr('stroke', '#111827')
        .attr('stroke-width', 2.5)
        .attr('r', d.r + 2.5);
    })
    .on('mousemove', function(evt) {
      tooltip
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', (evt.offsetY - 48) + 'px');
    })
    .on('click', function(evt, d) {
      const newSelection = d.data.label;
      if (!newSelection) return;
      window.appState.selectedCountry = newSelection;
      const selectEl = document.getElementById('countrySelect');
      if (selectEl) {
        const exists = Array.from(selectEl.options).some(o => o.value === newSelection);
        if (exists) selectEl.value = newSelection;
      }
      window.calculatePercentiles(window.appState.selectedCountry);
      window.updateCountryInfo();
      if (typeof window.renderCategoryMetricListV6 === 'function') {
        window.renderCategoryMetricListV6();
      }
      if (window.appState.categorySelectedMetricKey) {
        window.renderBeeswarmCategoryEncoded(window.appState.categorySelectedMetricKey);
      } else {
        window.renderBeeswarmCategoryEncoded(metricKey);
      }
    })
    .on('mouseleave', function(evt, d) {
      tooltip.classed('hidden', true);
      const isSelected = d.data.label === window.appState.selectedCountry;
      d3.select(this)
        .attr('stroke', isSelected ? '#0f172a' : '#ffffff')
        .attr('stroke-width', isSelected ? 2 : 1)
        .attr('r', isSelected ? d.r + 1.5 : d.r);
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

  if (hasEncodingField && categories.length > 0) {
    const maxLegendItems = 16;
    const legendCategories = categories.slice(0, maxLegendItems);
    const legend = svg.append('g').attr('class', 'encoded-legend');
    const legendX = (width - plotPaddingRight) - 110;
    let legendY = plotPaddingTop + 12;

    legend.append('text')
      .attr('x', legendX)
      .attr('y', legendY - 18)
      .attr('fill', '#1f2937')
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text(`Color: ${encodingLabel}`);

    legendCategories.forEach((cat, idx) => {
      const rowY = legendY + idx * 16;
      const row = legend.append('g').attr('transform', `translate(0, ${rowY})`);
      row.append('rect')
        .attr('x', legendX)
        .attr('y', -9)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', colorScale(cat))
        .attr('stroke', '#334155')
        .attr('stroke-width', 0.5);
      row.append('text')
        .attr('x', legendX + 16)
        .attr('y', 0)
        .attr('fill', '#475569')
        .attr('font-size', 10)
        .attr('dominant-baseline', 'middle')
        .text(cat);
    });

    if (categories.length > maxLegendItems) {
      legend.append('text')
        .attr('x', legendX)
        .attr('y', legendY + maxLegendItems * 16)
        .attr('fill', '#475569')
        .attr('font-size', 10)
        .text(`(+${categories.length - maxLegendItems} more)`);
    }
  }

  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));
}

window.renderBeeswarmCategoryEncoded = renderBeeswarmCategoryEncoded;

