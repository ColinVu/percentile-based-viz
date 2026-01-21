/**
 * Shared utilities and state management
 * This file contains code shared across all views
 */

// Global state variables (accessible across all views)
window.appState = {
  jsonData: [],
  entities: [],
  currentPercentiles: {},
  selectedCountry: '',
  geoMode: 'country', // 'country' or 'county' or 'custom'
  dataColumn: null, // The column to use as the main identifier (e.g., 'Country', 'County', or custom)
  selectedDataColumn: null, // The column selected by the user for custom datasets
  scroller: null,
  viewMode: 'category-final', // Default to Faxis mode. Old modes: 'percentile' | 'identifier' | 'category' | 'category-v2' | 'category-v3' | 'box' | 'category-v8'
  categorySelectedMetricKey: null,
  categorySnapPoints: [],
  previousBeeswarmNodes: [], // Store previous node positions for smooth transitions
  nominalColumns: [],
  categoryEncodedField: '',
  multiSelectedLabels: [],
  filterSelectFilters: [],
  filterSelectFilteredRows: []
};

// Format metric names for display
function formatMetricName(metric) {
  return metric
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/([0-9]+)/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Color interpolation function for percentile-based gradient
function getPercentileColor(percentile) {
  // Handle missing percentiles (return neutral gray)
  if (percentile < 0 || percentile > 100) {
    return '#888888';
  }
  
  // Define color stops: blue (0%) -> white (50%) -> orange (100%)
  const blue = { r: 59, g: 130, b: 246 };   // #3b82f6
  const white = { r: 255, g: 255, b: 255 }; // #ffffff
  const orange = { r: 249, g: 115, b: 22 }; // #f97316
  
  let color1, color2, ratio;
  
  if (percentile <= 50) {
    // Interpolate between blue and white (0% to 50%)
    color1 = blue;
    color2 = white;
    ratio = percentile / 50;
  } else {
    // Interpolate between white and orange (50% to 100%)
    color1 = white;
    color2 = orange;
    ratio = (percentile - 50) / 50;
  }
  
  // Linear interpolation
  const r = Math.round(color1.r + (color2.r - color1.r) * ratio);
  const g = Math.round(color1.g + (color2.g - color1.g) * ratio);
  const b = Math.round(color1.b + (color2.b - color1.b) * ratio);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Create gradient stops for CSS gradient based on percentile distribution
function createPercentileGradient(percentiles) {
  if (!percentiles || percentiles.length === 0) return '';
  
  // Sort percentiles to get ordered distribution
  const sortedPercents = percentiles.slice().sort((a, b) => b - a); // Sort descending (high to low)
  const gradientStops = [];
  
  sortedPercents.forEach((percent, index) => {
    // Calculate position (0 to 1) based on sorted order
    const position = percentiles.length > 1 ? index / (percentiles.length - 1) : 0;
    const color = getPercentileColor(percent);
    gradientStops.push(`${color} ${Math.round(position * 100)}%`);
  });
  
  return `linear-gradient(to bottom, ${gradientStops.join(', ')})`;
}

// Calculate percentiles for a selected entity
function calculatePercentiles(entityLabel) {
  let entityData = null;
  if (window.appState.geoMode === 'country') {
    entityData = window.appState.jsonData.find(d => d.Country === entityLabel);
  } else if (window.appState.geoMode === 'county') {
    entityData = window.appState.jsonData.find(d => {
      const label = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
      return label === entityLabel;
    });
  } else {
    // Custom column mode
    const dataColumn = window.appState.dataColumn;
    entityData = window.appState.jsonData.find(d => String(d[dataColumn]).trim() === entityLabel);
  }
  if (!entityData) return;
  
  // Get all metrics (skip identifier columns)
  let idCols = [];
  if (window.appState.geoMode === 'country') {
    idCols = ['Country'];
  } else if (window.appState.geoMode === 'county') {
    idCols = ['County', 'State', '__displayName'];
  } else {
    // Custom mode - skip the data column
    idCols = [window.appState.dataColumn];
  }
  const metrics = Object.keys(entityData).filter(key => !idCols.includes(key));
  
  // Calculate percentile for each metric
  window.appState.currentPercentiles = {};
  
  metrics.forEach(metric => {
    // Skip missing values
    if (entityData[metric] === '..' || entityData[metric] === undefined || entityData[metric] === null) {
      return;
    }
    
    const value = typeof entityData[metric] === 'number' ? entityData[metric] : parseFloat(entityData[metric]);
    if (isNaN(value)) return;
    
    // Get all valid numeric values for this metric across all entities
    const validValues = window.appState.jsonData
      .filter(d => d[metric] !== '..' && d[metric] !== undefined && d[metric] !== null)
      .map(d => (typeof d[metric] === 'number' ? d[metric] : parseFloat(d[metric])))
      .filter(v => !isNaN(v));
    
    if (validValues.length < 3) return; // Need at least 3 observations for comparison
    
    // Sort values
    validValues.sort((a, b) => a - b);
    
    // Calculate percentile rank
    const smaller = validValues.filter(v => v < value).length;
    const equal = validValues.filter(v => v === value).length;
    const percentile = Math.round((smaller + 0.5 * equal) / validValues.length * 100);
    
    window.appState.currentPercentiles[metric] = {
      value,
      percentile
    };
  });
}

// Build list of numeric metrics
function getNumericMetrics() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return [];
  const sample = window.appState.jsonData[0];
  let idCols = [];
  if (window.appState.geoMode === 'country') {
    idCols = ['Country'];
  } else if (window.appState.geoMode === 'county') {
    idCols = ['County', 'State', '__displayName'];
  } else {
    // Custom mode
    idCols = [window.appState.dataColumn];
  }
  const keys = Object.keys(sample).filter(k => !idCols.includes(k));
  const numericMetrics = keys.filter(key => {
    return window.appState.jsonData.some(d => d[key] !== '..' && d[key] !== undefined && d[key] !== null && !isNaN(parseFloat(d[key])));
  });
  return numericMetrics;
}

// Build list of nominal (categorical) columns
function getNominalColumns() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return [];
  const sample = window.appState.jsonData[0];
  const exclusionCols = new Set(['__displayName']);
  const keys = Object.keys(sample).filter(k => !exclusionCols.has(k));
  const nominalKeys = keys.filter(key => {
    // Skip numeric metrics (requires at least one truly non-numeric value)
    let hasCategoricalValue = false;
    let encounteredValidValue = false;
    for (const row of window.appState.jsonData) {
      const raw = row[key];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === 'string' && raw.trim() === '') continue;
      if (raw === '..') continue;
      encounteredValidValue = true;
      if (typeof raw === 'boolean') {
        hasCategoricalValue = true;
        break;
      }
      const valueStr = String(raw).trim();
      if (valueStr === '') continue;
      if (isNaN(Number(valueStr))) {
        hasCategoricalValue = true;
        break;
      }
    }
    return encounteredValidValue && hasCategoricalValue;
  });
  return nominalKeys;
}

// Format values based on metric type
function formatValue(value, metric) {
  // Apply specific formatting based on metric name
  if (metric.includes('national_income') || metric.includes('Income') || metric.includes('GDP')) {
    return '$' + value.toLocaleString();
  } else if (metric.includes('Pct') || metric.includes('percent') || metric.includes('Percent')) {
    return value.toFixed(1) + '%';
  } else if (metric.endsWith('rate') || metric.endsWith('Rate')) {
    return value.toFixed(2);
  } else if (value >= 1000) {
    return value.toLocaleString();
  } else if (Number.isInteger(value)) {
    return value.toString();
  } else {
    return value.toFixed(2);
  }
}

// Update selected entity display
function updateCountryInfo() {
  document.getElementById('country-name').textContent = window.appState.selectedCountry;
}

// Export functions to window for global access
window.formatMetricName = formatMetricName;
window.getPercentileColor = getPercentileColor;
window.createPercentileGradient = createPercentileGradient;
window.calculatePercentiles = calculatePercentiles;
window.getNumericMetrics = getNumericMetrics;
window.getNominalColumns = getNominalColumns;
window.formatValue = formatValue;
window.updateCountryInfo = updateCountryInfo;

