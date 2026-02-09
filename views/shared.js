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
  filterSelectFilteredRows: [],
  outlierDataComputed: false, // Track if outlier data has been computed
  // Centralized derived data cache (computed once per dataset)
  derivedDataCache: {
    computed: false,
    records: [] // Array of {recordName, hIndexScore, summationScore, outliers, percentiles}
  }
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

/**
 * Compute all derived data (percentiles, h-index, summation, outliers) for all records.
 * This is called once per dataset and cached.
 */
function computeAllDerivedData() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) {
    window.appState.derivedDataCache = { computed: true, records: [] };
    return;
  }

  console.log('[DERIVED DATA] Computing all derived data for dataset...');

  // Get numeric metrics (exclude FIPS codes)
  const metrics = (typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [])
    .filter(m => {
      const norm = (m || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm !== 'fipscode';
    });

  if (metrics.length === 0) {
    window.appState.derivedDataCache = { computed: true, records: [] };
    return;
  }

  const data = window.appState.jsonData;
  
  // Determine record identifier column
  let idColumn;
  if (window.appState.geoMode === 'country') {
    idColumn = 'Country';
  } else if (window.appState.geoMode === 'county') {
    idColumn = '__displayName';
  } else {
    idColumn = window.appState.dataColumn;
  }

  const records = [];

  data.forEach(record => {
    const recordName = record[idColumn] || 'Unknown';
    
    // Calculate percentiles for this record
    const percentiles = [];
    metrics.forEach(metric => {
      const value = record[metric];
      
      // Skip invalid values
      if (value === '..' || value === undefined || value === null) return;
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) return;

      // Get all valid values for this metric
      const validValues = data
        .map(d => d[metric])
        .filter(v => v !== '..' && v !== undefined && v !== null)
        .map(v => typeof v === 'number' ? v : parseFloat(v))
        .filter(v => !isNaN(v));

      if (validValues.length < 3) return;

      // Calculate percentile
      validValues.sort((a, b) => a - b);
      const smaller = validValues.filter(v => v < numValue).length;
      const equal = validValues.filter(v => v === numValue).length;
      const percentile = Math.round((smaller + 0.5 * equal) / validValues.length * 100);

      percentiles.push({
        metricKey: metric,
        percentile: percentile,
        value: numValue
      });
    });

    // Compute H-index score
    const hIndexScore = computeHIndexScore(percentiles);

    // Compute Summation score
    const summationScore = computeSummationScore(percentiles);

    // Compute outliers (top 5% or bottom 5%)
    const outliers = [];
    percentiles.forEach(({ metricKey, percentile, value }) => {
      if (percentile <= 5) {
        outliers.push({ metric: metricKey, position: 'bottom', percentile, value });
      } else if (percentile >= 95) {
        outliers.push({ metric: metricKey, position: 'top', percentile, value });
      }
    });

    records.push({
      recordName,
      hIndexScore,
      summationScore,
      outliers,
      percentiles
    });
  });

  window.appState.derivedDataCache = {
    computed: true,
    records: records
  };

  console.log('[DERIVED DATA] Computed data for', records.length, 'records');
}

/**
 * Compute H-index score from percentiles
 */
function computeHIndexScore(percentiles) {
  const pctValues = (percentiles || [])
    .map(d => d?.percentile)
    .filter(p => typeof p === 'number' && isFinite(p) && p >= 0 && p <= 100);

  let best = null;
  for (let k = 1; k <= 50; k++) {
    let count = 0;
    for (const p of pctValues) {
      if (Math.abs(p - 50) >= k) count++;
    }
    if (count > k) best = k;
  }
  return best;
}

/**
 * Compute Summation score from percentiles
 */
function computeSummationScore(percentiles) {
  const values = (percentiles || [])
    .map(d => d?.percentile)
    .filter(p => typeof p === 'number' && isFinite(p) && p >= 0 && p <= 100);

  const N = values.length;
  if (N === 0) return null;

  // Distances from 50
  const distances = values.map(p => Math.abs(p - 50));

  const ks = [49.9, 49, 45, 40, 35, 30, 25, 20, 15, 10, 5, 1];
  let prevK = Infinity;
  let totalScore = 0;

  ks.forEach(k => {
    const inBand = distances.filter(d => d >= k && d < prevK).length;
    const pct = inBand / N;
    const score = k * pct;
    totalScore += score;
    prevK = k;
  });

  return totalScore;
}

window.computeAllDerivedData = computeAllDerivedData;

