/**
 * Map Panel for Final View
 * Displays US counties map colored by selection colors
 */

// Store the loaded map data
let usCountiesData = null;
let worldCountriesData = null;
let countryLookupData = null;
let isLoadingMap = false;

// Detect if dataset has FIPS code column
function detectFIPSColumn() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);
  const fipsCol = columns.find(col => /^fips[_\s]?code$/i.test(col) || /^fips$/i.test(col));
  return fipsCol || null;
}

// Detect if dataset has Country Code column
function detectCountryCodeColumn() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);
  const countryCodeCol = columns.find(col => /^country[_\s]?code$/i.test(col) || /^countrycode$/i.test(col));
  return countryCodeCol || null;
}

// Detect if dataset has Latitude/Longitude columns
function detectLatLongColumns() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);
  
  // Check for Latitude/Longitude
  const latCol = columns.find(col => /^latitude$/i.test(col) || /^lat$/i.test(col) || /^y$/i.test(col));
  const longCol = columns.find(col => /^longitude$/i.test(col) || /^long$/i.test(col) || /^x$/i.test(col));
  
  if (latCol && longCol) {
    return { lat: latCol, long: longCol };
  }
  return null;
}

// Fallback country lookup for common countries (Alpha3 -> Numeric)
const FALLBACK_COUNTRY_LOOKUP = [
  { Alpha3: 'USA', Numeric: '840' },
  { Alpha3: 'CAN', Numeric: '124' },
  { Alpha3: 'MEX', Numeric: '484' },
  { Alpha3: 'GBR', Numeric: '826' },
  { Alpha3: 'FRA', Numeric: '250' },
  { Alpha3: 'DEU', Numeric: '276' },
  { Alpha3: 'ITA', Numeric: '380' },
  { Alpha3: 'ESP', Numeric: '724' },
  { Alpha3: 'JPN', Numeric: '392' },
  { Alpha3: 'CHN', Numeric: '156' },
  { Alpha3: 'IND', Numeric: '356' },
  { Alpha3: 'BRA', Numeric: '76' },
  { Alpha3: 'AUS', Numeric: '36' },
  { Alpha3: 'RUS', Numeric: '643' },
  { Alpha3: 'ZAF', Numeric: '710' },
  { Alpha3: 'KOR', Numeric: '410' },
  { Alpha3: 'ARG', Numeric: '32' },
  { Alpha3: 'NLD', Numeric: '528' },
  { Alpha3: 'BEL', Numeric: '56' },
  { Alpha3: 'CHE', Numeric: '756' },
  { Alpha3: 'SWE', Numeric: '752' },
  { Alpha3: 'NOR', Numeric: '578' },
  { Alpha3: 'DNK', Numeric: '208' },
  { Alpha3: 'FIN', Numeric: '246' },
  { Alpha3: 'POL', Numeric: '616' },
  { Alpha3: 'TUR', Numeric: '792' },
  { Alpha3: 'SAU', Numeric: '682' },
  { Alpha3: 'EGY', Numeric: '818' },
  { Alpha3: 'NGA', Numeric: '566' },
  { Alpha3: 'KEN', Numeric: '404' },
  { Alpha3: 'IDN', Numeric: '360' },
  { Alpha3: 'THA', Numeric: '764' },
  { Alpha3: 'VNM', Numeric: '704' },
  { Alpha3: 'PHL', Numeric: '608' },
  { Alpha3: 'MYS', Numeric: '458' },
  { Alpha3: 'SGP', Numeric: '702' },
  { Alpha3: 'NZL', Numeric: '554' },
  { Alpha3: 'CHL', Numeric: '152' },
  { Alpha3: 'COL', Numeric: '170' },
  { Alpha3: 'PER', Numeric: '604' },
  { Alpha3: 'VEN', Numeric: '862' }
];

// Load country lookup table
async function loadCountryLookup() {
  if (countryLookupData) return countryLookupData;
  
  try {
    const response = await fetch('countryLookUp.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    countryLookupData = XLSX.utils.sheet_to_json(worksheet);
    return countryLookupData;
  } catch (error) {
    console.error('Failed to load country lookup, using fallback:', error);
    console.warn('For full country coverage, run this app on a local server (e.g., python -m http.server)');
    return FALLBACK_COUNTRY_LOOKUP;
  }
}

// Get FIPS code for a location label
function getFIPSForLocation(label) {
  const fipsCol = detectFIPSColumn();
  if (!fipsCol || !window.appState.jsonData) return null;
  
  const row = window.appState.jsonData.find(d => {
    let rowLabel;
    if (window.appState.geoMode === 'country') {
      rowLabel = d.Country;
    } else if (window.appState.geoMode === 'county') {
      rowLabel = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
    } else {
      rowLabel = d[window.appState.dataColumn];
    }
    return rowLabel === label;
  });
  
  if (!row) return null;
  
  let fips = row[fipsCol];
  if (fips === undefined || fips === null || fips === '..') return null;
  
  // Ensure FIPS is a 5-digit string
  fips = String(fips).padStart(5, '0');
  return fips;
}

// Get country numeric code for a location label using the lookup table
async function getCountryCodeForLocation(label) {
  const countryCodeCol = detectCountryCodeColumn();
  if (!countryCodeCol || !window.appState.jsonData) return null;
  
  const row = window.appState.jsonData.find(d => {
    let rowLabel;
    if (window.appState.geoMode === 'country') {
      rowLabel = d.Country;
    } else if (window.appState.geoMode === 'county') {
      rowLabel = d.__displayName || `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`;
    } else {
      rowLabel = d[window.appState.dataColumn];
    }
    return rowLabel === label;
  });
  
  if (!row) return null;
  
  const countryCode = row[countryCodeCol]; // Alpha3 code
  if (!countryCode || countryCode === '..') return null;
  
  // Look up numeric code from lookup table
  const lookup = await loadCountryLookup();
  if (!lookup) return null;
  
  const lookupRow = lookup.find(l => l.Alpha3 === countryCode);
  return lookupRow ? String(lookupRow.Numeric) : null;
}

// Get color for a FIPS code based on current visualization state
function getColorForFIPS(fipsCode) {
  const inSelectionMode = window.appState.encodingMode === 'selection' && 
                          window.appState.viewMode === 'category-final';
  
  if (inSelectionMode) {
    // Check if this FIPS is in the selected locations
    const locations = window.appState.selectionModeLocations || [];
    for (const loc of locations) {
      const locFips = getFIPSForLocation(loc.location);
      if (locFips === fipsCode) {
        return loc.color;
      }
    }
    return '#e2e8f0'; // Light grey for unselected
  } else {
    // Feature encoding mode - use the encoding field colors
    const encodingField = window.appState.categoryEncodedField;
    if (!encodingField || !window.appState.jsonData) return '#e2e8f0';
    
    // Find the row with this FIPS code
    const fipsCol = detectFIPSColumn();
    if (!fipsCol) return '#e2e8f0';
    
    const row = window.appState.jsonData.find(r => {
      let rowFips = r[fipsCol];
      if (rowFips === undefined || rowFips === null || rowFips === '..') return false;
      rowFips = String(rowFips).padStart(5, '0');
      return rowFips === fipsCode;
    });
    
    if (!row) return '#e2e8f0';
    
    // Get the category value for this row
    const rawCategory = row[encodingField];
    const fallbackCategory = 'Not specified';
    let categoryValue = fallbackCategory;
    if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '..') {
      const catStr = String(rawCategory).trim();
      categoryValue = catStr === '' ? fallbackCategory : catStr;
    }
    
    // Create color scale (same as beeswarm)
    const categories = Array.from(new Set(window.appState.jsonData.map(r => {
      const rc = r[encodingField];
      if (rc === undefined || rc === null || rc === '..') return fallbackCategory;
      const cs = String(rc).trim();
      return cs === '' ? fallbackCategory : cs;
    })));
    
    const colorScale = d3.scaleOrdinal()
      .domain(categories)
      .range(categories.map((_, idx) => {
        if (categories.length === 1) return d3.interpolateRainbow(0.35);
        return d3.interpolateRainbow(idx / categories.length);
      }));
    
    const baseColor = colorScale(categoryValue);
    // Apply color overrides
    const overrides = window.appState.beeswarmColorOverrides || {};
    return overrides[baseColor] || baseColor;
  }
}

// Get color for a country code (same logic as FIPS)
async function getColorForCountryCode(countryNumericCode, row) {
  const inSelectionMode = window.appState.encodingMode === 'selection' && 
                          window.appState.viewMode === 'category-final';
  
  if (inSelectionMode) {
    const locations = window.appState.selectionModeLocations || [];
    for (const loc of locations) {
      const locCode = await getCountryCodeForLocation(loc.location);
      if (locCode === countryNumericCode) {
        return loc.color;
      }
    }
    return '#e2e8f0';
  } else {
    // Feature encoding mode - use the encoding field colors
    const encodingField = window.appState.categoryEncodedField;
    if (!encodingField || !row) return '#e2e8f0';
    
    // Get the category value for this row
    const rawCategory = row[encodingField];
    const fallbackCategory = 'Not specified';
    let categoryValue = fallbackCategory;
    if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '..') {
      const catStr = String(rawCategory).trim();
      categoryValue = catStr === '' ? fallbackCategory : catStr;
    }
    
    // Create color scale (same as beeswarm)
    const categories = Array.from(new Set(window.appState.jsonData.map(r => {
      const rc = r[encodingField];
      if (rc === undefined || rc === null || rc === '..') return fallbackCategory;
      const cs = String(rc).trim();
      return cs === '' ? fallbackCategory : cs;
    })));
    
    const colorScale = d3.scaleOrdinal()
      .domain(categories)
      .range(categories.map((_, idx) => {
        if (categories.length === 1) return d3.interpolateRainbow(0.35);
        return d3.interpolateRainbow(idx / categories.length);
      }));
    
    const baseColor = colorScale(categoryValue);
    // Apply color overrides
    const overrides = window.appState.beeswarmColorOverrides || {};
    return overrides[baseColor] || baseColor;
  }
}

// Load US counties TopoJSON
async function loadUSCountiesMap() {
  if (usCountiesData) return usCountiesData;
  if (isLoadingMap) {
    // Wait for existing load
    while (isLoadingMap) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return usCountiesData;
  }
  
  isLoadingMap = true;
  try {
    const url = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';
    usCountiesData = await d3.json(url);
    isLoadingMap = false;
    return usCountiesData;
  } catch (error) {
    console.error('Failed to load US map:', error);
    isLoadingMap = false;
    return null;
  }
}

// Load world countries TopoJSON
async function loadWorldCountriesMap() {
  if (worldCountriesData) return worldCountriesData;
  
  try {
    const url = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
    worldCountriesData = await d3.json(url);
    return worldCountriesData;
  } catch (error) {
    console.error('Failed to load world map:', error);
    return null;
  }
}

// Shared click handler for both US and world maps
function handleLocationClick(label, evt) {
  const inSelectionMode = window.appState.encodingMode === 'selection' && 
                          window.appState.viewMode === 'category-final';
  
  if (inSelectionMode) {
    const locations = window.appState.selectionModeLocations || [];
    
    if (evt.shiftKey) {
      const existingIndex = locations.findIndex(loc => loc.location === label);
      
      if (existingIndex >= 0) {
        locations.splice(existingIndex, 1);
        if (window.appState.selectionModeActiveIndex >= locations.length) {
          window.appState.selectionModeActiveIndex = Math.max(0, locations.length - 1);
        }
        if (locations.length > 0) {
          const activeIdx = window.appState.selectionModeActiveIndex;
          if (locations[activeIdx] && locations[activeIdx].location) {
            window.appState.selectedCountry = locations[activeIdx].location;
          }
        } else {
          window.appState.selectedCountry = '';
        }
      } else {
        if (typeof window.addSelectionRow === 'function') {
          window.addSelectionRow(label);
        }
        window.appState.selectedCountry = label;
      }
      
      if (typeof window.renderSelectionTable === 'function') {
        window.renderSelectionTable();
      }
    } else {
      const activeIdx = window.appState.selectionModeActiveIndex || 0;
      if (locations.length === 0) {
        if (typeof window.addSelectionRow === 'function') {
          window.addSelectionRow(label);
        }
      } else if (locations[activeIdx]) {
        locations[activeIdx].location = label;
      }
      if (typeof window.renderSelectionTable === 'function') {
        window.renderSelectionTable();
      }
      window.appState.selectedCountry = label;
    }
  } else {
    window.appState.selectedCountry = label;
  }
  
  const selectEl = document.getElementById('countrySelect');
  if (selectEl) {
    const exists = Array.from(selectEl.options).some(o => o.value === label);
    if (exists) selectEl.value = window.appState.selectedCountry;
  }
  window.calculatePercentiles(window.appState.selectedCountry);
  window.updateCountryInfo();
  if (typeof window.renderCategoryMetricListFinal === 'function') {
    window.renderCategoryMetricListFinal();
  }
  if (window.appState.categorySelectedMetricKey && typeof window.renderBeeswarmCategoryFinal === 'function') {
    window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
  }
  renderMapPanel();
}

// Render lat/long map with dots
async function renderLatLongMap(svgElement, width, height) {
  const mapData = await loadWorldCountriesMap();
  const latLongCols = detectLatLongColumns();
  
  if (!mapData || !latLongCols) {
    console.error('World map data or lat/long columns not available');
    return;
  }
  
  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  
  const countries = topojson.feature(mapData, mapData.objects.countries);
  const projection = d3.geoNaturalEarth1()
    .fitSize([width - 20, height - 20], countries);
  const path = d3.geoPath().projection(projection);
  
  // Background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');
  
  // Create a group for zoom/pan
  const g = svg.append('g');
  
  // Render world map as background
  g.append('g')
    .attr('class', 'countries')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#e2e8f0')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 0.5);
  
  // Render dots for each location
  const inSelectionMode = window.appState.encodingMode === 'selection' && 
                          window.appState.viewMode === 'category-final';
  
  // Setup for feature encoding mode
  const encodingField = window.appState.categoryEncodedField;
  const hasEncodingField = !inSelectionMode && encodingField && window.appState.jsonData.length > 0 && 
                           Object.prototype.hasOwnProperty.call(window.appState.jsonData[0], encodingField);
  const fallbackCategory = hasEncodingField ? 'Not specified' : 'All items';
  
  // Create color scale for feature mode (similar to beeswarm)
  let colorScale = null;
  if (hasEncodingField) {
    const categories = Array.from(new Set(window.appState.jsonData.map(row => {
      const rawCategory = row[encodingField];
      if (rawCategory === undefined || rawCategory === null || rawCategory === '..') return fallbackCategory;
      const catStr = String(rawCategory).trim();
      return catStr === '' ? fallbackCategory : catStr;
    })));
    
    colorScale = d3.scaleOrdinal()
      .domain(categories)
      .range(categories.map((_, idx) => {
        if (categories.length === 1 && (!hasEncodingField || !encodingField)) {
          return '#3498db';
        } else if (categories.length === 1) {
          return d3.interpolateRainbow(0.35);
        }
        return d3.interpolateRainbow(idx / categories.length);
      }));
  }
  
  const dots = [];
  window.appState.jsonData.forEach(row => {
    const lat = parseFloat(row[latLongCols.lat]);
    const long = parseFloat(row[latLongCols.long]);
    
    if (isNaN(lat) || isNaN(long)) return;
    
    // Get label
    let label;
    if (window.appState.geoMode === 'country') {
      label = row.Country;
    } else if (window.appState.geoMode === 'county') {
      label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
    } else {
      label = row[window.appState.dataColumn];
    }
    
    if (!label) return;
    
    // Get color
    let color = '#64748b'; // Default gray
    if (inSelectionMode) {
      const locations = window.appState.selectionModeLocations || [];
      const selectedLoc = locations.find(loc => loc.location === label);
      if (selectedLoc) {
        color = selectedLoc.color;
      }
    } else if (hasEncodingField && colorScale) {
      // Feature encoding mode - get category and color
      const rawCategory = row[encodingField];
      let categoryValue = fallbackCategory;
      if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '..') {
        const catStr = String(rawCategory).trim();
        categoryValue = catStr === '' ? fallbackCategory : catStr;
      }
      const baseColor = colorScale(categoryValue);
      // Apply color overrides if any
      const overrides = window.appState.beeswarmColorOverrides || {};
      color = overrides[baseColor] || baseColor;
    }
    
    const coords = projection([long, lat]);
    if (coords) {
      dots.push({ x: coords[0], y: coords[1], label, color, row });
    }
  });
  
  // Draw dots
  g.append('g')
    .attr('class', 'location-dots')
    .selectAll('circle')
    .data(dots)
    .join('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 4)
    .attr('fill', d => d.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('click', function(evt, d) {
      handleLocationClick(d.label, evt);
    })
    .on('mouseenter', function() {
      d3.select(this)
        .attr('r', 6)
        .attr('stroke-width', 1.5);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('r', 4)
        .attr('stroke-width', 0.5);
    });
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
}

// Render world countries map (reuses same structure as US map)
async function renderWorldMap(svgElement, width, height) {
  const mapData = await loadWorldCountriesMap();
  const lookup = await loadCountryLookup();
  if (!mapData) {
    console.error('World map data not available');
    return;
  }
  
  if (!lookup || lookup.length === 0) {
    console.error('Country lookup not available');
    return;
  }
  
  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  
  const countries = topojson.feature(mapData, mapData.objects.countries);
  const projection = d3.geoNaturalEarth1()
    .fitSize([width - 20, height - 20], countries);
  const path = d3.geoPath().projection(projection);
  
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');
  
  // Create a group for zoom/pan
  const g = svg.append('g');
  
  // Pre-calculate colors for all countries
  const countryCodeCol = detectCountryCodeColumn();
  const inSelectionMode = window.appState.encodingMode === 'selection' && 
                          window.appState.viewMode === 'category-final';
  const encodingField = window.appState.categoryEncodedField;
  const hasEncodingField = !inSelectionMode && encodingField && window.appState.jsonData.length > 0;
  
  // Create color scale for feature mode
  let colorScale = null;
  if (hasEncodingField) {
    const fallbackCategory = 'Not specified';
    const categories = Array.from(new Set(window.appState.jsonData.map(r => {
      const rc = r[encodingField];
      if (rc === undefined || rc === null || rc === '..') return fallbackCategory;
      const cs = String(rc).trim();
      return cs === '' ? fallbackCategory : cs;
    })));
    
    colorScale = d3.scaleOrdinal()
      .domain(categories)
      .range(categories.map((_, idx) => {
        if (categories.length === 1) return d3.interpolateRainbow(0.35);
        return d3.interpolateRainbow(idx / categories.length);
      }));
  }
  
  const colorMap = {};
  if (countryCodeCol) {
    for (const row of window.appState.jsonData) {
      const countryCode = row[countryCodeCol];
      if (!countryCode || countryCode === '..') continue;
      const lookupRow = lookup.find(l => l.Alpha3 === countryCode);
      if (lookupRow) {
        // Pad to 3 digits to match TopoJSON format (e.g., '032' for Argentina, '076' for Brazil)
        const numericCode = String(lookupRow.Numeric).padStart(3, '0');
        
        // Get label for this row
        let label;
        if (window.appState.geoMode === 'country') {
          label = row.Country;
        } else if (window.appState.geoMode === 'county') {
          label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
        } else {
          label = row[window.appState.dataColumn];
        }
        
        // Calculate color
        let color = '#e2e8f0';
        if (inSelectionMode) {
          const locations = window.appState.selectionModeLocations || [];
          const selectedLoc = locations.find(loc => loc.location === label);
          if (selectedLoc) {
            color = selectedLoc.color;
          }
        } else if (hasEncodingField && colorScale) {
          const rawCategory = row[encodingField];
          const fallbackCategory = 'Not specified';
          let categoryValue = fallbackCategory;
          if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '..') {
            const catStr = String(rawCategory).trim();
            categoryValue = catStr === '' ? fallbackCategory : catStr;
          }
          const baseColor = colorScale(categoryValue);
          const overrides = window.appState.beeswarmColorOverrides || {};
          color = overrides[baseColor] || baseColor;
        }
        
        colorMap[numericCode] = color;
      }
    }
  }
  
  g.append('g')
    .attr('class', 'countries')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => colorMap[d.id] || '#e2e8f0')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('click', async function(evt, d) {
      // Same click handler logic as US map, but using country codes
      const countryCodeCol = detectCountryCodeColumn();
      if (!countryCodeCol) return;
      
      const numericCode = d.id;
      // Pad the lookup numeric code to match TopoJSON format
      const lookupRow = lookup.find(l => String(l.Numeric).padStart(3, '0') === numericCode);
      if (!lookupRow) return;
      
      const row = window.appState.jsonData.find(r => r[countryCodeCol] === lookupRow.Alpha3);
      if (!row) return;
      
      let label;
      if (window.appState.geoMode === 'country') {
        label = row.Country;
      } else if (window.appState.geoMode === 'county') {
        label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
      } else {
        label = row[window.appState.dataColumn];
      }
      
      if (!label) return;
      
      // Same selection mode logic as US map
      handleLocationClick(label, evt);
    })
    .on('mouseenter', function() {
      d3.select(this)
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.5);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.5);
    });
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
}

// Render the US counties map
async function renderUSMap(svgElement, width, height) {
  const mapData = await loadUSCountiesMap();
  if (!mapData) {
    console.error('Map data not available');
    return;
  }
  
  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  
  // Convert TopoJSON to GeoJSON
  const counties = topojson.feature(mapData, mapData.objects.counties);
  const states = topojson.feature(mapData, mapData.objects.states);
  
  // Create projection
  const projection = d3.geoAlbersUsa()
    .fitSize([width - 20, height - 20], counties);
  
  const path = d3.geoPath().projection(projection);
  
  // Add a background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');
  
  // Create a group for zoom/pan
  const g = svg.append('g');
  
  // Render counties
  g.append('g')
    .attr('class', 'counties')
    .selectAll('path')
    .data(counties.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const fipsCode = d.id;
      return getColorForFIPS(fipsCode);
    })
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 0.3)
    .style('cursor', 'pointer')
    .on('click', function(evt, d) {
      const fipsCol = detectFIPSColumn();
      if (!fipsCol) return;
      
      const fipsCode = d.id;
      const row = window.appState.jsonData.find(r => {
        let rowFips = r[fipsCol];
        if (rowFips === undefined || rowFips === null || rowFips === '..') return false;
        rowFips = String(rowFips).padStart(5, '0');
        return rowFips === fipsCode;
      });
      
      if (!row) return;
      
      let label;
      if (window.appState.geoMode === 'country') {
        label = row.Country;
      } else if (window.appState.geoMode === 'county') {
        label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
      } else {
        label = row[window.appState.dataColumn];
      }
      
      if (!label) return;
      handleLocationClick(label, evt);
    })
    .on('mouseenter', function(evt, d) {
      d3.select(this)
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.5);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.3);
    });
  
  // Render state borders on top
  g.append('g')
    .attr('class', 'states')
    .selectAll('path')
    .data(states.features)
    .join('path')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#64748b')
    .attr('stroke-width', 1)
    .attr('stroke-linejoin', 'round')
    .attr('pointer-events', 'none');
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
}

// Main render function for the map panel
async function renderMapPanel() {
  const mapContainer = document.getElementById('map-panel-popup');
  if (!mapContainer || mapContainer.style.display === 'none') return;
  
  const svg = mapContainer.querySelector('#map-svg');
  if (!svg) return;
  
  // Check for lat/long first (highest priority), then country code, then FIPS
  const latLongCols = detectLatLongColumns();
  const countryCodeCol = detectCountryCodeColumn();
  const fipsCol = detectFIPSColumn();
  
  if (!latLongCols && !countryCodeCol && !fipsCol) {
    // No geo column - show message
    const svgEl = d3.select(svg);
    svgEl.selectAll('*').remove();
    const width = parseInt(svg.getAttribute('width')) || 500;
    const height = parseInt(svg.getAttribute('height')) || 400;
    svgEl.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 14)
      .text('No geographic columns found in dataset');
    return;
  }
  
  const width = parseInt(svg.getAttribute('width')) || 500;
  const height = parseInt(svg.getAttribute('height')) || 400;
  
  // Render based on available columns (lat/long has highest priority)
  if (latLongCols) {
    await renderLatLongMap(svg, width, height);
  } else if (countryCodeCol) {
    await renderWorldMap(svg, width, height);
  } else {
    await renderUSMap(svg, width, height);
  }
}

window.renderMapPanel = renderMapPanel;
window.detectFIPSColumn = detectFIPSColumn;
window.detectCountryCodeColumn = detectCountryCodeColumn;
window.detectLatLongColumns = detectLatLongColumns;

