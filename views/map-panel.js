/**
 * Map Panel for Final View
 * Displays US counties map colored by selection colors
 */

// Store the loaded map data
let usCountiesData = null;
let worldCountriesData = null;
let countryLookupData = null;
let isLoadingMap = false;

// Store zoom transforms to preserve zoom state across re-renders
let currentZoomTransform = null;
let currentMapType = null; // Track which map is currently displayed
let mapRenderGeneration = 0;
let activeMapZoom = null;
let activeMapSvg = null;
let mapToastTimeout = null;
let hoveredRegionKey = null;
let regionOutlineState = null;

// ── Tweak these to adjust when overlays appear on the world map ──────────────
const WORLD_STATES_ZOOM_THRESHOLD  = 4;   // zoom level to show US state borders
const WORLD_COUNTIES_ZOOM_THRESHOLD = 10;  // zoom level to show US county borders
const MAX_ZOOM = 8192;                      // max zoom for all maps (scaleExtent upper bound)
const MAP_FIT_PADDING = 20;                   // must match fitSize([width - pad, height - pad], …)
const MAP_REGION_STROKE = '#ffffff';
const MAP_REGION_STROKE_WIDTH = 0.5;
const MAP_REGION_HOVER_STROKE = '#334155';
const MAP_REGION_HOVER_STROKE_WIDTH = 1.5;
const MAP_REGION_SELECTED_STROKE = '#0f172a';
const MAP_REGION_SELECTED_STROKE_WIDTH = 2;
const DOT_BASE_RADIUS = 4;
const DOT_HOVER_RADIUS = 6;
const DOT_SELECTED_EXTRA_RADIUS = 1;
const DOT_STROKE_WIDTH = 0.75;
const DOT_SELECTED_STROKE_WIDTH = 1.25;
const ZOOM_BUTTON_FACTOR = 1.35;
// ─────────────────────────────────────────────────────────────────────────────

// Preserve geographic center + zoom k when the map SVG is resized (projection refit).
let mapViewAnchorState = null; // { mapType, width, height, lonLat: [lon, lat], k } | null

function beginMapRender() {
  mapRenderGeneration += 1;
  return mapRenderGeneration;
}

function isMapRenderStale(generation) {
  return generation !== mapRenderGeneration;
}

function clearMapViewAnchorState() {
  mapViewAnchorState = null;
}

function isFeatureMapSelectionMode() {
  return window.appState.encodingMode === 'feature' &&
         window.appState.viewMode === 'category-final' &&
         !isMissingLabelValue(window.appState.selectedCountry);
}

function syncMapSvgSize(mapContainer, svgElement) {
  const content = mapContainer?.querySelector('.map-popup-content') || mapContainer;
  if (!content || !svgElement) {
    return { width: 500, height: 400 };
  }
  const width = Math.max(200, content.clientWidth || 0);
  const height = Math.max(160, content.clientHeight || 0);
  svgElement.setAttribute('width', width);
  svgElement.setAttribute('height', height);
  return { width, height };
}

function styleOutlinePath(selection, { hovered = false, selected = false } = {}) {
  selection
    .attr('fill', 'none')
    .attr('pointer-events', 'none')
    .style('vector-effect', 'non-scaling-stroke');

  if (hovered) {
    selection
      .attr('stroke', MAP_REGION_HOVER_STROKE)
      .attr('stroke-width', MAP_REGION_HOVER_STROKE_WIDTH);
  } else if (selected) {
    selection
      .attr('stroke', MAP_REGION_SELECTED_STROKE)
      .attr('stroke-width', MAP_REGION_SELECTED_STROKE_WIDTH);
  } else {
    selection.attr('stroke', 'none');
  }
}

function createRegionOutlineLayers(g, path, getRegionKey) {
  const outlineLayer = g.append('g')
    .attr('class', 'map-region-outlines')
    .attr('pointer-events', 'none');

  return {
    path,
    getRegionKey,
    selectedGroup: outlineLayer.append('g').attr('class', 'map-region-selected-outline'),
    hoverGroup: outlineLayer.append('g').attr('class', 'map-region-hover-outline')
  };
}

function updateSelectedOutlineLayer(outlineState, features, isSelectedFn) {
  if (!outlineState) return;
  outlineState.selectedGroup.selectAll('*').remove();
  if (!isFeatureMapSelectionMode()) return;

  const selectedFeatures = features.filter(isSelectedFn);
  outlineState.selectedGroup
    .selectAll('path')
    .data(selectedFeatures, d => outlineState.getRegionKey(d))
    .join('path')
    .attr('d', outlineState.path)
    .call(selection => styleOutlinePath(selection, { selected: true }));
}

function updateHoverOutlineLayer(outlineState, feature) {
  if (!outlineState) return;
  outlineState.hoverGroup
    .selectAll('path')
    .data(feature ? [feature] : [], d => outlineState.getRegionKey(d))
    .join('path')
    .attr('d', outlineState.path)
    .call(selection => styleOutlinePath(selection, { hovered: true }));
}

function findFeatureByRegionKey(features, getRegionKey, regionKey) {
  if (!regionKey || !Array.isArray(features)) return null;
  return features.find(feature => getRegionKey(feature) === regionKey) || null;
}

function syncRegionOutlineLayers(outlineState, features, isSelectedFn) {
  if (!outlineState) return;
  regionOutlineState = outlineState;
  updateSelectedOutlineLayer(outlineState, features, isSelectedFn);
  updateHoverOutlineLayer(
    outlineState,
    findFeatureByRegionKey(features, outlineState.getRegionKey, hoveredRegionKey)
  );
}

function recomputeZoomForResizeIfNeeded(projection, width, height) {
  if (!mapViewAnchorState) return;
  if (mapViewAnchorState.mapType !== currentMapType) return;
  if (!mapViewAnchorState.lonLat) return;
  if (mapViewAnchorState.width === width && mapViewAnchorState.height === height) return;
  if (typeof projection.invert !== 'function') return;

  const lonLat = mapViewAnchorState.lonLat;
  const k = mapViewAnchorState.k;
  const p = projection(lonLat);
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;

  currentZoomTransform = d3.zoomIdentity
    .scale(k)
    .translate(width / (2 * k) - p[0], height / (2 * k) - p[1]);
}

function updateMapViewAnchorState(projection, width, height, mapType) {
  if (typeof projection.invert !== 'function') return;
  const t = currentZoomTransform || d3.zoomIdentity;
  const inv = t.invert([width / 2, height / 2]);
  if (!inv || !Number.isFinite(inv[0]) || !Number.isFinite(inv[1])) return;
  const lonLat = projection.invert(inv);
  if (!lonLat || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) return;
  mapViewAnchorState = {
    mapType,
    width,
    height,
    lonLat: [lonLat[0], lonLat[1]],
    k: t.k
  };
}

function normalizeFipsCode(value) {
  if (value === undefined || value === null || value === '..') return null;
  return String(value).trim().padStart(5, '0');
}

function normalizeCountryNumericId(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().padStart(3, '0');
}

function normalizeAlpha3(value) {
  if (value === undefined || value === null || value === '..') return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized === '' ? null : normalized;
}

function isMissingLabelValue(value) {
  if (value === undefined || value === null) return true;
  if (value === '..') return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function getRowLabelFromRow(row) {
  if (!row) return null;
  let label;
  if (window.appState.geoMode === 'country') {
    label = row.Country;
  } else if (window.appState.geoMode === 'county') {
    label = row.__displayName || `${(row.County || '').toString().trim()}, ${(row.State || '').toString().trim()}`;
  } else {
    label = row[window.appState.dataColumn];
  }
  if (isMissingLabelValue(label)) return null;
  return String(label);
}

function findRowByLabel(label) {
  if (isMissingLabelValue(label)) return null;
  const target = String(label);
  return window.appState.jsonData.find(row => getRowLabelFromRow(row) === target) || null;
}

function buildCountryLookupMaps(lookup) {
  const alpha3ToNumeric = new Map();
  const numericToAlpha3 = new Map();
  (lookup || []).forEach(row => {
    const alpha3 = normalizeAlpha3(row.Alpha3);
    const numeric = normalizeCountryNumericId(row.Numeric);
    if (!alpha3 || !numeric) return;
    alpha3ToNumeric.set(alpha3, numeric);
    numericToAlpha3.set(numeric, alpha3);
  });
  return { alpha3ToNumeric, numericToAlpha3 };
}

function showMapToast(message) {
  const popup = document.getElementById('map-panel-popup');
  if (!popup) return;
  let toast = popup.querySelector('.map-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'map-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    popup.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  if (mapToastTimeout) clearTimeout(mapToastTimeout);
  mapToastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2800);
}

function styleRegionFillPath(selection) {
  return selection
    .attr('stroke', 'none')
    .style('cursor', 'pointer');
}

function appendFeatureMesh(parent, path, meshGeo, className, stroke, strokeWidth) {
  return parent.append('path')
    .attr('class', className)
    .attr('d', path(meshGeo))
    .attr('fill', 'none')
    .attr('stroke', stroke)
    .attr('stroke-width', strokeWidth)
    .style('vector-effect', 'non-scaling-stroke')
    .attr('pointer-events', 'none');
}

function resetMapHoverState() {
  hoveredRegionKey = null;
  regionOutlineState = null;
  hideMapRegionTooltip();
}

function ensureMapRegionTooltip() {
  const popup = document.getElementById('map-panel-popup');
  if (!popup) return null;
  let tooltip = popup.querySelector('.map-region-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'map-region-tooltip hidden';
    tooltip.setAttribute('role', 'tooltip');
    popup.appendChild(tooltip);
  }
  return tooltip;
}

function positionMapRegionTooltip(tooltip, evt) {
  const popup = document.getElementById('map-panel-popup');
  if (!popup || !tooltip || !evt) return;
  const rect = popup.getBoundingClientRect();
  tooltip.style.left = (evt.clientX - rect.left + 12) + 'px';
  tooltip.style.top = (evt.clientY - rect.top - 8) + 'px';
}

function showMapRegionTooltip(label, evt) {
  const tooltip = ensureMapRegionTooltip();
  if (!tooltip || !label) return;
  tooltip.textContent = label;
  tooltip.classList.remove('hidden');
  positionMapRegionTooltip(tooltip, evt);
}

function hideMapRegionTooltip() {
  const popup = document.getElementById('map-panel-popup');
  const tooltip = popup?.querySelector('.map-region-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

function clearHoveredRegion() {
  hoveredRegionKey = null;
  if (regionOutlineState) {
    updateHoverOutlineLayer(regionOutlineState, null);
  }
  hideMapRegionTooltip();
}

function setHoveredRegion(feature, regionKey, label, evt, outlineState) {
  hoveredRegionKey = regionKey;
  regionOutlineState = outlineState;
  updateHoverOutlineLayer(outlineState, feature);
  if (label) showMapRegionTooltip(label, evt);
}

function attachRegionPointerHandlers(pathSelection, getLabel, outlineState) {
  pathSelection
    .on('mouseenter', function(evt, d) {
      setHoveredRegion(d, outlineState.getRegionKey(d), getLabel(d), evt, outlineState);
    })
    .on('mousemove', function(evt) {
      const tooltip = ensureMapRegionTooltip();
      if (tooltip && !tooltip.classList.contains('hidden')) {
        positionMapRegionTooltip(tooltip, evt);
      }
    })
    .on('mouseleave', function(evt, d) {
      if (hoveredRegionKey === outlineState.getRegionKey(d)) {
        clearHoveredRegion();
      }
    });
}

function attachMapPointerLeaveSafety(svgElement, g) {
  d3.select(svgElement).on('pointerleave', clearHoveredRegion);
  g.on('pointerleave', clearHoveredRegion);
}

function buildCountyLabelMap(fipsCol) {
  const labelMap = {};
  if (!fipsCol || !window.appState.jsonData) return labelMap;
  for (const row of window.appState.jsonData) {
    const fips = normalizeFipsCode(row[fipsCol]);
    if (!fips) continue;
    const label = getRowLabelFromRow(row);
    if (label) labelMap[fips] = label;
  }
  return labelMap;
}

function getCountyFeatureLabel(feature, labelMap) {
  const fips = normalizeFipsCode(feature.id);
  if (fips && labelMap[fips]) return labelMap[fips];
  if (feature.properties && feature.properties.name) return feature.properties.name;
  return fips || 'Unknown region';
}

function getWorldFeatureLabel(feature, labelMap, lookupMaps) {
  const numeric = normalizeCountryNumericId(feature.id);
  if (numeric && labelMap[numeric]) return labelMap[numeric];
  if (feature.properties && feature.properties.name) return feature.properties.name;
  const alpha3 = numeric ? lookupMaps.numericToAlpha3.get(numeric) : null;
  return alpha3 || numeric || 'Unknown region';
}

function getDotScreenRadius(baseRadius, scale) {
  return baseRadius / scale;
}

function updateDotSizes(circles, scale, hoveredCircle = null, selectedLabel = null) {
  const selected = isFeatureMapSelectionMode() ? selectedLabel : null;
  circles.each(function(d) {
    const isHovered = this === hoveredCircle;
    const isSelected = selected && d.label === selected;
    let baseRadius = DOT_BASE_RADIUS;
    if (isHovered) {
      baseRadius = DOT_HOVER_RADIUS;
    } else if (isSelected) {
      baseRadius = DOT_BASE_RADIUS + DOT_SELECTED_EXTRA_RADIUS;
    }

    let stroke = '#fff';
    let strokeWidth = DOT_STROKE_WIDTH;
    if (isSelected) {
      stroke = isHovered ? MAP_REGION_HOVER_STROKE : MAP_REGION_SELECTED_STROKE;
      strokeWidth = isHovered ? MAP_REGION_HOVER_STROKE_WIDTH : DOT_SELECTED_STROKE_WIDTH;
    }

    d3.select(this)
      .attr('r', getDotScreenRadius(baseRadius, scale))
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth / scale);
  });
}

function ensureMapZoomControls(mapContainer, width, height) {
  const content = mapContainer.querySelector('.map-popup-content') || mapContainer;
  let controls = content.querySelector('.map-zoom-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'map-zoom-controls';
    controls.innerHTML = `
      <button type="button" class="map-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>
      <button type="button" class="map-zoom-btn" data-zoom="out" aria-label="Zoom out">&minus;</button>
    `;
    content.appendChild(controls);
  }

  const zoomInBtn = controls.querySelector('[data-zoom="in"]');
  const zoomOutBtn = controls.querySelector('[data-zoom="out"]');

  const updateDisabled = () => {
    const k = currentZoomTransform ? currentZoomTransform.k : 1;
    zoomInBtn.disabled = k >= MAX_ZOOM;
    zoomOutBtn.disabled = k <= 1;
  };

  const onZoomClick = (direction) => (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (!activeMapZoom || !activeMapSvg) return;
    const factor = direction === 'in' ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
    d3.select(activeMapSvg)
      .transition()
      .duration(180)
      .call(activeMapZoom.scaleBy, factor, [width / 2, height / 2]);
  };

  zoomInBtn.onclick = onZoomClick('in');
  zoomOutBtn.onclick = onZoomClick('out');
  controls._updateDisabled = updateDisabled;
  updateDisabled();
  return controls;
}

function setupMapZoom({ svgElement, g, projection, width, height, mapType, onZoom }) {
  const zoom = d3.zoom()
    .scaleExtent([1, MAX_ZOOM])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      currentZoomTransform = event.transform;
      updateMapViewAnchorState(projection, width, height, mapType);
      if (typeof onZoom === 'function') onZoom(event);
      const controls = document.getElementById('map-panel-popup')?.querySelector('.map-zoom-controls');
      if (controls && controls._updateDisabled) controls._updateDisabled();
    });

  activeMapZoom = zoom;
  activeMapSvg = svgElement;

  recomputeZoomForResizeIfNeeded(projection, width, height);

  const svg = d3.select(svgElement);
  svg.call(zoom);
  if (currentZoomTransform) {
    svg.call(zoom.transform, currentZoomTransform);
  }
  return zoom;
}

// Prevent browser page zoom when wheeling over the map panel (capture + non-passive).
let mapPopupWheelCaptureInstalled = false;

function attachMapWheelCapture() {
  const popup = document.getElementById('map-panel-popup');
  if (!popup || mapPopupWheelCaptureInstalled) return;
  mapPopupWheelCaptureInstalled = true;
  const handler = (e) => { e.preventDefault(); };
  popup.addEventListener('wheel', handler, { passive: false, capture: true });
}

function detectFIPSColumn() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);
  const fipsCol = columns.find(col => /^fips[_\s]?code$/i.test(col) || /^fips$/i.test(col));
  return fipsCol || null;
}

function detectCountryCodeColumn() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);
  const countryCodeCol = columns.find(col => /^country[_\s]?code$/i.test(col) || /^countrycode$/i.test(col));
  return countryCodeCol || null;
}

function detectLatLongColumns() {
  if (!window.appState.jsonData || window.appState.jsonData.length === 0) return null;
  const columns = Object.keys(window.appState.jsonData[0]);

  const latCol = columns.find(col => /^latitude$/i.test(col) || /^lat$/i.test(col) || /^y$/i.test(col));
  const longCol = columns.find(col => /^longitude$/i.test(col) || /^long$/i.test(col) || /^x$/i.test(col));

  if (latCol && longCol) {
    return { lat: latCol, long: longCol };
  }
  return null;
}

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

async function loadCountryLookup() {
  if (countryLookupData) return countryLookupData;

  try {
    const response = await fetch('countryLookUp.xlsx');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

function getFIPSForLocation(label) {
  const fipsCol = detectFIPSColumn();
  if (!fipsCol || !window.appState.jsonData) return null;

  const row = findRowByLabel(label);
  if (!row) return null;

  return normalizeFipsCode(row[fipsCol]);
}

async function getCountryCodeForLocation(label) {
  const countryCodeCol = detectCountryCodeColumn();
  if (!countryCodeCol || !window.appState.jsonData) return null;

  const row = findRowByLabel(label);
  if (!row) return null;

  const countryCode = normalizeAlpha3(row[countryCodeCol]);
  if (!countryCode) return null;

  const lookup = await loadCountryLookup();
  if (!lookup) return null;

  const { alpha3ToNumeric } = buildCountryLookupMaps(lookup);
  return alpha3ToNumeric.get(countryCode) || null;
}

function getColorForFIPS(fipsCode) {
  const normalizedFips = normalizeFipsCode(fipsCode);
  if (!normalizedFips) return '#e2e8f0';

  const inSelectionMode = window.appState.encodingMode === 'selection' &&
                          window.appState.viewMode === 'category-final';

  if (inSelectionMode) {
    const locations = window.appState.selectionModeLocations || [];
    for (const loc of locations) {
      const locFips = getFIPSForLocation(loc.location);
      if (locFips === normalizedFips) {
        return loc.color;
      }
    }
    return '#e2e8f0';
  }

  const encodingField = window.appState.categoryEncodedField;
  if (!encodingField || !window.appState.jsonData) return '#e2e8f0';

  const fipsCol = detectFIPSColumn();
  if (!fipsCol) return '#e2e8f0';

  const row = window.appState.jsonData.find(r => normalizeFipsCode(r[fipsCol]) === normalizedFips);
  if (!row) return '#e2e8f0';

  const rawCategory = row[encodingField];
  const fallbackCategory = 'Not specified';
  let categoryValue = fallbackCategory;
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== '..') {
    const catStr = String(rawCategory).trim();
    categoryValue = catStr === '' ? fallbackCategory : catStr;
  }

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
  const overrides = window.appState.beeswarmColorOverrides || {};
  return overrides[baseColor] || baseColor;
}

function applyOverlayVisibility(k, statesGroup, countiesGroup) {
  statesGroup.style('display', k >= WORLD_STATES_ZOOM_THRESHOLD ? null : 'none');
  countiesGroup.style('display', k >= WORLD_COUNTIES_ZOOM_THRESHOLD ? null : 'none');
}

async function loadUSCountiesMap() {
  if (usCountiesData) return usCountiesData;
  if (isLoadingMap) {
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
}

function resolveWorldCountryClick(numericCode, lookupMaps, countryCodeCol) {
  const normalizedNumeric = normalizeCountryNumericId(numericCode);
  if (!normalizedNumeric) {
    showMapToast('This region cannot be selected.');
    return;
  }

  const alpha3 = lookupMaps.numericToAlpha3.get(normalizedNumeric);
  if (!alpha3) {
    showMapToast('This region is not available in the dataset.');
    return;
  }

  const row = window.appState.jsonData.find(r => normalizeAlpha3(r[countryCodeCol]) === alpha3);
  if (!row) {
    showMapToast('No data available for this region.');
    return;
  }

  const label = getRowLabelFromRow(row);
  if (!label) {
    showMapToast('This region has no selectable label in the dataset.');
    return;
  }

  return label;
}

function resolveCountyClick(fipsCode, fipsCol) {
  const normalizedFips = normalizeFipsCode(fipsCode);
  if (!normalizedFips) {
    showMapToast('This region cannot be selected.');
    return;
  }

  const row = window.appState.jsonData.find(r => normalizeFipsCode(r[fipsCol]) === normalizedFips);
  if (!row) {
    showMapToast('No data available for this region.');
    return;
  }

  const label = getRowLabelFromRow(row);
  if (!label) {
    showMapToast('This region has no selectable label in the dataset.');
    return;
  }

  return label;
}

async function renderLatLongMap(svgElement, width, height, generation) {
  const mapData = await loadWorldCountriesMap();
  const latLongCols = detectLatLongColumns();

  if (isMapRenderStale(generation)) return;

  if (!mapData || !latLongCols) {
    console.error('World map data or lat/long columns not available');
    return;
  }

  if (currentMapType !== 'latlong') {
    currentZoomTransform = null;
    clearMapViewAnchorState();
    currentMapType = 'latlong';
  }

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  resetMapHoverState();

  const countries = topojson.feature(mapData, mapData.objects.countries);
  const projection = d3.geoNaturalEarth1()
    .fitSize([width - MAP_FIT_PADDING, height - MAP_FIT_PADDING], countries);
  const path = d3.geoPath().projection(projection);

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');

  const g = svg.append('g');

  styleRegionFillPath(g.append('g')
    .attr('class', 'countries')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#e2e8f0')
    .attr('pointer-events', 'none'));

  appendFeatureMesh(g, path, topojson.mesh(mapData, mapData.objects.countries), 'countries-mesh', '#cbd5e1', MAP_REGION_STROKE_WIDTH);

  const usAtlasData = await loadUSCountiesMap();
  if (isMapRenderStale(generation)) return;

  const usStatesOverlay = g.append('g').attr('class', 'us-states-overlay');
  if (usAtlasData) {
    const usStates = topojson.feature(usAtlasData, usAtlasData.objects.states);
    usStatesOverlay.selectAll('path')
      .data(usStates.features)
      .join('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .style('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
  }

  const usCountiesOverlay = g.append('g').attr('class', 'us-counties-overlay');
  if (usAtlasData) {
    const usCountiesFeat = topojson.feature(usAtlasData, usAtlasData.objects.counties);
    usCountiesOverlay.selectAll('path')
      .data(usCountiesFeat.features)
      .join('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', MAP_REGION_STROKE_WIDTH)
      .style('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
  }

  const inSelectionMode = window.appState.encodingMode === 'selection' &&
                          window.appState.viewMode === 'category-final';

  const colorCtx = typeof window.buildFeatureEncodingColorContext === 'function'
    ? window.buildFeatureEncodingColorContext()
    : null;
  const hasEncodingField = colorCtx ? colorCtx.hasEncodingField : false;
  const featureColorScale = colorCtx && hasEncodingField ? colorCtx.getDefaultColorScale() : null;
  const defaultDotColor = colorCtx ? colorCtx.getDefaultDotColor() : '#64748b';

  const dots = [];
  window.appState.jsonData.forEach(row => {
    const lat = parseFloat(row[latLongCols.lat]);
    const long = parseFloat(row[latLongCols.long]);

    if (isNaN(lat) || isNaN(long)) return;

    const label = getRowLabelFromRow(row);
    if (!label) return;

    let color = defaultDotColor;
    if (inSelectionMode) {
      const locations = window.appState.selectionModeLocations || [];
      const selectedLoc = locations.find(loc => loc.location === label);
      if (selectedLoc) {
        color = selectedLoc.color;
      }
    } else if (hasEncodingField && colorCtx && featureColorScale) {
      color = colorCtx.getColorForRow(row, featureColorScale);
    }

    const coords = projection([long, lat]);
    if (coords) {
      dots.push({ x: coords[0], y: coords[1], label, color, row });
    }
  });

  const dotsGroup = g.append('g')
    .attr('class', 'location-dots');

  const initialScale = currentZoomTransform ? currentZoomTransform.k : 1;
  const selectedLabel = window.appState.selectedCountry || null;
  const circles = dotsGroup
    .selectAll('circle')
    .data(dots)
    .join('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', getDotScreenRadius(DOT_BASE_RADIUS, initialScale))
    .attr('fill', d => d.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', DOT_STROKE_WIDTH / initialScale)
    .style('cursor', 'pointer')
    .on('click', function(evt, d) {
      handleLocationClick(d.label, evt);
    })
    .on('mouseenter', function(evt, d) {
      const scale = currentZoomTransform ? currentZoomTransform.k : 1;
      updateDotSizes(circles, scale, this, selectedLabel);
      showMapRegionTooltip(d.label, evt);
    })
    .on('mousemove', function(evt) {
      const tooltip = ensureMapRegionTooltip();
      if (tooltip && !tooltip.classList.contains('hidden')) {
        positionMapRegionTooltip(tooltip, evt);
      }
    })
    .on('mouseleave', function() {
      const scale = currentZoomTransform ? currentZoomTransform.k : 1;
      updateDotSizes(circles, scale, null, selectedLabel);
      hideMapRegionTooltip();
    });

  updateDotSizes(circles, initialScale, null, selectedLabel);

  const mapContainer = document.getElementById('map-panel-popup');
  ensureMapZoomControls(mapContainer, width, height);

  setupMapZoom({
    svgElement,
    g,
    projection,
    width,
    height,
    mapType: 'latlong',
    onZoom: (event) => {
      updateDotSizes(circles, event.transform.k, null, selectedLabel);
      applyOverlayVisibility(event.transform.k, usStatesOverlay, usCountiesOverlay);
    }
  });

  const initialTransform = currentZoomTransform || d3.zoomIdentity;
  applyOverlayVisibility(initialTransform.k, usStatesOverlay, usCountiesOverlay);
  attachMapPointerLeaveSafety(svgElement, g);
  attachMapWheelCapture();
  updateMapViewAnchorState(projection, width, height, 'latlong');
}

async function renderWorldMap(svgElement, width, height, generation) {
  const mapData = await loadWorldCountriesMap();
  const lookup = await loadCountryLookup();

  if (isMapRenderStale(generation)) return;

  if (!mapData) {
    console.error('World map data not available');
    return;
  }

  if (!lookup || lookup.length === 0) {
    console.error('Country lookup not available');
    return;
  }

  const lookupMaps = buildCountryLookupMaps(lookup);

  if (currentMapType !== 'world') {
    currentZoomTransform = null;
    clearMapViewAnchorState();
    currentMapType = 'world';
  }

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  resetMapHoverState();

  const countries = topojson.feature(mapData, mapData.objects.countries);
  const projection = d3.geoNaturalEarth1()
    .fitSize([width - MAP_FIT_PADDING, height - MAP_FIT_PADDING], countries);
  const path = d3.geoPath().projection(projection);

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');

  const g = svg.append('g');

  const countryCodeCol = detectCountryCodeColumn();
  const inSelectionMode = window.appState.encodingMode === 'selection' &&
                          window.appState.viewMode === 'category-final';
  const encodingField = window.appState.categoryEncodedField;
  const hasEncodingField = !inSelectionMode && encodingField && window.appState.jsonData.length > 0;

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
  const labelMap = {};
  if (countryCodeCol) {
    for (const row of window.appState.jsonData) {
      const countryCode = normalizeAlpha3(row[countryCodeCol]);
      if (!countryCode) continue;
      const numericCode = lookupMaps.alpha3ToNumeric.get(countryCode);
      if (!numericCode) continue;

      const label = getRowLabelFromRow(row);
      if (!label) continue;

      labelMap[numericCode] = label;

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

  const countryPaths = styleRegionFillPath(g.append('g')
    .attr('class', 'countries')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => colorMap[normalizeCountryNumericId(d.id)] || '#e2e8f0'))
    .on('click', function(evt, d) {
      if (!countryCodeCol) {
        showMapToast('This dataset has no country code column.');
        return;
      }

      const label = resolveWorldCountryClick(d.id, lookupMaps, countryCodeCol);
      if (!label) return;
      handleLocationClick(label, evt);
    });

  let selectedNumericId = null;
  if (isFeatureMapSelectionMode()) {
    const targetLabel = String(window.appState.selectedCountry);
    for (const [numericCode, label] of Object.entries(labelMap)) {
      if (label === targetLabel) {
        selectedNumericId = numericCode;
        break;
      }
    }
  }

  appendFeatureMesh(g, path, topojson.mesh(mapData, mapData.objects.countries), 'countries-mesh', MAP_REGION_STROKE, MAP_REGION_STROKE_WIDTH);

  const usAtlasData = await loadUSCountiesMap();
  if (isMapRenderStale(generation)) return;

  const usStatesOverlay = g.append('g').attr('class', 'us-states-overlay');
  if (usAtlasData) {
    const usStates = topojson.feature(usAtlasData, usAtlasData.objects.states);
    usStatesOverlay.selectAll('path')
      .data(usStates.features)
      .join('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .style('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
  }

  const usCountiesOverlay = g.append('g').attr('class', 'us-counties-overlay');
  if (usAtlasData) {
    const usCountiesFeat = topojson.feature(usAtlasData, usAtlasData.objects.counties);
    usCountiesOverlay.selectAll('path')
      .data(usCountiesFeat.features)
      .join('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', MAP_REGION_STROKE_WIDTH)
      .style('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');
  }

  const worldOutlineState = createRegionOutlineLayers(g, path, d => normalizeCountryNumericId(d.id));
  attachRegionPointerHandlers(
    countryPaths,
    d => getWorldFeatureLabel(d, labelMap, lookupMaps),
    worldOutlineState
  );
  syncRegionOutlineLayers(
    worldOutlineState,
    countries.features,
    d => selectedNumericId && normalizeCountryNumericId(d.id) === selectedNumericId
  );

  const mapContainer = document.getElementById('map-panel-popup');
  ensureMapZoomControls(mapContainer, width, height);

  setupMapZoom({
    svgElement,
    g,
    projection,
    width,
    height,
    mapType: 'world',
    onZoom: (event) => {
      applyOverlayVisibility(event.transform.k, usStatesOverlay, usCountiesOverlay);
    }
  });

  const initialTransform = currentZoomTransform || d3.zoomIdentity;
  applyOverlayVisibility(initialTransform.k, usStatesOverlay, usCountiesOverlay);
  attachMapPointerLeaveSafety(svgElement, g);
  attachMapWheelCapture();
  updateMapViewAnchorState(projection, width, height, 'world');
}

async function renderUSMap(svgElement, width, height, generation) {
  const mapData = await loadUSCountiesMap();
  if (isMapRenderStale(generation)) return;

  if (!mapData) {
    console.error('Map data not available');
    return;
  }

  if (currentMapType !== 'us') {
    currentZoomTransform = null;
    clearMapViewAnchorState();
    currentMapType = 'us';
  }

  const svg = d3.select(svgElement);
  svg.selectAll('*').remove();
  resetMapHoverState();

  const counties = topojson.feature(mapData, mapData.objects.counties);

  const projection = d3.geoAlbersUsa()
    .fitSize([width - MAP_FIT_PADDING, height - MAP_FIT_PADDING], counties);

  const path = d3.geoPath().projection(projection);

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f9ff');

  const g = svg.append('g');
  const fipsCol = detectFIPSColumn();
  const countyLabelMap = buildCountyLabelMap(fipsCol);

  const countyPaths = styleRegionFillPath(g.append('g')
    .attr('class', 'counties')
    .selectAll('path')
    .data(counties.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => getColorForFIPS(d.id)))
    .on('click', function(evt, d) {
      if (!fipsCol) {
        showMapToast('This dataset has no FIPS code column.');
        return;
      }

      const label = resolveCountyClick(d.id, fipsCol);
      if (!label) return;
      handleLocationClick(label, evt);
    });

  const selectedFips = isFeatureMapSelectionMode()
    ? getFIPSForLocation(window.appState.selectedCountry)
    : null;

  appendFeatureMesh(g, path, topojson.mesh(mapData, mapData.objects.counties), 'counties-mesh', MAP_REGION_STROKE, MAP_REGION_STROKE_WIDTH);
  appendFeatureMesh(
    g,
    path,
    topojson.mesh(mapData, mapData.objects.states, (a, b) => a !== b),
    'states-mesh',
    '#64748b',
    1
  );

  const countyOutlineState = createRegionOutlineLayers(g, path, d => normalizeFipsCode(d.id));
  attachRegionPointerHandlers(
    countyPaths,
    d => getCountyFeatureLabel(d, countyLabelMap),
    countyOutlineState
  );
  syncRegionOutlineLayers(
    countyOutlineState,
    counties.features,
    d => selectedFips && normalizeFipsCode(d.id) === selectedFips
  );

  const mapContainer = document.getElementById('map-panel-popup');
  ensureMapZoomControls(mapContainer, width, height);

  setupMapZoom({
    svgElement,
    g,
    projection,
    width,
    height,
    mapType: 'us',
    onZoom: () => {}
  });

  attachMapPointerLeaveSafety(svgElement, g);
  attachMapWheelCapture();
  updateMapViewAnchorState(projection, width, height, 'us');
}

async function renderMapPanel() {
  const mapContainer = document.getElementById('map-panel-popup');
  if (!mapContainer || mapContainer.style.display === 'none') return;

  const svg = mapContainer.querySelector('#map-svg');
  if (!svg) return;

  if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  const { width, height } = syncMapSvgSize(mapContainer, svg);
  const generation = beginMapRender();

  const latLongCols = detectLatLongColumns();
  const countryCodeCol = detectCountryCodeColumn();
  const fipsCol = detectFIPSColumn();

  if (!latLongCols && !countryCodeCol && !fipsCol) {
    const svgEl = d3.select(svg);
    svgEl.selectAll('*').remove();
    svgEl.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', FONTS.size.base)
      .text('No geographic columns found in dataset');
    return;
  }

  if (latLongCols) {
    await renderLatLongMap(svg, width, height, generation);
  } else if (countryCodeCol) {
    await renderWorldMap(svg, width, height, generation);
  } else {
    await renderUSMap(svg, width, height, generation);
  }

  if (isMapRenderStale(generation)) return;
}

window.renderMapPanel = renderMapPanel;
window.syncMapSvgSize = syncMapSvgSize;
window.detectFIPSColumn = detectFIPSColumn;
window.detectCountryCodeColumn = detectCountryCodeColumn;
window.detectLatLongColumns = detectLatLongColumns;
