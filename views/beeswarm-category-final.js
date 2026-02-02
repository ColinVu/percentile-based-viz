/**
 * Beeswarm chart for Category Slider (Final View)
 * Displays circles colored by a selected categorical column
 * Can toggle to box plot view
 */

console.log('============ beeswarm-category-final.js LOADED ============');

// Initialize color overrides map if not exists
if (!window.appState.beeswarmColorOverrides) {
  window.appState.beeswarmColorOverrides = {};
}

// Validate hex color format: must start with # and have exactly 6 valid hex characters
function isValidHexColor(color) {
  if (!color || typeof color !== 'string') return false;
  if (!color.startsWith('#')) return false;
  if (color.length !== 7) return false;
  const hexChars = color.slice(1).toUpperCase();
  for (let i = 0; i < 6; i++) {
    const c = hexChars[i];
    if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) {
      return false;
    }
  }
  return true;
}

// Get effective color (checking for overrides)
function getEffectiveColor(originalColor) {
  const overrides = window.appState.beeswarmColorOverrides || {};
  return overrides[originalColor] || originalColor;
}

// Helper function to highlight a beeswarm element by label
function highlightBeeswarmElement(label, highlight) {
  const svg = d3.select('#beeswarm-svg');
  
  // Check if we're in text encoding mode
  const hasTextEncoding = window.appState.categoryTextEncodedField && window.appState.categoryTextEncodedField !== '';
  
  if (hasTextEncoding) {
    // Find and highlight text elements
    svg.selectAll('.beeswarm-points text').each(function(d) {
      if (d && d.data && d.data.label === label) {
        const textEl = d3.select(this);
        if (highlight) {
          textEl.attr('data-original-fill', textEl.attr('fill'))
               .attr('data-original-stroke', textEl.attr('stroke'))
               .attr('data-original-stroke-width', textEl.attr('stroke-width'))
               .attr('fill', '#93c5fd')
               .attr('stroke', '#3b82f6')
               .attr('stroke-width', 2);
        } else {
          textEl.attr('fill', textEl.attr('data-original-fill') || '#000000')
               .attr('stroke', textEl.attr('data-original-stroke') || 'none')
               .attr('stroke-width', textEl.attr('data-original-stroke-width') || 0);
        }
      }
    });
  } else {
    // Find and highlight circle elements
    svg.selectAll('.beeswarm-points circle').each(function(d) {
      if (d && d.data && d.data.label === label) {
        const circle = d3.select(this);
        if (highlight) {
          circle.attr('data-original-fill', circle.attr('fill'))
                .attr('data-original-stroke', circle.attr('stroke'))
                .attr('data-original-stroke-width', circle.attr('stroke-width'))
                .attr('fill', '#93c5fd')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 3);
        } else {
          circle.attr('fill', circle.attr('data-original-fill') || '#3498db')
                .attr('stroke', circle.attr('data-original-stroke') || '#ffffff')
                .attr('stroke-width', circle.attr('data-original-stroke-width') || 1);
        }
      }
    });
  }
}

// Helper function to select a record
function selectRecord(label) {
  const inSelectionMode = isSelectionEncodingMode();
  
  if (inSelectionMode) {
    // In selection mode, update the active row's location in the selection table
    const locations = window.appState.selectionModeLocations || [];
    const activeIdx = window.appState.selectionModeActiveIndex || 0;
    
    if (locations.length === 0) {
      // No selections yet - add this as the first one
      if (typeof window.addSelectionRow === 'function') {
        window.addSelectionRow(label);
      }
      window.appState.selectedCountry = label;
    } else if (locations[activeIdx]) {
      // Update the location for the active row
      locations[activeIdx].location = label;
      window.appState.selectedCountry = label;
    }
    
    // Update the country select dropdown (main one in sidebar)
    const selectEl = document.getElementById('countrySelect');
    if (selectEl) {
      const exists = Array.from(selectEl.options).some(o => o.value === label);
      if (exists) selectEl.value = label;
    }
    
    // Update percentiles and info for the new location
    window.calculatePercentiles(label);
    window.updateCountryInfo();
    
    // Re-render the metric list first (to update percentiles on left)
    if (typeof window.renderCategoryMetricListFinal === 'function') {
      window.renderCategoryMetricListFinal();
    }
    
    // Re-render the selection table to show the updated location in dropdown
    if (typeof window.renderSelectionTable === 'function') {
      window.renderSelectionTable();
    }
    
    // Re-render the beeswarm with the new selection
    if (window.appState.categorySelectedMetricKey) {
      window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
    }
  } else {
    // Normal mode - just update selection
    window.appState.selectedCountry = label;
    
    // Update the country select dropdown
    const selectEl = document.getElementById('countrySelect');
    if (selectEl) {
      const exists = Array.from(selectEl.options).some(o => o.value === label);
      if (exists) selectEl.value = label;
    }
    
    // Update percentiles and info
    window.calculatePercentiles(label);
    window.updateCountryInfo();
    
    // Re-render the metric list to show updated percentiles
    if (typeof window.renderCategoryMetricListFinal === 'function') {
      window.renderCategoryMetricListFinal();
    }
    
    // Re-render the beeswarm with the new selection
    if (window.appState.categorySelectedMetricKey) {
      window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
    }
  }
}

// Show color input box at cursor position for right-click color editing
// originalColor: the true original color from the color scale (used as key for storage)
// displayColor: the current effective color to show in the input (may be an override)
// recordLabel: the label of the record (for finding similar records)
function showColorInputBox(evt, originalColor, displayColor, onColorApplied, recordLabel = null) {
  // Remove any existing input box
  const existingInput = document.getElementById('beeswarm-color-input');
  if (existingInput) existingInput.remove();

  // Prevent default context menu
  evt.preventDefault();

  // Calculate position, adjusting if it would go off the bottom of the screen
  // Estimate height: base 40px + potential similar records (3 * 20px = 60px) = ~100px max
  const estimatedHeight = 100;
  const topPosition = (evt.clientY + estimatedHeight > window.innerHeight) 
    ? Math.max(10, evt.clientY - estimatedHeight - 5)  // Position above cursor if would go off bottom
    : evt.clientY + 5;  // Normal position below cursor

  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.id = 'beeswarm-color-input';
  inputContainer.style.cssText = `
    position: fixed;
    left: ${evt.clientX + 5}px;
    top: ${topPosition}px;
    z-index: 10000;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    max-width: 300px;
  `;

  // Add "Color:" label
  const colorLabel = document.createElement('div');
  colorLabel.textContent = 'Color:';
  colorLabel.style.cssText = `
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
    font-weight: 500;
  `;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '#FF0000';
  input.value = displayColor;
  input.style.cssText = `
    width: 80px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    outline: none;
  `;

  inputContainer.appendChild(colorLabel);
  inputContainer.appendChild(input);

  // If in selection encoding mode, show similar records
  const inSelectionMode = isSelectionEncodingMode();
  if (inSelectionMode && recordLabel && window.appState.similarityIndex) {
    try {
      // Find the row index for this record
      let rowIndex = null;
      const dataColumn = window.appState.dataColumn;
      
      if (window.appState.geoMode === 'country') {
        rowIndex = window.appState.jsonData.findIndex(d => d.Country === recordLabel);
      } else if (window.appState.geoMode === 'county') {
        rowIndex = window.appState.jsonData.findIndex(d => {
          const label = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
          return label === recordLabel;
        });
      } else {
        rowIndex = window.appState.jsonData.findIndex(d => d[dataColumn] === recordLabel);
      }
      
      if (rowIndex >= 0) {
        const similarRecords = window.appState.similarityIndex.queryByRowIndex(rowIndex, 3);
        
        if (similarRecords && similarRecords.length > 0) {
          // Add separator
          const separator = document.createElement('hr');
          separator.style.cssText = 'margin: 8px 0; border: none; border-top: 1px solid #e2e8f0;';
          inputContainer.appendChild(separator);
          
          // Add similar records section
          const similarHeader = document.createElement('div');
          similarHeader.textContent = 'Similar regions:';
          similarHeader.style.cssText = 'font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 4px;';
          inputContainer.appendChild(similarHeader);
          
          similarRecords.forEach((similar, idx) => {
            const similarDiv = document.createElement('div');
            let similarLabel = '';
            
            if (window.appState.geoMode === 'country') {
              similarLabel = similar.record.Country || '(Unknown)';
            } else if (window.appState.geoMode === 'county') {
              similarLabel = similar.record.__displayName || 
                `${(similar.record.County || '').toString().trim()}, ${(similar.record.State || '').toString().trim()}`;
            } else {
              similarLabel = similar.record[dataColumn] || '(Unknown)';
            }
            
            similarDiv.textContent = similarLabel;
            similarDiv.style.cssText = 'font-size: 11px; color: #64748b; padding: 3px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; border-radius: 2px; transition: background-color 0.15s;';
            similarDiv.dataset.label = similarLabel;
            
            // Hover effect for the div itself
            similarDiv.addEventListener('mouseenter', function() {
              this.style.backgroundColor = '#f1f5f9';
              this.style.color = '#1e293b';
              
              // Highlight the corresponding element in the beeswarm
              highlightBeeswarmElement(similarLabel, true);
            });
            
            similarDiv.addEventListener('mouseleave', function() {
              this.style.backgroundColor = 'transparent';
              this.style.color = '#64748b';
              
              // Remove highlight from the beeswarm
              highlightBeeswarmElement(similarLabel, false);
            });
            
            // Click to select this record - use mousedown to fire before blur
            similarDiv.addEventListener('mousedown', function(e) {
              e.stopPropagation();
              e.preventDefault();
              selectRecord(similarLabel);
              inputContainer.remove();
            });
            
            inputContainer.appendChild(similarDiv);
          });
        }
      }
    } catch (error) {
      console.error('Error finding similar records:', error);
    }
  }

  document.body.appendChild(inputContainer);

  // Focus and select the input
  input.focus();
  input.select();

  // Handle Enter key
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const newColor = input.value.trim();
      if (isValidHexColor(newColor)) {
        // Store the override mapping using the TRUE original color as key
        window.appState.beeswarmColorOverrides[originalColor] = newColor;
        if (onColorApplied) onColorApplied();
      }
      inputContainer.remove();
    } else if (e.key === 'Escape') {
      inputContainer.remove();
    }
  });

  // Handle blur (clicking outside)
  input.addEventListener('blur', function() {
    // Small delay to allow Enter key to process first
    setTimeout(() => {
      if (document.body.contains(inputContainer)) {
        inputContainer.remove();
      }
    }, 100);
  });
}

// Main render function that checks for box plot mode
function renderBeeswarmCategoryFinal(metricKey) {
  console.log('>>> renderBeeswarmCategoryFinal called with metricKey:', metricKey);
  // Ensure checkbox exists
  ensureFinalViewBeeswarmCheckbox();
  
  // Always render the beeswarm
  renderBeeswarmCategoryFinalActual(metricKey);
  
  // If box plot mode is enabled, overlay the box plot on top
  if (window.appState.finalViewBoxPlotMode) {
    renderBoxPlotOverlay(metricKey);
  }
  
  // Update map if visible
  if (window.appState.finalViewMapMode && typeof window.renderMapPanel === 'function') {
    window.renderMapPanel();
  }
}

// Ensure checkbox exists in the beeswarm panel
function ensureFinalViewBeeswarmCheckbox() {
  const container = document.querySelector('.beeswarm-panel');
  if (!container) return;
  
  let existingCheckbox = document.getElementById('box-plot-mode-checkbox-container');
  if (existingCheckbox) return; // Already exists
  
  // Create checkbox container
  const checkboxContainer = document.createElement('div');
  checkboxContainer.id = 'box-plot-mode-checkbox-container';
  checkboxContainer.style.cssText = 'position: absolute; bottom: 10px; right: 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; z-index: 100; background: white; padding: 6px 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'box-plot-mode-checkbox';
  checkbox.checked = window.appState.finalViewBoxPlotMode || false;
  checkbox.style.cssText = 'cursor: pointer;';
  
  const checkboxLabel = document.createElement('label');
  checkboxLabel.htmlFor = 'box-plot-mode-checkbox';
  checkboxLabel.textContent = 'Box Plot';
  checkboxLabel.style.cssText = 'cursor: pointer; user-select: none; color: #475569;';
  
  checkboxContainer.appendChild(checkbox);
  checkboxContainer.appendChild(checkboxLabel);
  container.appendChild(checkboxContainer);
  
  // Add event listener
  checkbox.addEventListener('change', function() {
    window.appState.finalViewBoxPlotMode = this.checked;
    if (window.appState.categorySelectedMetricKey) {
      renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
    }
  });
  
  // Add map toggle button
  let existingMapToggle = document.getElementById('map-toggle-button');
  const hasLatLong = typeof window.detectLatLongColumns === 'function' && window.detectLatLongColumns();
  const hasFIPS = typeof window.detectFIPSColumn === 'function' && window.detectFIPSColumn();
  const hasCountryCode = typeof window.detectCountryCodeColumn === 'function' && window.detectCountryCodeColumn();
  
  console.log('Map toggle check - hasLatLong:', hasLatLong, '| hasFIPS:', hasFIPS, '| hasCountryCode:', hasCountryCode);
  
  if (!existingMapToggle && (hasLatLong || hasFIPS || hasCountryCode)) {
    const mapToggle = document.createElement('div');
    mapToggle.id = 'map-toggle-button';
    mapToggle.style.cssText = 'position: absolute; bottom: 50px; right: 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; z-index: 100; background: white; padding: 6px 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;';
    
    const mapCheckbox = document.createElement('input');
    mapCheckbox.type = 'checkbox';
    mapCheckbox.id = 'map-mode-checkbox';
    mapCheckbox.checked = window.appState.finalViewMapMode || false;
    mapCheckbox.style.cssText = 'cursor: pointer;';
    
    const mapLabel = document.createElement('label');
    mapLabel.htmlFor = 'map-mode-checkbox';
    mapLabel.textContent = 'Map';
    mapLabel.style.cssText = 'cursor: pointer; user-select: none; color: #475569;';
    
    mapToggle.appendChild(mapCheckbox);
    mapToggle.appendChild(mapLabel);
    container.appendChild(mapToggle);
    
    // Add event listener
    mapCheckbox.addEventListener('change', function() {
      window.appState.finalViewMapMode = this.checked;
      const mapPopup = document.getElementById('map-panel-popup');
      if (mapPopup) {
        mapPopup.style.display = this.checked ? 'block' : 'none';
        if (this.checked && typeof window.renderMapPanel === 'function') {
          window.renderMapPanel();
        }
      }
    });
  }
}

// Box plot rendering for Final View
function renderBoxPlotCategoryFinal(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = (container.clientWidth - 20) || 800;
  const height = container.clientHeight || 400;
  svg.attr('width', width)
     .attr('height', height)
     .style('display', 'block');

  // Use filtered rows if available (for filter functionality), otherwise use all data
  const dataToUse = Array.isArray(window.appState.filterSelectFilteredRows) && window.appState.filterSelectFilteredRows.length > 0
    ? window.appState.filterSelectFilteredRows
    : window.appState.jsonData;

  // Debug logging
  console.log('Beeswarm render - geoMode:', window.appState.geoMode);
  console.log('Beeswarm render - dataColumn:', window.appState.dataColumn);
  if (dataToUse.length > 0) {
    console.log('First row keys:', Object.keys(dataToUse[0]));
  }

  const values = dataToUse
    .map((d, idx) => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || isNaN(v)) return null;
      let label;
      if (window.appState.geoMode === 'country') {
        label = d.Country;
      } else if (window.appState.geoMode === 'county') {
        label = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
      } else {
        // Custom mode - use the selected data column
        label = d[window.appState.dataColumn];
        if (idx === 0) {
          console.log('CUSTOM MODE - dataColumn:', window.appState.dataColumn);
          console.log('CUSTOM MODE - d[dataColumn]:', label);
          console.log('CUSTOM MODE - full row:', d);
        }
      }
      if (idx === 0) {
        console.log('First label:', label, '| geoMode:', window.appState.geoMode);
      }
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
  const plotPaddingRight = 70;
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
  axisG.selectAll('text').style('font-size', '10px').style('user-select', 'none');

  // Compute quartiles and whiskers
  const q1 = d3.quantileSorted(sortedVals, 0.25);
  const median = d3.quantileSorted(sortedVals, 0.5);
  const q3 = d3.quantileSorted(sortedVals, 0.75);
  const iqr = (q3 - q1);
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
    .style('user-select', 'none')
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
      hoverLabel.style.userSelect = 'none';
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

// Helper function to get color for a location in selection mode
function getSelectionModeColor(label) {
  const locations = window.appState.selectionModeLocations || [];
  for (const loc of locations) {
    if (loc.location === label) {
      return loc.color;
    }
  }
  return null; // Not a selected location
}

// Check if we're in selection encoding mode
function isSelectionEncodingMode() {
  return window.appState.encodingMode === 'selection' && 
         window.appState.viewMode === 'category-final';
}

// Original beeswarm rendering
function renderBeeswarmCategoryFinalActual(metricKey) {
  console.log('>>> renderBeeswarmCategoryFinalActual called with metricKey:', metricKey);
  console.log('>>> geoMode:', window.appState.geoMode, '| dataColumn:', window.appState.dataColumn);
  const svg = d3.select('#beeswarm-svg');
  const container = document.querySelector('.beeswarm-panel');
  if (!svg.node() || !container) return;

  const width = (container.clientWidth - 20) || 800;
  const height = container.clientHeight || 400;
  svg
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  // Check if in selection mode
  const inSelectionMode = isSelectionEncodingMode();

  const encodingField = window.appState.categoryEncodedField;
  const hasEncodingField = !inSelectionMode && encodingField && window.appState.jsonData.length > 0 && Object.prototype.hasOwnProperty.call(window.appState.jsonData[0], encodingField);
  const encodingLabel = encodingField ? window.formatMetricName(encodingField) : 'Group';
  const fallbackCategory = hasEncodingField ? 'Not specified' : 'All items';
  
  // Check if encoding field is numeric
  const numericCols = typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [];
  const isNumericEncoding = hasEncodingField && numericCols.includes(encodingField);
  
  // Check for text encoding field
  const textEncodingField = window.appState.categoryTextEncodedField;
  const hasTextEncoding = textEncodingField && textEncodingField !== '' && window.appState.jsonData.length > 0 && Object.prototype.hasOwnProperty.call(window.appState.jsonData[0], textEncodingField);

  // Use filtered rows if available (for filter functionality), otherwise use all data
  const dataToUse = Array.isArray(window.appState.filterSelectFilteredRows) && window.appState.filterSelectFilteredRows.length > 0
    ? window.appState.filterSelectFilteredRows
    : window.appState.jsonData;

  // Compute quantile bins for numeric encoding (5 bins) - must be after dataToUse is defined
  let quantileBins = null;
  if (isNumericEncoding) {
    const encodingValues = dataToUse
      .map(d => d[encodingField])
      .filter(v => v !== undefined && v !== null && v !== '..' && !Number.isNaN(parseFloat(v)))
      .map(v => parseFloat(v))
      .sort((a, b) => a - b);
    
    if (encodingValues.length > 0) {
      // Compute quintile thresholds (20th, 40th, 60th, 80th percentiles)
      const q20 = d3.quantile(encodingValues, 0.2);
      const q40 = d3.quantile(encodingValues, 0.4);
      const q60 = d3.quantile(encodingValues, 0.6);
      const q80 = d3.quantile(encodingValues, 0.8);
      
      quantileBins = {
        thresholds: [q20, q40, q60, q80],
        labels: ['Lowest 20%', 'Low 20-40%', 'Middle 40-60%', 'High 60-80%', 'Highest 20%']
      };
    }
  }
  
  // Function to get bin for a numeric value
  function getQuantileBin(value) {
    if (!quantileBins || value === undefined || value === null || value === '..' || Number.isNaN(parseFloat(value))) {
      return fallbackCategory;
    }
    const numVal = parseFloat(value);
    const thresholds = quantileBins.thresholds;
    if (numVal < thresholds[0]) return quantileBins.labels[0];
    if (numVal < thresholds[1]) return quantileBins.labels[1];
    if (numVal < thresholds[2]) return quantileBins.labels[2];
    if (numVal < thresholds[3]) return quantileBins.labels[3];
    return quantileBins.labels[4];
  }

  const values = dataToUse
    .map(d => {
      const raw = d[metricKey];
      const v = typeof raw === 'number' ? raw : parseFloat(raw);
      if (raw === '..' || raw === undefined || raw === null || Number.isNaN(v)) return null;
      let label;
      if (window.appState.geoMode === 'country') {
        label = d.Country;
      } else if (window.appState.geoMode === 'county') {
        label = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
      } else {
        label = d[window.appState.dataColumn];
      }
      if (!label) return null;

      const rawCategory = hasEncodingField ? d[encodingField] : null;
      let categoryValue = fallbackCategory;
      if (hasEncodingField) {
        if (isNumericEncoding) {
          // For numeric encoding, use quantile bins
          categoryValue = getQuantileBin(rawCategory);
        } else {
          // For categorical encoding, use the value as-is
          if (rawCategory === undefined || rawCategory === null || rawCategory === '..') {
            categoryValue = fallbackCategory;
          } else {
            const catStr = String(rawCategory).trim();
            categoryValue = catStr === '' ? fallbackCategory : catStr;
          }
        }
      }
      
      // Get text value for text encoding
      const textValue = hasTextEncoding ? (d[textEncodingField] || '?') : null;

      return {
        label,
        value: v,
        category: categoryValue,
        rawCategory,
        textValue: textValue
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
  
  // Sort categories to put "Not specified" last
  categories.sort((a, b) => {
    const aIsNotSpecified = a === 'Not specified' || a === fallbackCategory;
    const bIsNotSpecified = b === 'Not specified' || b === fallbackCategory;
    
    if (aIsNotSpecified && !bIsNotSpecified) return 1; // a comes after b
    if (!aIsNotSpecified && bIsNotSpecified) return -1; // a comes before b
    
    // For numeric bins, maintain the order from lowest to highest
    if (isNumericEncoding && quantileBins) {
      const aIndex = quantileBins.labels.indexOf(a);
      const bIndex = quantileBins.labels.indexOf(b);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    }
    
    // For categorical, maintain original order (alphabetical from Set)
    return 0;
  });

  // In selection mode, we use a different coloring strategy
  const defaultUnselectedColor = '#94a3b8'; // Grey for unselected in selection mode
  
  const colorScale = d3.scaleOrdinal()
    .domain(categories)
    .range(categories.map((cat, idx) => {
      // "Not specified" should always be grey
      if (cat === 'Not specified' || cat === fallbackCategory) {
        return '#94a3b8'; // Grey for not specified
      }
      
      if (inSelectionMode) {
        // In selection mode, colorScale returns grey - actual colors come from getSelectionModeColor
        return defaultUnselectedColor;
      }
      if (categories.length === 1 && (!hasEncodingField || !encodingField)) {
        // No color encoding - use blue
        return '#3498db';
      } else if (categories.length === 1) {
        return d3.interpolateRainbow(0.35);
      }
      // For numeric encoding, use sequential color scheme (blue-green-yellow-red gradient)
      if (isNumericEncoding && quantileBins) {
        // Map to a sequential color scale: light to dark or cool to warm
        const colors = ['#3288bd', '#66c2a5', '#fee08b', '#f46d43', '#d53e4f']; // Cool to warm
        // Find the index in the quantile bins labels
        const binIndex = quantileBins.labels.indexOf(cat);
        if (binIndex >= 0) {
          return colors[binIndex];
        }
        return colors[colors.length - 1];
      }
      // For categorical encoding, use rainbow
      return d3.interpolateRainbow(idx / categories.length);
    }));
  
  // Function to get the actual fill color for a data point
  function getDotColor(d) {
    if (inSelectionMode) {
      const selColor = getSelectionModeColor(d.data.label);
      if (selColor) return selColor;
      return defaultUnselectedColor;
    }
    return getEffectiveColor(colorScale(d.data.category));
  }

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
  axisG.selectAll('text').style('font-size', '10px').style('user-select', 'none');

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
        .style('user-select', 'none')
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
        .style('user-select', 'none')
        .text(`${P}%`);
    }
  });

  const nodes = withPct.map(d => ({
    x: xCenter,
    y: y(d.value),
    r: 5,
    data: d
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('y', d3.forceY(d => y(d.data.value)).strength(1))
    .force('x', d3.forceX(xCenter).strength(0.05))
    .force('collide', d3.forceCollide(d => d.r + 1.3))
    .stop();

  for (let i = 0; i < 200; i++) simulation.tick();
  nodes.forEach(n => {
    n.x = Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, n.x));
    n.y = Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, n.y));
  });

  const tooltip = d3.select('#beeswarm-tooltip');
  const dataGroup = svg.append('g').attr('class', 'beeswarm-points');

  // Conditional rendering: text labels vs circles
  if (hasTextEncoding) {
    // Clear any circles from previous render
    dataGroup.selectAll('circle').remove();
    
    // Helper to check if a node is selected (for text encoding mode)
    const isSelectedLocationText = (d) => {
      if (!inSelectionMode) return d.data.label === window.appState.selectedCountry;
      return getSelectionModeColor(d.data.label) !== null;
    };
    
    // Render background rectangles for selected item (behind text)
    const selectedRects = dataGroup.selectAll('rect.selected-bg')
      .data(nodes.filter(n => isSelectedLocationText(n)), d => d.data.label);
    
    selectedRects.enter()
      .append('rect')
      .attr('class', 'selected-bg')
      .attr('x', d => {
        const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
        return prev ? prev.x - 9 : d.x - 9;
      })
      .attr('y', d => {
        const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
        return prev ? prev.y - 6 : d.y - 6;
      })
      .attr('width', 18)
      .attr('height', 12)
      .attr('fill', d => getDotColor(d))
      .attr('stroke', inSelectionMode ? 'none' : '#000000')
      .attr('stroke-width', inSelectionMode ? 0 : 1)
      .attr('pointer-events', 'none')
      .merge(selectedRects)
      .transition()
      .duration(600)
      .ease(d3.easeQuadOut)
      .attr('x', d => Math.max(plotPaddingLeft - 9, Math.min(width - plotPaddingRight - 9, d.x - 9)))
      .attr('y', d => Math.max(plotPaddingTop - 6, Math.min(height - plotPaddingBottom - 6, d.y - 6)))
      .attr('fill', d => getDotColor(d))
      .attr('stroke', inSelectionMode ? 'none' : '#000000')
      .attr('stroke-width', inSelectionMode ? 0 : 1);
    
    selectedRects.exit().remove();
    
    // Render text labels
    const texts = dataGroup.selectAll('text')
      .data(nodes, d => d.data.label);
    
    const enteringTexts = texts.enter()
      .append('text')
      .attr('x', d => {
        const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
        return prev ? prev.x : d.x;
      })
      .attr('y', d => {
        const prev = previousNodes.find(p => p.data && p.data.label === d.data.label);
        return prev ? prev.y : d.y;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('fill', d => isSelectedLocationText(d) ? '#ffffff' : getDotColor(d))
      .attr('opacity', d => inSelectionMode && !isSelectedLocationText(d) ? 0.5 : 1)
      .attr('pointer-events', 'all')
      .text(d => String(d.data.textValue || '?'))
      .each(function(d) {
        // Store original color as data attribute for right-click
        d3.select(this).attr('data-original-color', inSelectionMode ? getDotColor(d) : colorScale(d.data.category));
      });
    
    texts.exit().remove();
    
    const allTexts = enteringTexts.merge(texts);
    
    allTexts.transition()
      .duration(600)
      .ease(d3.easeQuadOut)
      .attr('x', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
      .attr('y', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
      .attr('fill', d => isSelectedLocationText(d) ? '#ffffff' : getDotColor(d))
      .attr('opacity', d => inSelectionMode && !isSelectedLocationText(d) ? 0.5 : 1)
      .attr('font-weight', 'bold');
    
    // Update data-original-color for all texts
    allTexts.each(function(d) {
      d3.select(this).attr('data-original-color', inSelectionMode ? getDotColor(d) : colorScale(d.data.category));
    });
    
    window.appState.previousBeeswarmNodes = nodes.map(n => ({ ...n }));
    
    // Add interaction handlers to text elements
    const groupLabel = hasEncodingField ? encodingLabel : 'Category';
    allTexts
      .on('mouseenter', function(evt, d) {
        const htmlParts = [
          d.data.label,
          `Value: ${window.formatValue(d.data.value, metricKey)}`,
          `Percentile: ${d.data.percentile}%`
        ];
        if (hasEncodingField) {
          htmlParts.push(`${groupLabel}: ${d.data.category}`);
        }
        if (hasTextEncoding) {
          htmlParts.push(`${window.formatMetricName(textEncodingField)}: ${d.data.textValue}`);
        }
        // Smart positioning: if tooltip would be hidden by header (first ~80px), show it below cursor instead
        const tooltipTop = evt.offsetY - 48;
        const adjustedTop = tooltipTop < 80 ? evt.offsetY + 20 : tooltipTop;
        tooltip.html(htmlParts.join('<br>'))
          .classed('hidden', false)
          .style('left', (evt.offsetX + 32) + 'px')
          .style('top', adjustedTop + 'px')
          .style('user-select', 'none');
        d3.select(this)
          .attr('stroke', '#d35400')
          .attr('stroke-width', 1.5)
          .attr('font-size', '10px');
      })
      .on('mousemove', function(evt) {
        // Smart positioning: if tooltip would be hidden by header (first ~80px), show it below cursor instead
        const tooltipTop = evt.offsetY - 48;
        const adjustedTop = tooltipTop < 80 ? evt.offsetY + 20 : tooltipTop;
        tooltip
          .style('left', (evt.offsetX + 32) + 'px')
          .style('top', adjustedTop + 'px');
      })
      .on('click', function(evt, d) {
        const newSelection = d.data.label;
        if (!newSelection) return;
        
        // In selection mode, handle shift+click for add/remove
        if (inSelectionMode) {
          const locations = window.appState.selectionModeLocations || [];
          
          if (evt.shiftKey) {
            // Shift+click: add or remove from selection
            const existingIndex = locations.findIndex(loc => loc.location === newSelection);
            
            if (existingIndex >= 0) {
              // Already selected - remove it
              locations.splice(existingIndex, 1);
              
              // Adjust active index if needed
              if (window.appState.selectionModeActiveIndex >= locations.length) {
                window.appState.selectionModeActiveIndex = Math.max(0, locations.length - 1);
              }
              
              // Update selectedCountry to the active row's location
              if (locations.length > 0) {
                const activeIdx = window.appState.selectionModeActiveIndex;
                if (locations[activeIdx] && locations[activeIdx].location) {
                  window.appState.selectedCountry = locations[activeIdx].location;
                }
              } else {
                window.appState.selectedCountry = '';
              }
            } else {
              // Not selected - add it with a new color
              if (typeof window.addSelectionRow === 'function') {
                window.addSelectionRow(newSelection);
              }
              window.appState.selectedCountry = newSelection;
            }
            
            if (typeof window.renderSelectionTable === 'function') {
              window.renderSelectionTable();
            }
          } else {
            // Normal click: update the active row's location, or add if empty
            const activeIdx = window.appState.selectionModeActiveIndex || 0;
            if (locations.length === 0) {
              // No selections yet - add this as the first one
              if (typeof window.addSelectionRow === 'function') {
                window.addSelectionRow(newSelection);
              }
            } else if (locations[activeIdx]) {
              locations[activeIdx].location = newSelection;
            }
            if (typeof window.renderSelectionTable === 'function') {
              window.renderSelectionTable();
            }
            window.appState.selectedCountry = newSelection;
          }
        } else {
          window.appState.selectedCountry = newSelection;
        }
        
        const selectEl = document.getElementById('countrySelect');
        if (selectEl) {
          const exists = Array.from(selectEl.options).some(o => o.value === newSelection);
          if (exists) selectEl.value = window.appState.selectedCountry;
        }
        window.calculatePercentiles(window.appState.selectedCountry);
        window.updateCountryInfo();
        if (typeof window.renderCategoryMetricListFinal === 'function') {
          window.renderCategoryMetricListFinal();
        }
        if (window.appState.categorySelectedMetricKey) {
          window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
        } else {
          window.renderBeeswarmCategoryFinal(metricKey);
        }
      })
      .on('mouseleave', function(evt, d) {
        tooltip.classed('hidden', true);
        d3.select(this)
          .attr('stroke', 'none')
          .attr('font-size', '8px');
      })
      .on('contextmenu', function(evt, d) {
        const originalColor = d3.select(this).attr('data-original-color');
        const currentEffectiveColor = inSelectionMode ? getDotColor(d) : getEffectiveColor(originalColor);
        showColorInputBox(evt, originalColor, currentEffectiveColor, () => {
          // In selection mode, update the location's color directly
          if (inSelectionMode) {
            const locations = window.appState.selectionModeLocations || [];
            const loc = locations.find(l => l.location === d.data.label);
            if (loc) {
              const newColor = window.appState.beeswarmColorOverrides[originalColor];
              if (newColor) {
                loc.color = newColor;
                delete window.appState.beeswarmColorOverrides[originalColor];
              }
            }
            if (typeof window.renderSelectionTable === 'function') {
              window.renderSelectionTable();
            }
          }
          // Re-render to apply the new colors
          if (window.appState.categorySelectedMetricKey) {
            window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
          }
        }, d.data.label);
      });
  } else {
    // Clear any text from previous render
    dataGroup.selectAll('text').remove();
    dataGroup.selectAll('rect.selected-bg').remove();
    
    // Render circles (original behavior)
    const circles = dataGroup.selectAll('circle')
      .data(nodes, d => d.data.label);

    // In selection mode, check if this dot is a selected location
    const isSelectedLocation = (d) => {
      if (!inSelectionMode) return d.data.label === window.appState.selectedCountry;
      return getSelectionModeColor(d.data.label) !== null;
    };
    
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
    .attr('r', d => inSelectionMode ? d.r : (isSelectedLocation(d) ? d.r + 1.5 : d.r))
    .attr('fill', d => getDotColor(d))
    .attr('stroke', d => inSelectionMode ? '#ffffff' : (isSelectedLocation(d) ? '#0f172a' : '#ffffff'))
    .attr('stroke-width', d => inSelectionMode ? 1 : (isSelectedLocation(d) ? 2 : 1))
    .attr('opacity', d => inSelectionMode && !isSelectedLocation(d) ? 0.5 : 0.92)
    .each(function(d) {
      // Store original color as data attribute for right-click
      d3.select(this).attr('data-original-color', inSelectionMode ? getDotColor(d) : colorScale(d.data.category));
    });

  circles.exit().remove();

  const allCircles = enteringCircles.merge(circles);

  allCircles.transition()
    .duration(600)
    .ease(d3.easeQuadOut)
    .attr('cx', d => Math.max(plotPaddingLeft, Math.min(width - plotPaddingRight, d.x)))
    .attr('cy', d => Math.max(plotPaddingTop, Math.min(height - plotPaddingBottom, d.y)))
    .attr('r', d => inSelectionMode ? d.r : (isSelectedLocation(d) ? d.r + 1.5 : d.r))
    .attr('fill', d => getDotColor(d))
    .attr('stroke', d => inSelectionMode ? '#ffffff' : (isSelectedLocation(d) ? '#0f172a' : '#ffffff'))
    .attr('stroke-width', d => inSelectionMode ? 1 : (isSelectedLocation(d) ? 2 : 1))
    .attr('opacity', d => inSelectionMode && !isSelectedLocation(d) ? 0.5 : 0.92);
  
  // Update data-original-color for all circles
  allCircles.each(function(d) {
    d3.select(this).attr('data-original-color', inSelectionMode ? getDotColor(d) : colorScale(d.data.category));
  });

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
      // Smart positioning: if tooltip would be hidden by header (first ~80px), show it below cursor instead
      const tooltipTop = evt.offsetY - 48;
      const adjustedTop = tooltipTop < 80 ? evt.offsetY + 20 : tooltipTop;
      tooltip.html(htmlParts.join('<br>'))
        .classed('hidden', false)
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', adjustedTop + 'px')
        .style('user-select', 'none');
      d3.select(this)
        .attr('stroke', '#111827')
        .attr('stroke-width', 2.5)
        .attr('r', d.r + 2.5);
    })
    .on('mousemove', function(evt) {
      // Smart positioning: if tooltip would be hidden by header (first ~80px), show it below cursor instead
      const tooltipTop = evt.offsetY - 48;
      const adjustedTop = tooltipTop < 80 ? evt.offsetY + 20 : tooltipTop;
      tooltip
        .style('left', (evt.offsetX + 32) + 'px')
        .style('top', adjustedTop + 'px');
    })
    .on('click', function(evt, d) {
      const newSelection = d.data.label;
      if (!newSelection) return;
      
      // In selection mode, handle shift+click for add/remove
      if (inSelectionMode) {
        const locations = window.appState.selectionModeLocations || [];
        
        if (evt.shiftKey) {
          // Shift+click: add or remove from selection
          const existingIndex = locations.findIndex(loc => loc.location === newSelection);
          
          if (existingIndex >= 0) {
            // Already selected - remove it
            locations.splice(existingIndex, 1);
            
            // Adjust active index if needed
            if (window.appState.selectionModeActiveIndex >= locations.length) {
              window.appState.selectionModeActiveIndex = Math.max(0, locations.length - 1);
            }
            
            // Update selectedCountry to the active row's location
            if (locations.length > 0) {
              const activeIdx = window.appState.selectionModeActiveIndex;
              if (locations[activeIdx] && locations[activeIdx].location) {
                window.appState.selectedCountry = locations[activeIdx].location;
              }
            } else {
              window.appState.selectedCountry = '';
            }
          } else {
            // Not selected - add it with a new color
            if (typeof window.addSelectionRow === 'function') {
              window.addSelectionRow(newSelection);
            }
            window.appState.selectedCountry = newSelection;
          }
          
          if (typeof window.renderSelectionTable === 'function') {
            window.renderSelectionTable();
          }
        } else {
          // Normal click: update the active row's location, or add if empty
          const activeIdx = window.appState.selectionModeActiveIndex || 0;
          if (locations.length === 0) {
            // No selections yet - add this as the first one
            if (typeof window.addSelectionRow === 'function') {
              window.addSelectionRow(newSelection);
            }
          } else if (locations[activeIdx]) {
            locations[activeIdx].location = newSelection;
          }
          if (typeof window.renderSelectionTable === 'function') {
            window.renderSelectionTable();
          }
          window.appState.selectedCountry = newSelection;
        }
      } else {
        window.appState.selectedCountry = newSelection;
      }
      
      const selectEl = document.getElementById('countrySelect');
      if (selectEl) {
        const exists = Array.from(selectEl.options).some(o => o.value === newSelection);
        if (exists) selectEl.value = window.appState.selectedCountry;
      }
      window.calculatePercentiles(window.appState.selectedCountry);
      window.updateCountryInfo();
      if (typeof window.renderCategoryMetricListFinal === 'function') {
        window.renderCategoryMetricListFinal();
      }
      if (window.appState.categorySelectedMetricKey) {
        window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
      } else {
        window.renderBeeswarmCategoryFinal(metricKey);
      }
    })
    .on('mouseleave', function(evt, d) {
      tooltip.classed('hidden', true);
      const isSelected = isSelectedLocation(d);
      d3.select(this)
        .attr('stroke', inSelectionMode ? '#ffffff' : (isSelected ? '#0f172a' : '#ffffff'))
        .attr('stroke-width', inSelectionMode ? 1 : (isSelected ? 2 : 1))
        .attr('r', inSelectionMode ? d.r : (isSelected ? d.r + 1.5 : d.r));
    })
    .on('contextmenu', function(evt, d) {
      const originalColor = d3.select(this).attr('data-original-color');
      const currentEffectiveColor = inSelectionMode ? getDotColor(d) : getEffectiveColor(originalColor);
      showColorInputBox(evt, originalColor, currentEffectiveColor, () => {
        // In selection mode, update the location's color directly
        if (inSelectionMode) {
          const locations = window.appState.selectionModeLocations || [];
          const loc = locations.find(l => l.location === d.data.label);
          if (loc) {
            const newColor = window.appState.beeswarmColorOverrides[originalColor];
            if (newColor) {
              loc.color = newColor;
              delete window.appState.beeswarmColorOverrides[originalColor];
            }
          }
          if (typeof window.renderSelectionTable === 'function') {
            window.renderSelectionTable();
          }
        }
        // Re-render to apply the new colors
        if (window.appState.categorySelectedMetricKey) {
          window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
        }
      }, d.data.label);
    });
  } // End of hasTextEncoding conditional

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
      hoverLabel.style.userSelect = 'none';
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
      const originalColor = colorScale(cat);
      row.append('rect')
        .attr('x', legendX)
        .attr('y', -9)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', getEffectiveColor(originalColor))
        .attr('stroke', '#334155')
        .attr('stroke-width', 0.5)
        .attr('data-original-color', originalColor)
        .style('cursor', 'pointer')
        .on('contextmenu', function(evt) {
          const origColor = d3.select(this).attr('data-original-color');
          const currentEffectiveColor = getEffectiveColor(origColor);
          showColorInputBox(evt, origColor, currentEffectiveColor, () => {
            // Re-render to apply the new colors
            if (window.appState.categorySelectedMetricKey) {
              window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
            }
          });
        });
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
    .style('user-select', 'none')
    .text(window.formatMetricName(metricKey));
  
  // Store values for box plot overlay if needed
  window._beeswarmPlotData = {
    y: y,
    xCenter: xCenter,
    sortedVals: sortedVals,
    plotPaddingLeft: plotPaddingLeft,
    plotPaddingRight: plotPaddingRight,
    plotPaddingTop: plotPaddingTop,
    plotPaddingBottom: plotPaddingBottom,
    width: width,
    height: height
  };
}

// Box plot overlay function - draws semitransparent box plot on top of beeswarm
function renderBoxPlotOverlay(metricKey) {
  const svg = d3.select('#beeswarm-svg');
  if (!svg.node()) return;
  
  // Get plot data from the beeswarm render
  const plotData = window._beeswarmPlotData;
  if (!plotData) return;
  
  const { y, xCenter, sortedVals, plotPaddingLeft, plotPaddingRight, plotPaddingTop, plotPaddingBottom, width, height } = plotData;
  
  if (!sortedVals || sortedVals.length === 0) return;
  
  // Compute quartiles and whiskers using 1.5*IQR rule for extremes
  const q1 = d3.quantileSorted(sortedVals, 0.25);
  const median = d3.quantileSorted(sortedVals, 0.5);
  const q3 = d3.quantileSorted(sortedVals, 0.75);
  const iqr = (q3 - q1);
  const lowerWhiskerVal = sortedVals.find(v => v >= (q1 - 1.5 * iqr)) ?? sortedVals[0];
  const upperWhiskerVal = [...sortedVals].reverse().find(v => v <= (q3 + 1.5 * iqr)) ?? sortedVals[sortedVals.length - 1];
  
  const boxWidth = 80;
  
  // Remove any existing box plot overlay elements
  svg.selectAll('.box-plot-overlay').remove();
  
  // Create a group for the box plot overlay
  const overlayGroup = svg.append('g').attr('class', 'box-plot-overlay');
  
  // Lower whisker line (from lower extreme to bottom of box)
  overlayGroup.append('line')
    .attr('x1', xCenter)
    .attr('x2', xCenter)
    .attr('y1', y(lowerWhiskerVal))  // Lower extreme (bottom)
    .attr('y2', y(q1) + 2)           // Stop just before bottom of box
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2)
    .attr('opacity', 0.6)
    .attr('pointer-events', 'none');
  
  // Upper whisker line (from top of box to upper extreme)
  overlayGroup.append('line')
    .attr('x1', xCenter)
    .attr('x2', xCenter)
    .attr('y1', y(q3) - 2)           // Start just after top of box
    .attr('y2', y(upperWhiskerVal))  // Upper extreme (top)
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2)
    .attr('opacity', 0.6)
    .attr('pointer-events', 'none');
  
  // Box (Q1 to Q3) - semitransparent
  overlayGroup.append('rect')
    .attr('x', xCenter - boxWidth / 2)
    .attr('y', y(q3))
    .attr('width', boxWidth)
    .attr('height', Math.max(1, y(q1) - y(q3)))
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', '#94a3b8')
    .attr('fill-opacity', 0.3)
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.7)
    .attr('pointer-events', 'none');
  
  // Median line (horizontal line at median value, across the box width)
  overlayGroup.append('line')
    .attr('x1', xCenter - boxWidth / 2)
    .attr('x2', xCenter + boxWidth / 2)
    .attr('y1', y(median))
    .attr('y2', y(median))
    .attr('stroke', '#1e293b')
    .attr('stroke-width', 2)
    .attr('opacity', 0.8)
    .attr('pointer-events', 'none');
  
  // Whisker caps at extremes
  overlayGroup.append('line')
    .attr('x1', xCenter - boxWidth / 4)
    .attr('x2', xCenter + boxWidth / 4)
    .attr('y1', y(lowerWhiskerVal))
    .attr('y2', y(lowerWhiskerVal))
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2)
    .attr('opacity', 0.6)
    .attr('pointer-events', 'none');
  
  overlayGroup.append('line')
    .attr('x1', xCenter - boxWidth / 4)
    .attr('x2', xCenter + boxWidth / 4)
    .attr('y1', y(upperWhiskerVal))
    .attr('y2', y(upperWhiskerVal))
    .attr('stroke', '#64748b')
    .attr('stroke-width', 2)
    .attr('opacity', 0.6)
    .attr('pointer-events', 'none');
}

window.renderBeeswarmCategoryFinal = renderBeeswarmCategoryFinal;
window.showColorInputBox = showColorInputBox;
window.isValidHexColor = isValidHexColor;
window.getSelectionModeColor = getSelectionModeColor;
window.highlightBeeswarmElement = highlightBeeswarmElement;
window.selectRecord = selectRecord;

// Cleanup function to remove checkbox when switching views
function cleanupFinalViewBeeswarmCheckbox() {
  const existingCheckbox = document.getElementById('box-plot-mode-checkbox-container');
  if (existingCheckbox) {
    existingCheckbox.remove();
  }
}

window.cleanupFinalViewBeeswarmCheckbox = cleanupFinalViewBeeswarmCheckbox;


