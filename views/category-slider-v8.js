/**
 * Category Slider (Filter Select)
 * Provides metric listing driven by user-defined filters
 */

(function() {
  function filterSelectEnsureState() {
    if (!window.appState) return;
    if (!Array.isArray(window.appState.filterSelectFilters)) {
      window.appState.filterSelectFilters = [];
    }
    if (!Array.isArray(window.appState.filterSelectFilteredRows)) {
      window.appState.filterSelectFilteredRows = window.appState.jsonData
        ? window.appState.jsonData.slice()
        : [];
    }
    if (typeof window.appState.filterSelectFilterIdCounter !== 'number') {
      window.appState.filterSelectFilterIdCounter = 1;
    }
  }

  function getFilterableColumns() {
    if (!window.appState.jsonData || window.appState.jsonData.length === 0) return [];
    const firstRow = window.appState.jsonData[0];
    if (!firstRow) return [];
    return Object.keys(firstRow)
      .filter(key => key !== '__displayName')
      .sort((a, b) => a.localeCompare(b));
  }

  function getColumnType(column) {
    if (!column) return 'unknown';
    const nominalCols = Array.isArray(window.appState.nominalColumns)
      ? window.appState.nominalColumns
      : (typeof window.getNominalColumns === 'function' ? window.getNominalColumns() : []);
    if (nominalCols.includes(column)) return 'nominal';
    const numericCols = typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [];
    if (numericCols.includes(column)) return 'numeric';
    return 'unknown';
  }

  function getNominalOptions(column) {
    if (!column || !Array.isArray(window.appState.jsonData)) return [];
    const values = new Set();
    window.appState.jsonData.forEach(row => {
      const raw = row[column];
      if (raw === undefined || raw === null || raw === '..') return;
      const text = raw.toString().trim();
      if (text.length) values.add(text);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  function ensureFilterDefaults(filter) {
    if (!filter) return;
    filter.type = getColumnType(filter.column);
    if (filter.type === 'numeric') {
      if (!filter.operator) filter.operator = 'gt';
    } else {
      filter.operator = null;
    }
  }

  function filterSelectAddFilter(initial) {
    filterSelectEnsureState();
    const columns = getFilterableColumns();
    if (columns.length === 0) return;
    const preferredColumn = initial && initial.column ? initial.column : null;
    let baseColumn = preferredColumn;
    if (!baseColumn || getColumnType(baseColumn) === 'unknown') {
      baseColumn = columns.find(col => getColumnType(col) !== 'unknown') || columns[0];
    }
    const newFilter = {
      id: `fs-${window.appState.filterSelectFilterIdCounter++}`,
      column: baseColumn,
      operator: initial && initial.operator ? initial.operator : 'gt',
      value: initial && typeof initial.value !== 'undefined' ? initial.value : '',
      type: getColumnType(baseColumn)
    };
    window.appState.filterSelectFilters.push(newFilter);
    filterSelectRenderControls();
    filterSelectHandleFiltersUpdated();
  }

  function filterSelectRemoveFilter(filterId) {
    filterSelectEnsureState();
    window.appState.filterSelectFilters = window.appState.filterSelectFilters.filter(f => f.id !== filterId);
    filterSelectRenderControls();
    filterSelectHandleFiltersUpdated();
  }

  function filterSelectUpdateInfo(filteredRows) {
    const infoEl = document.getElementById('filter-select-info');
    if (!infoEl) return;
    const total = window.appState.jsonData ? window.appState.jsonData.length : 0;
    const activeFilters = window.appState.filterSelectFilters ? window.appState.filterSelectFilters.length : 0;
    const matchCount = Array.isArray(filteredRows) ? filteredRows.length : 0;
    if (total === 0) {
      infoEl.textContent = 'Dataset is empty.';
    } else if (activeFilters === 0) {
      infoEl.textContent = `${total} records available (no filters applied).`;
    } else {
      infoEl.textContent = `${matchCount} of ${total} records match current filters.`;
    }
  }

  function filterSelectRowPasses(row, filter) {
    if (!filter || !filter.column) return true;
    const rawValue = row[filter.column];
    if (filter.type === 'nominal') {
      if (!filter.value) return true;
      if (rawValue === undefined || rawValue === null || rawValue === '..') return false;
      return rawValue.toString().trim() === filter.value;
    }
    if (filter.type === 'numeric') {
      const threshold = parseFloat(filter.value);
      if (Number.isNaN(threshold)) return true;
      const numeric = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (Number.isNaN(numeric)) return false;
      if (filter.operator === 'lt') {
        return numeric < threshold;
      }
      return numeric > threshold;
    }
    return true;
  }

  function filterSelectApplyFilters() {
    filterSelectEnsureState();
    let rows = Array.isArray(window.appState.jsonData) ? window.appState.jsonData.slice() : [];
    const filters = window.appState.filterSelectFilters || [];
    if (filters.length > 0) {
      rows = rows.filter(row => filters.every(filter => filterSelectRowPasses(row, filter)));
    }
    window.appState.filterSelectFilteredRows = rows;
    filterSelectUpdateInfo(rows);
    return rows;
  }

  function filterSelectHandleFiltersUpdated() {
    const rows = filterSelectApplyFilters();
    if (window.appState.viewMode === 'category-v8' && typeof window.renderCategoryMetricListV8 === 'function') {
      window.renderCategoryMetricListV8({ preserveSelection: true, prefilteredRows: rows });
    }
    // Also handle Final View
    if (window.appState.viewMode === 'category-final') {
      if (typeof window.renderCategoryMetricListFinal === 'function') {
        window.renderCategoryMetricListFinal();
      }
      if (window.appState.categorySelectedMetricKey && typeof window.renderBeeswarmCategoryFinal === 'function') {
        window.renderBeeswarmCategoryFinal(window.appState.categorySelectedMetricKey);
      }
    }
  }

  function renderFilterRow(filter) {
    const rowEl = document.createElement('div');
    rowEl.className = 'filter-row';

    // First line: column select and remove button
    const firstLine = document.createElement('div');
    firstLine.className = 'filter-row-line';
    firstLine.style.cssText = 'display: flex; align-items: center; gap: 6px; width: 100%;';

    const columnSelect = document.createElement('select');
    columnSelect.style.flex = '1';
    const columns = getFilterableColumns();
    columns.forEach(col => {
      const option = document.createElement('option');
      option.value = col;
      option.textContent = window.formatMetricName ? window.formatMetricName(col) : col;
      columnSelect.appendChild(option);
    });
    columnSelect.value = filter.column || (columns[0] || '');
    columnSelect.addEventListener('change', () => {
      filter.column = columnSelect.value;
      filter.value = '';
      ensureFilterDefaults(filter);
      filterSelectRenderControls();
      filterSelectHandleFiltersUpdated();
    });
    firstLine.appendChild(columnSelect);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'filter-remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => filterSelectRemoveFilter(filter.id));
    firstLine.appendChild(removeBtn);

    rowEl.appendChild(firstLine);

    ensureFilterDefaults(filter);

    // Second line: value/record selector
    const secondLine = document.createElement('div');
    secondLine.className = 'filter-row-line';
    secondLine.style.cssText = 'display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 6px;';

    if (filter.type === 'nominal') {
      const valueSelect = document.createElement('select');
      valueSelect.style.flex = '1';
      const optionEmpty = document.createElement('option');
      optionEmpty.value = '';
      optionEmpty.textContent = 'Select value…';
      valueSelect.appendChild(optionEmpty);
      const options = getNominalOptions(filter.column);
      options.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        valueSelect.appendChild(option);
      });
      valueSelect.value = filter.value || '';
      valueSelect.addEventListener('change', () => {
        filter.value = valueSelect.value;
        filterSelectHandleFiltersUpdated();
      });
      secondLine.appendChild(valueSelect);
    } else if (filter.type === 'numeric') {
      const operatorSelect = document.createElement('select');
      operatorSelect.style.width = '50px';
      [
        { value: 'gt', label: '>' },
        { value: 'lt', label: '<' }
      ].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        operatorSelect.appendChild(option);
      });
      operatorSelect.value = filter.operator || 'gt';
      operatorSelect.addEventListener('change', () => {
        filter.operator = operatorSelect.value;
        filterSelectHandleFiltersUpdated();
      });
      secondLine.appendChild(operatorSelect);

      const input = document.createElement('input');
      input.type = 'number';
      input.placeholder = 'Value';
      input.style.flex = '1';
      if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
        input.value = filter.value;
      }
      input.addEventListener('input', () => {
        filter.value = input.value;
        filterSelectHandleFiltersUpdated();
      });
      secondLine.appendChild(input);
    } else {
      const note = document.createElement('span');
      note.textContent = 'Unsupported column type';
      note.style.fontSize = '12px';
      note.style.color = '#9ca3af';
      secondLine.appendChild(note);
    }

    rowEl.appendChild(secondLine);

    return rowEl;
  }

  function filterSelectRenderControls() {
    filterSelectEnsureState();
    const container = document.getElementById('filter-select-filters');
    if (!container) return;
    container.innerHTML = '';

    const filters = window.appState.filterSelectFilters || [];
    if (filters.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'filter-empty';
      empty.textContent = 'No filters applied.';
      container.appendChild(empty);
    } else {
      filters.forEach(filter => {
        container.appendChild(renderFilterRow(filter));
      });
    }
  }

  function computeMetricAverage(metricKey, filteredRows) {
    if (!Array.isArray(filteredRows) || filteredRows.length === 0) return NaN;
    const values = filteredRows
      .map(row => {
        const raw = row[metricKey];
        if (raw === undefined || raw === null || raw === '..') return NaN;
        return typeof raw === 'number' ? raw : parseFloat(raw);
      })
      .filter(v => Number.isFinite(v));
    if (values.length === 0) return NaN;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  function renderCategoryMetricListV8(options = {}) {
    filterSelectEnsureState();
    const listEl = document.getElementById('indicator-list');
    if (!listEl) return;
    const preserveSelection = !!options.preserveSelection;
    const prefilteredRows = options.prefilteredRows;
    const filteredRows = Array.isArray(prefilteredRows) ? prefilteredRows : filterSelectApplyFilters();
    window.appState.filterSelectFilteredRows = filteredRows;

    listEl.innerHTML = '';

    if (!filteredRows || filteredRows.length === 0) {
      const message = document.createElement('div');
      message.className = 'no-metrics';
      message.textContent = 'No records match the current filters.';
      listEl.appendChild(message);
      const svg = d3.select('#beeswarm-svg');
      if (!svg.empty()) svg.selectAll('*').remove();
      window.appState.categorySelectedMetricKey = null;
      window.appState.categorySnapPoints = [];
      return;
    }

    // Exclude FIPS code metrics (handle variants: "FIPS_Code", "F I P S Code", "FIPS Code", etc.)
    const allMetrics = typeof window.getNumericMetrics === 'function' ? window.getNumericMetrics() : [];
    const metrics = allMetrics.filter(m => {
      const norm = (m || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm !== 'fipscode';
    });
    if (!metrics || metrics.length === 0) {
      const message = document.createElement('div');
      message.className = 'no-metrics';
      message.textContent = 'No numeric metrics available in this dataset.';
      listEl.appendChild(message);
      return;
    }

    const decorated = metrics.map(metricKey => ({
      key: metricKey,
      average: computeMetricAverage(metricKey, filteredRows)
    }));
    decorated.sort((a, b) => {
      if (Number.isNaN(b.average) && Number.isNaN(a.average)) return 0;
      if (Number.isNaN(b.average)) return -1;
      if (Number.isNaN(a.average)) return 1;
      return b.average - a.average;
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'category-slider';
    const labelsCol = document.createElement('div');
    labelsCol.className = 'category-labels';
    const railCol = document.createElement('div');
    railCol.className = 'category-rail';
    const track = document.createElement('div');
    track.className = 'category-rail-track';
    const handle = document.createElement('div');
    handle.className = 'category-handle';
    track.appendChild(handle);
    railCol.appendChild(track);

    decorated.forEach(({ key, average }) => {
      const item = document.createElement('div');
      item.className = 'category-label';
      item.dataset.metricKey = key;
      item.dataset.average = Number.isFinite(average) ? average : NaN;

      const metricName = document.createElement('span');
      metricName.textContent = window.formatMetricName ? window.formatMetricName(key) : key;

      const percentileSpan = document.createElement('span');
      percentileSpan.style.cssText = 'float: right; font-weight: bold; color: #000000;';
      if (Number.isFinite(average)) {
        percentileSpan.textContent = average >= 1000
          ? average.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : average.toFixed(2);
      } else {
        percentileSpan.textContent = '';
      }

      item.appendChild(metricName);
      item.appendChild(percentileSpan);
      labelsCol.appendChild(item);
    });

    wrapper.appendChild(labelsCol);
    wrapper.appendChild(railCol);
    listEl.appendChild(wrapper);

    window.appState.categorySelectedMetricKey = preserveSelection
      ? window.appState.categorySelectedMetricKey
      : null;

    requestAnimationFrame(() => {
      track.style.height = labelsCol.clientHeight + 'px';
      const labelNodes = Array.from(labelsCol.querySelectorAll('.category-label'));
      const containerHeight = labelsCol.clientHeight;
      const labelCount = labelNodes.length;
      const totalPadding = 20;
      const availableHeight = containerHeight - totalPadding;
      const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;

      labelNodes.forEach((node, index) => {
        const position = totalPadding / 2 + (index * spacing);
        node.style.top = position + 'px';
      });

      const computeSnapPoints = () => {
        window.appState.categorySnapPoints = labelNodes.map(node => parseFloat(node.style.top) || 0);
      };
      computeSnapPoints();

      track.style.background = '#e5e7eb';

      const desiredKey = preserveSelection && window.appState.categorySelectedMetricKey
        ? window.appState.categorySelectedMetricKey
        : (decorated[0] ? decorated[0].key : null);
      const defaultIdx = desiredKey
        ? Math.max(0, labelNodes.findIndex(n => n.dataset.metricKey === desiredKey))
        : 0;

      selectCategoryIndex(defaultIdx, { render: true });

      labelNodes.forEach((node, idx) => {
        node.addEventListener('click', () => selectCategoryIndex(idx, { render: true }));
      });

      let dragging = false;
      const onPointerMove = (evt) => {
        evt.preventDefault();
        if (!dragging) return;
        const trackRect = track.getBoundingClientRect();
        const y = evt.clientY - trackRect.top;
        let nearestIdx = 0;
        let minDist = Infinity;
        window.appState.categorySnapPoints.forEach((p, i) => {
          const d = Math.abs(p - y);
          if (d < minDist) {
            minDist = d;
            nearestIdx = i;
          }
        });
        selectCategoryIndex(nearestIdx, { render: true });
      };
      const onPointerUp = () => {
        dragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };
      handle.addEventListener('pointerdown', (evt) => {
        evt.preventDefault();
        dragging = true;
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
      });
      track.addEventListener('pointerdown', (evt) => {
        const trackRect = track.getBoundingClientRect();
        const y = evt.clientY - trackRect.top;
        let nearestIdx = 0;
        let minDist = Infinity;
        window.appState.categorySnapPoints.forEach((p, i) => {
          const d = Math.abs(p - y);
          if (d < minDist) {
            minDist = d;
            nearestIdx = i;
          }
        });
        selectCategoryIndex(nearestIdx, { render: true });
      });

      const updatePositionsAndSnapPoints = () => {
        const newContainerHeight = labelsCol.clientHeight;
        track.style.height = newContainerHeight + 'px';
        const totalPadding = 20;
        const availableHeight = newContainerHeight - totalPadding;
        const spacing = labelCount > 1 ? availableHeight / (labelCount - 1) : 0;

        labelNodes.forEach((node, index) => {
          const position = totalPadding / 2 + (index * spacing);
          node.style.top = position + 'px';
        });

        computeSnapPoints();

        const active = listEl.querySelector('.category-label.active');
        if (active) {
          const labels = Array.from(listEl.querySelectorAll('.category-label'));
          const idx = labels.indexOf(active);
          if (idx >= 0 && window.appState.categorySnapPoints[idx] != null) {
            handle.style.top = window.appState.categorySnapPoints[idx] + 'px';
          }
        }
      };

      labelsCol.addEventListener('scroll', updatePositionsAndSnapPoints);
      window.addEventListener('resize', updatePositionsAndSnapPoints);

      function selectCategoryIndex(index, opts = {}) {
        const { render = true } = opts;
        const labels = Array.from(listEl.querySelectorAll('.category-label'));
        if (index < 0 || index >= labels.length) return;
        labels.forEach(l => l.classList.remove('active'));
        const selected = labels[index];
        if (!selected) return;
        selected.classList.add('active');
        const metricKey = selected.dataset.metricKey;
        window.appState.categorySelectedMetricKey = metricKey;
        if (window.appState.categorySnapPoints && window.appState.categorySnapPoints[index] != null) {
          handle.style.top = window.appState.categorySnapPoints[index] + 'px';
        }
        if (render && typeof window.renderBeeswarmCategoryFilter === 'function') {
          window.renderBeeswarmCategoryFilter(metricKey);
        }
      }
    });
  }

  // Expose functions globally
  window.filterSelectEnsureState = filterSelectEnsureState;
  window.filterSelectRenderControls = filterSelectRenderControls;
  window.filterSelectAddFilter = filterSelectAddFilter;
  window.filterSelectApplyFilters = filterSelectApplyFilters;
  window.renderCategoryMetricListV8 = renderCategoryMetricListV8;
})();

