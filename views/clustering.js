/**
 * K-means clustering for Color by Cluster mode.
 * Clusters always use the full dataset (appState.jsonData), not filtered rows.
 */

const CLUSTER_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7'
];

const CLUSTER_SEED = 42;
const KMEANS_MAX_ITERATIONS = 100;

function createSeededRandom(seed = CLUSTER_SEED) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function toNumberOrNaN(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === undefined || value === null || value === '..') return NaN;
  const parsed = parseFloat(String(value).trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function percentileSorted(sorted, p) {
  const n = sorted.length;
  if (n === 0) return NaN;
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function getClusterExcludedColumns() {
  const excluded = new Set(['__displayName', '__beeswarmRowId', '__clusterRowIndex']);
  if (window.appState.dataColumn) excluded.add(window.appState.dataColumn);
  if (window.appState.geoMode === 'country') excluded.add('Country');
  if (window.appState.geoMode === 'county') {
    excluded.add('County');
    excluded.add('State');
  }
  if (typeof window.isFipsColumnName === 'function') {
    const metrics = typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [];
    metrics.forEach(col => {
      if (window.isFipsColumnName(col)) excluded.add(col);
    });
  }
  if (typeof window.detectLatLongColumns === 'function') {
    const latLong = window.detectLatLongColumns();
    if (latLong) {
      excluded.add(latLong.lat);
      excluded.add(latLong.long);
    }
  }
  if (typeof window.detectCountryCodeColumn === 'function') {
    const countryCodeCol = window.detectCountryCodeColumn();
    if (countryCodeCol) excluded.add(countryCodeCol);
  }
  return excluded;
}

function getEligibleClusterFeatures() {
  const numericMetrics = typeof window.getNumericMetrics === 'function'
    ? window.getNumericMetrics()
    : [];
  const excluded = getClusterExcludedColumns();
  const rows = window.appState.jsonData || [];
  if (rows.length === 0) return [];

  return numericMetrics.filter(col => {
    if (excluded.has(col)) return false;
    let validCount = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const value = toNumberOrNaN(row[col]);
      if (!Number.isFinite(value)) continue;
      validCount += 1;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (validCount < 2) return false;
    return min !== max;
  });
}

function getClusterRowIndex(row) {
  if (!row || !Array.isArray(window.appState.jsonData)) return -1;
  if (typeof row.__clusterRowIndex === 'number') return row.__clusterRowIndex;
  return window.appState.jsonData.indexOf(row);
}

function clusterLabelFromId(clusterId) {
  return `Cluster ${clusterId + 1}`;
}

function ensureClusterConfig() {
  if (!window.appState.clusterConfig) {
    window.appState.clusterConfig = {
      k: 4,
      scaling: 'percentile',
      featureColumns: []
    };
  }
  return window.appState.clusterConfig;
}

function resetClusterResult() {
  window.appState.clusterResult = null;
}

function syncClusterRowIndices() {
  const rows = window.appState.jsonData || [];
  rows.forEach((row, index) => {
    row.__clusterRowIndex = index;
  });
}

function buildFeatureMatrix(rows, featureColumns, scaling) {
  const n = rows.length;
  const d = featureColumns.length;
  const matrix = Array.from({ length: n }, () => new Float64Array(d));
  const centers = new Float64Array(d);

  featureColumns.forEach((col, j) => {
    const values = [];
    const rowValues = new Array(n);
    for (let i = 0; i < n; i++) {
      const value = toNumberOrNaN(rows[i][col]);
      rowValues[i] = value;
      if (Number.isFinite(value)) values.push(value);
    }
    values.sort((a, b) => a - b);

    let center = 0;
    let scale = 1;
    if (scaling === 'robust') {
      center = percentileSorted(values, 0.5);
      const q1 = percentileSorted(values, 0.25);
      const q3 = percentileSorted(values, 0.75);
      scale = (q3 - q1) || 1;
    } else if (scaling === 'standard') {
      const count = values.length;
      const mean = count ? values.reduce((sum, v) => sum + v, 0) / count : 0;
      const variance = count
        ? values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / count
        : 0;
      center = mean;
      scale = Math.sqrt(Math.max(variance, 1e-12));
    } else {
      center = 0;
      scale = 1;
    }
    centers[j] = center;

    for (let i = 0; i < n; i++) {
      const raw = rowValues[i];
      let transformed = 0;
      if (Number.isFinite(raw)) {
        if (scaling === 'percentile') {
          const smaller = values.filter(v => v < raw).length;
          const equal = values.filter(v => v === raw).length;
          transformed = (smaller + 0.5 * equal) / Math.max(values.length, 1);
        } else if (scaling === 'robust' || scaling === 'standard') {
          transformed = (raw - center) / scale;
        }
      } else if (scaling === 'percentile') {
        transformed = 0.5;
      } else {
        transformed = 0;
      }
      matrix[i][j] = transformed;
    }
  });

  return matrix;
}

function squaredDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

function initializeCentroidsKMeansPlusPlus(matrix, k, random) {
  const n = matrix.length;
  const d = matrix[0].length;
  const centroids = [];
  const firstIndex = Math.floor(random() * n);
  centroids.push(Float64Array.from(matrix[firstIndex]));

  const distances = new Float64Array(n);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = squaredDistance(matrix[i], centroid);
        if (dist < minDist) minDist = dist;
      }
      distances[i] = minDist;
      total += minDist;
    }

    if (total === 0) {
      const nextIndex = (firstIndex + c) % n;
      centroids.push(Float64Array.from(matrix[nextIndex]));
      continue;
    }

    let threshold = random() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      threshold -= distances[i];
      if (threshold <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push(Float64Array.from(matrix[chosen]));
  }

  return centroids;
}

function runKMeans(matrix, k) {
  const n = matrix.length;
  const d = matrix[0].length;
  const random = createSeededRandom(CLUSTER_SEED);
  const effectiveK = Math.max(1, Math.min(k, n));
  let centroids = initializeCentroidsKMeansPlusPlus(matrix, effectiveK, random);
  const assignments = new Array(n).fill(0);
  const distances = new Array(n).fill(0);

  for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < effectiveK; c++) {
        const dist = squaredDistance(matrix[i], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) changed = true;
      assignments[i] = bestCluster;
      distances[i] = Math.sqrt(bestDist);
    }

    const counts = new Array(effectiveK).fill(0);
    const sums = Array.from({ length: effectiveK }, () => new Float64Array(d));
    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      counts[cluster] += 1;
      for (let j = 0; j < d; j++) {
        sums[cluster][j] += matrix[i][j];
      }
    }

    for (let c = 0; c < effectiveK; c++) {
      if (counts[c] === 0) {
        const fallbackIndex = Math.floor(random() * n);
        centroids[c] = Float64Array.from(matrix[fallbackIndex]);
        continue;
      }
      for (let j = 0; j < d; j++) {
        centroids[c][j] = sums[c][j] / counts[c];
      }
    }

    if (!changed) break;
  }

  for (let i = 0; i < n; i++) {
    distances[i] = Math.sqrt(squaredDistance(matrix[i], centroids[assignments[i]]));
  }

  return { assignments, distances, centroids, effectiveK };
}

function computeClusters() {
  const rows = window.appState.jsonData || [];
  const config = ensureClusterConfig();
  syncClusterRowIndices();

  if (rows.length === 0) {
    resetClusterResult();
    return null;
  }

  const eligible = getEligibleClusterFeatures();
  const selectedFeatures = Array.isArray(config.featureColumns)
    ? config.featureColumns.filter(col => eligible.includes(col))
    : [];

  if (selectedFeatures.length === 0) {
    resetClusterResult();
    return null;
  }

  const requestedK = Math.max(2, Math.min(8, Number(config.k) || 4));
  const matrix = buildFeatureMatrix(rows, selectedFeatures, config.scaling || 'percentile');
  const { assignments, distances, centroids, effectiveK } = runKMeans(matrix, requestedK);

  const clusterSizes = {};
  const labels = [];
  for (let c = 0; c < effectiveK; c++) {
    const label = clusterLabelFromId(c);
    labels.push(label);
    clusterSizes[label] = 0;
  }
  assignments.forEach(clusterId => {
    const label = clusterLabelFromId(clusterId);
    clusterSizes[label] = (clusterSizes[label] || 0) + 1;
  });

  window.appState.clusterResult = {
    computed: true,
    k: effectiveK,
    scaling: config.scaling,
    featureColumns: selectedFeatures.slice(),
    assignments,
    distances,
    centroids,
    clusterSizes,
    labels
  };

  return window.appState.clusterResult;
}

function refreshClusterAssignments() {
  return computeClusters();
}

function refreshClusterColors() {
  const result = refreshClusterAssignments();
  if (window.appState.viewMode === 'category-final' && window.appState.categorySelectedMetricKey &&
      typeof window.renderBeeswarmCategoryFinal === 'function') {
    window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
  }
  if (window.appState.viewMode === 'category-final' && window.appState.finalViewMapMode &&
      typeof window.renderMapPanel === 'function') {
    window.renderMapPanel();
  }
  return result;
}

function initializeClusterConfigFromDataset() {
  const config = ensureClusterConfig();
  const eligible = getEligibleClusterFeatures();
  const previous = Array.isArray(config.featureColumns) ? config.featureColumns : [];
  const retained = previous.filter(col => eligible.includes(col));
  config.featureColumns = retained.length > 0 ? retained : eligible.slice();
  if (!Number.isFinite(config.k)) config.k = 4;
  config.k = Math.max(2, Math.min(8, config.k));
  if (!config.scaling) config.scaling = 'percentile';
}

window.CLUSTER_COLORS = CLUSTER_COLORS;
window.getEligibleClusterFeatures = getEligibleClusterFeatures;
window.getClusterRowIndex = getClusterRowIndex;
window.clusterLabelFromId = clusterLabelFromId;
window.ensureClusterConfig = ensureClusterConfig;
window.resetClusterResult = resetClusterResult;
window.syncClusterRowIndices = syncClusterRowIndices;
window.computeClusters = computeClusters;
window.refreshClusterAssignments = refreshClusterAssignments;
window.refreshClusterColors = refreshClusterColors;
window.initializeClusterConfigFromDataset = initializeClusterConfigFromDataset;
