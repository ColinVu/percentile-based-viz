/**
 * Category Slider (Multi-Select)
 * Clone of Category Slider V2 with multi-selection support
 */

function multiSelectEnsureState() {
  if (!window.appState) return;
  if (!Array.isArray(window.appState.multiSelectedLabels)) {
    window.appState.multiSelectedLabels = [];
  }
  const validLabels = new Set(window.appState.entities || []);
  window.appState.multiSelectedLabels = window.appState.multiSelectedLabels
    .filter(label => label && (validLabels.size === 0 || validLabels.has(label)));

  const primary = window.appState.selectedCountry;
  if (primary) {
    if (!window.appState.multiSelectedLabels.includes(primary)) {
      window.appState.multiSelectedLabels.unshift(primary);
    } else {
      window.appState.multiSelectedLabels = [
        primary,
        ...window.appState.multiSelectedLabels.filter(l => l !== primary)
      ];
    }
  } else if (window.appState.multiSelectedLabels.length > 0) {
    window.appState.selectedCountry = window.appState.multiSelectedLabels[0];
  } else if (validLabels.size > 0) {
    const first = window.appState.entities[0];
    if (first) {
      window.appState.selectedCountry = first;
      window.appState.multiSelectedLabels = [first];
    }
  }
}

function multiSelectSetPrimary(label, opts = {}) {
  if (!label) return;
  multiSelectEnsureState();
  const preserveOthers = !!opts.preserveOthers;
  const remaining = window.appState.multiSelectedLabels.filter(l => l && l !== label);
  window.appState.selectedCountry = label;
  window.appState.multiSelectedLabels = preserveOthers ? [label, ...remaining] : [label];

  const selectEl = document.getElementById('countrySelect');
  if (selectEl) {
    const exists = Array.from(selectEl.options).some(o => o.value === label);
    if (exists) selectEl.value = label;
  }
  if (window.calculatePercentiles) {
    window.calculatePercentiles(label);
  }
  if (window.updateCountryInfo) {
    window.updateCountryInfo();
  }
}

function multiSelectAddLabel(label) {
  if (!label) return;
  multiSelectEnsureState();
  if (!window.appState.multiSelectedLabels.includes(label)) {
    window.appState.multiSelectedLabels.push(label);
  }
  if (!window.appState.selectedCountry) {
    multiSelectSetPrimary(label, { preserveOthers: true });
  }
}

function multiSelectClearSecondary() {
  multiSelectEnsureState();
  const primary = window.appState.selectedCountry;
  window.appState.multiSelectedLabels = primary ? [primary] : [];
}

function multiSelectUpdateBox() {
  const container = document.getElementById('multi-selection-box');
  if (!container) return;
  const listEl = document.getElementById('multi-selection-list') || container.querySelector('.multi-selection-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  multiSelectEnsureState();
  const labels = window.appState.multiSelectedLabels || [];
  if (labels.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'multi-selection-chip empty';
    empty.textContent = 'No selections';
    listEl.appendChild(empty);
    return;
  }

  const availableSet = window.appState.multiSelectAvailableLabels instanceof Set
    ? window.appState.multiSelectAvailableLabels
    : null;

  labels.forEach(label => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'multi-selection-chip';
    if (label === window.appState.selectedCountry) {
      chip.classList.add('primary');
    }
    const hasData = !availableSet || availableSet.has(label);
    if (!hasData) {
      chip.classList.add('missing');
      chip.title = 'No data for selected metric';
    }
    chip.textContent = label;
    chip.addEventListener('click', () => {
      multiSelectSetPrimary(label, { preserveOthers: true });
      multiSelectUpdateBox();
      if (typeof window.renderCategoryMetricListV7 === 'function') {
        window.renderCategoryMetricListV7();
      }
    });
    listEl.appendChild(chip);
  });
}

function renderCategoryMetricListV7() {
  const listEl = document.getElementById('indicator-list');
  if (!listEl) return;
  const metrics = window.getNumericMetrics();
  listEl.innerHTML = '';

  multiSelectEnsureState();

  if (typeof window.multiSelectUpdateBox === 'function') {
    window.multiSelectUpdateBox();
  }

  if (window.appState.selectedCountry) {
    window.calculatePercentiles(window.appState.selectedCountry);
  }

  const decorated = metrics.map(m => ({
    key: m,
    pct: (window.appState.currentPercentiles[m] && typeof window.appState.currentPercentiles[m].percentile === 'number')
      ? window.appState.currentPercentiles[m].percentile
      : -1
  }));
  decorated.sort((a, b) => b.pct - a.pct);

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

  decorated.forEach(({ key, pct }) => {
    const item = document.createElement('div');
    item.className = 'category-label';
    item.dataset.metricKey = key;
    item.dataset.percentile = pct >= 0 ? pct : -1;

    const metricName = document.createElement('span');
    metricName.textContent = window.formatMetricName(key);

    const percentileSpan = document.createElement('span');
    percentileSpan.style.cssText = 'float: right; font-weight: bold; color: #000000;';
    percentileSpan.textContent = pct >= 0 ? `${pct}%` : '';

    item.appendChild(metricName);
    item.appendChild(percentileSpan);
    labelsCol.appendChild(item);
  });

  wrapper.appendChild(labelsCol);
  wrapper.appendChild(railCol);
  listEl.appendChild(wrapper);

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

    const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
    const gradient = window.createPercentileGradient(percentiles);
    track.style.background = gradient;

    const defaultIdx = Math.max(
      0,
      window.appState.categorySelectedMetricKey
        ? labelNodes.findIndex(n => n.dataset.metricKey === window.appState.categorySelectedMetricKey)
        : 0
    );
    selectCategoryIndexV7(defaultIdx, { render: true });

    labelNodes.forEach((node, idx) => {
      node.addEventListener('click', () => selectCategoryIndexV7(idx, { render: true }));
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
      selectCategoryIndexV7(nearestIdx, { render: true });
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
      selectCategoryIndexV7(nearestIdx, { render: true });
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

      const percentiles = labelNodes.map(node => parseFloat(node.dataset.percentile) || 0);
      const gradient = window.createPercentileGradient(percentiles);
      track.style.background = gradient;

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
  });

  function selectCategoryIndexV7(index, opts = {}) {
    const { render = true } = opts;
    const labels = Array.from(listEl.querySelectorAll('.category-label'));
    if (index < 0 || index >= labels.length) return;
    labels.forEach(l => l.classList.remove('active'));
    const selected = labels[index];
    selected.classList.add('active');
    const metricKey = selected.dataset.metricKey;
    window.appState.categorySelectedMetricKey = metricKey;
    if (window.appState.categorySnapPoints && window.appState.categorySnapPoints[index] != null) {
      const handle = listEl.querySelector('.category-handle');
      if (handle) {
        handle.style.top = window.appState.categorySnapPoints[index] + 'px';
      }
    }
    if (render && typeof window.renderBeeswarmCategoryMultiSelect === 'function') {
      window.renderBeeswarmCategoryMultiSelect(metricKey);
    }
  }
}

window.multiSelectEnsureState = multiSelectEnsureState;
window.multiSelectSetPrimary = multiSelectSetPrimary;
window.multiSelectAddLabel = multiSelectAddLabel;
window.multiSelectClearSecondary = multiSelectClearSecondary;
window.multiSelectUpdateBox = multiSelectUpdateBox;
window.renderCategoryMetricListV7 = renderCategoryMetricListV7;

