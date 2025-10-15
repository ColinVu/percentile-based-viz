/**
 * Box Plot rendering for Box and Whisker view
 */

// Render box-and-whisker plot for selected metric (vertical value axis, box centered horizontally)
function renderBoxPlotCategory(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = 800;
  const height = container.clientHeight || 400;
  svg.attr('width', width).attr('height', height).style('width', width + 'px');

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

  const extent = d3.extent(sortedVals);
  const plotPaddingLeft = 50;
  const plotPaddingRight = 70; // keep room for right labels if needed later
  const plotPaddingTop = 10;
  const plotPaddingBottom = 40;
  const y = d3.scaleLinear().domain(extent).nice().range([height - plotPaddingBottom, plotPaddingTop]);
  const xCenter = (plotPaddingLeft + (width - plotPaddingRight)) / 2;

  svg.selectAll('*').remove();

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

  // Compute quartiles and whiskers
  const q1 = d3.quantileSorted(sortedVals, 0.25);
  const median = d3.quantileSorted(sortedVals, 0.5);
  const q3 = d3.quantileSorted(sortedVals, 0.75);
  const iqr = (q3 - q1);
  // Tukey whiskers: within 1.5*IQR
  const lowerWhiskerVal = sortedVals.find(v => v >= (q1 - 1.5 * iqr)) ?? sortedVals[0];
  const upperWhiskerVal = [...sortedVals].reverse().find(v => v <= (q3 + 1.5 * iqr)) ?? sortedVals[sortedVals.length - 1];

  const boxWidth = 80;

  // Whisker line
  svg.append('line')
    .attr('x1', xCenter)
    .attr('x2', xCenter)
    .attr('y1', y(lowerWhiskerVal))
    .attr('y2', y(upperWhiskerVal))
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5);

  // Box (Q1 to Q3)
  svg.append('rect')
    .attr('x', xCenter - boxWidth / 2)
    .attr('y', y(q3))
    .attr('width', boxWidth)
    .attr('height', Math.max(1, y(q1) - y(q3)))
    .attr('rx', 6)
    .attr('ry', 6)
    .attr('fill', '#e6f2fb')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5);

  // Median line
  svg.append('line')
    .attr('x1', xCenter - boxWidth / 2)
    .attr('x2', xCenter + boxWidth / 2)
    .attr('y1', y(median))
    .attr('y2', y(median))
    .attr('stroke', '#334155')
    .attr('stroke-width', 1.5);

  // Whisker caps
  svg.append('line')
    .attr('x1', xCenter - boxWidth / 4)
    .attr('x2', xCenter + boxWidth / 4)
    .attr('y1', y(lowerWhiskerVal))
    .attr('y2', y(lowerWhiskerVal))
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5);
  svg.append('line')
    .attr('x1', xCenter - boxWidth / 4)
    .attr('x2', xCenter + boxWidth / 4)
    .attr('y1', y(upperWhiskerVal))
    .attr('y2', y(upperWhiskerVal))
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.5);

  // Highlight current selection position on the plot
  const selectedRow = (window.appState.geoMode === 'country')
    ? window.appState.jsonData.find(d => d.Country === window.appState.selectedCountry)
    : window.appState.jsonData.find(d => {
        const label = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
        return label === window.appState.selectedCountry;
      });
  if (selectedRow && selectedRow[metricKey] != null && selectedRow[metricKey] !== '..') {
    const val = typeof selectedRow[metricKey] === 'number' ? selectedRow[metricKey] : parseFloat(selectedRow[metricKey]);
    if (!isNaN(val)) {
      svg.append('circle')
        .attr('cx', xCenter)
        .attr('cy', y(val))
        .attr('r', 4)
        .attr('fill', '#f1c40f')
        .attr('stroke', '#1f2937')
        .attr('stroke-width', 1);
    }
  }

  // Title
  svg.append('text')
    .attr('x', plotPaddingLeft + 6)
    .attr('y', 18)
    .attr('fill', '#2c3e50')
    .attr('font-size', 14)
    .attr('font-weight', 'bold')
    .text(window.formatMetricName(metricKey));

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
}

// Export functions
window.renderBoxPlotCategory = renderBoxPlotCategory;

