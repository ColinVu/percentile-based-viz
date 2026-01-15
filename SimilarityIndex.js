/**
 * Similarity index for arbitrary records.
 * - Precomputes scaled numeric vectors for fast kNN queries.
 * - Supports selection by nominal column value.
 *
 * Complexity:
 *   Build: O(N*D) (+ optional sorts if robust stats)
 *   Query (scan): O(N*D) with tiny constant factors (Float32Array)
 */

function isFiniteNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
  }
  
  function toNumberOrNaN(x) {
    if (isFiniteNumber(x)) return x;
    const n = typeof x === "string" ? Number(x.trim()) : Number(x);
    return Number.isFinite(n) ? n : NaN;
  }
  
  function percentileSorted(sorted, p) {
    // p in [0,1]
    const n = sorted.length;
    if (n === 0) return NaN;
    const idx = (n - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const t = idx - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
  }
  
  function computeStats(records, numericCols, { scaling = "zscore" } = {}) {
    const stats = {};
    const N = records.length;
  
    if (scaling === "robust") {
      // median / IQR with sorting per column (more robust, slower to build)
      for (const col of numericCols) {
        const vals = [];
        for (let i = 0; i < N; i++) {
          const v = toNumberOrNaN(records[i][col]);
          if (Number.isFinite(v)) vals.push(v);
        }
        vals.sort((a, b) => a - b);
        const med = percentileSorted(vals, 0.5);
        const q1 = percentileSorted(vals, 0.25);
        const q3 = percentileSorted(vals, 0.75);
        const iqr = (q3 - q1) || 1; // avoid divide-by-zero
        stats[col] = { center: med, scale: iqr, impute: med };
      }
    } else {
      // z-score (mean/std) in one pass per column
      for (const col of numericCols) {
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < N; i++) {
          const v = toNumberOrNaN(records[i][col]);
          if (Number.isFinite(v)) {
            sum += v;
            sumSq += v * v;
            count++;
          }
        }
        const mean = count ? sum / count : 0;
        const varPop = count ? (sumSq / count - mean * mean) : 0;
        const std = Math.sqrt(Math.max(varPop, 1e-12)); // avoid zero
        stats[col] = { center: mean, scale: std, impute: mean };
      }
    }
  
    return stats;
  }
  
  function buildVectors(records, numericCols, stats) {
    const N = records.length;
    const D = numericCols.length;
    const vectors = new Array(N);
  
    for (let i = 0; i < N; i++) {
      const vec = new Float32Array(D);
      const r = records[i];
      for (let j = 0; j < D; j++) {
        const col = numericCols[j];
        const st = stats[col];
        let v = toNumberOrNaN(r[col]);
        if (!Number.isFinite(v)) v = st.impute;
        vec[j] = (v - st.center) / st.scale;
      }
      vectors[i] = vec;
    }
  
    return vectors;
  }
  
  function buildNominalIndex(records, nominalCols) {
    const idx = {};
    for (const col of nominalCols) idx[col] = new Map();
  
    for (let i = 0; i < records.length; i++) {
      for (const col of nominalCols) {
        const key = records[i][col];
        const m = idx[col];
        const arr = m.get(key);
        if (arr) arr.push(i);
        else m.set(key, [i]);
      }
    }
    return idx;
  }
  
  function squaredEuclidean(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return s;
  }
  
  function topKSimilar(vectors, queryIndex, k) {
    const q = vectors[queryIndex];
  
    // Keep a small "worst-first" list for k=3 (fast, no heap needed).
    const best = []; // entries: { i, d2 }
  
    for (let i = 0; i < vectors.length; i++) {
      if (i === queryIndex) continue;
      const d2 = squaredEuclidean(q, vectors[i]);
  
      if (best.length < k) {
        best.push({ i, d2 });
        best.sort((x, y) => y.d2 - x.d2); // worst first
      } else if (d2 < best[0].d2) {
        best[0] = { i, d2 };
        best.sort((x, y) => y.d2 - x.d2);
      }
    }
  
    // return best in nearest-first order
    best.sort((x, y) => x.d2 - y.d2);
    return best;
  }
  
  // Make SimilarityIndex available globally (not as ES module)
  window.SimilarityIndex = class SimilarityIndex {
    /**
     * @param {Array<Object>} records
     * @param {Object} options
     * @param {Array<string>} [options.numericCols]  - if omitted, inferred
     * @param {Array<string>} [options.nominalCols]  - nominal columns for lookup (optional)
     * @param {"zscore"|"robust"} [options.scaling]  - default "zscore"
     * @param {string} [options.idCol]               - stable ID column; else uses row index
     */
    constructor(records, options = {}) {
      this.records = records;
  
      const allCols = records.length ? Object.keys(records[0]) : [];
      const numericCols =
        options.numericCols ??
        allCols.filter((c) => {
          // infer numeric if most values parse as numbers
          let good = 0, seen = 0;
          for (let i = 0; i < Math.min(records.length, 50); i++) {
            const v = toNumberOrNaN(records[i][c]);
            if (records[i][c] == null || records[i][c] === "") continue;
            seen++;
            if (Number.isFinite(v)) good++;
          }
          return seen > 0 && good / seen >= 0.8; // threshold
        });
  
      const nominalCols = options.nominalCols ?? [];
  
      this.numericCols = numericCols;
      this.nominalCols = nominalCols;
      this.idCol = options.idCol ?? null;
  
      this.stats = computeStats(records, numericCols, { scaling: options.scaling ?? "zscore" });
      this.vectors = buildVectors(records, numericCols, this.stats);
      this.nominalIndex = buildNominalIndex(records, nominalCols);
  
      // Optional: map from id -> row index for stable selection
      this.idToRow = new Map();
      if (this.idCol) {
        for (let i = 0; i < records.length; i++) {
          this.idToRow.set(records[i][this.idCol], i);
        }
      }
    }
  
    rowIndexFromNominal(col, value) {
      const m = this.nominalIndex[col];
      if (!m) return null;
      const arr = m.get(value);
      if (!arr || arr.length === 0) return null;
      // If duplicates exist, you may want to choose based on current UI selection;
      // default: return the first match.
      return arr[0];
    }
  
    rowIndexFromId(id) {
      return this.idCol ? (this.idToRow.get(id) ?? null) : null;
    }
  
    /**
     * Query by row index.
     * @returns {Array<{record: Object, rowIndex: number, distance: number}>}
     */
    queryByRowIndex(rowIndex, k = 3) {
      const hits = topKSimilar(this.vectors, rowIndex, k);
      return hits.map(({ i, d2 }) => ({
        rowIndex: i,
        distance: Math.sqrt(d2),
        record: this.records[i],
      }));
    }
  
    /**
     * Query by nominal column/value (useful for UI-driven selection).
     */
    queryByNominal(col, value, k = 3) {
      const idx = this.rowIndexFromNominal(col, value);
      if (idx == null) return [];
      return this.queryByRowIndex(idx, k);
    }
  }; // End of SimilarityIndex class assignment
  