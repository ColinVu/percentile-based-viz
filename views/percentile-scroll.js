/**
 * Percentile Scroll View
 * The main scrolling percentile view
 */

// Create percentile steps for scrolling
function createPercentileSteps() {
  const scrollSection = document.getElementById('scroll-section');
  scrollSection.innerHTML = '';
  
  // Create steps from 0 to 100 by 5
  for (let i = 0; i <= 100; i += 5) {
    const step = document.createElement('div');
    step.className = 'step';
    step.setAttribute('data-step', i);
    
    step.innerHTML = `
      <div class="step-content">
        <div class="percentile-label">${i}%</div>
        <div class="percentile-description">
          ${i === 0 ? 'Lowest percentile' : 
            i === 100 ? 'Highest percentile' : 
            `${i}th percentile`}
        </div>
      </div>
    `;
    
    scrollSection.appendChild(step);
  }
}

// Initialize scrollama
function initScrollama() {
  if (typeof scrollama !== 'undefined') {
    window.appState.scroller = scrollama();
    
    window.appState.scroller
      .setup({
        step: '.step',
        offset: 0.35,
        debug: false
      })
      .onStepEnter(handleStepEnter);
    
    // Handle resize
    window.addEventListener('resize', window.appState.scroller.resize);
  } else {
    console.error('Scrollama library not loaded');
  }
}

// Handle step enter event
function handleStepEnter(response) {
  // Remove active class from all steps
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('is-active');
  });
  
  // Add active class to current step
  response.element.classList.add('is-active');
  
  // Get current percentile
  const percentile = parseInt(response.element.getAttribute('data-step'));
  
  // Update metrics display
  updateMetricsDisplay(percentile);
}

// Find metrics closest to a given percentile
function findClosestMetricsSimplified(targetPercentile, tolerance = 5) {
  if (Object.keys(window.appState.currentPercentiles).length === 0) return [];
  
  // Convert target to number
  const target = parseInt(targetPercentile);
  
  // 1. First pass: Find the absolute closest metric regardless of tolerance
  const entries = Object.entries(window.appState.currentPercentiles);
  
  const matches = entries.filter(([_, data]) => {
    const bucket = Math.round(data.percentile / 5) * 5; // or Math.floor(...) * 5 if you prefer lower binning
    return bucket === target;
  });
  
  matches.sort((a, b) => a[1].percentile - b[1].percentile);
  
  return matches.map(([metric, data]) => ({
    metric,
    value: data.value,
    percentile: data.percentile,
    diff: Math.abs(data.percentile - target)
  }));
}

// Update metrics display based on percentile
function updateMetricsDisplay(percentile) {
  // Update percentile display
  document.getElementById('percentile-display').textContent = `${percentile}%`;
  
  // If no selection, don't proceed
  if (!window.appState.selectedCountry) {
    document.getElementById('metric-cards').innerHTML = 
      (window.appState.geoMode === 'country' 
        ? '<div class="no-metrics">Please select a country to view metrics</div>'
        : '<div class="no-metrics">Please select a county to view metrics</div>');
    return;
  }
  
  // Find closest metrics
  const closestMetrics = findClosestMetricsSimplified(percentile);
  
  // Update metrics display
  const metricsContainer = document.getElementById('metric-cards');
  metricsContainer.innerHTML = '';
  
  if (closestMetrics.length === 0) {
    metricsContainer.innerHTML = '<div class="no-metrics">No metrics found at this percentile</div>';
    return;
  }
  
  // Display metrics
  closestMetrics.forEach(item => {
    const metricCard = document.createElement('div');
    metricCard.className = 'metric-card';
    
    // Set border color based on how close it is to the target (closer = more vibrant)
    const colorIntensity = Math.max(0, 100 - item.diff * 10);
    metricCard.style.borderLeftColor = `hsla(204, 70%, 53%, ${colorIntensity}%)`;
    
    metricCard.innerHTML = `
      <div class="metric-name">${window.formatMetricName(item.metric)}</div>
      <div class="metric-value">Value: ${window.formatValue(item.value, item.metric)}</div>
      <div class="metric-percentile">Percentile: ${item.percentile}%</div>
    `;
    
    metricsContainer.appendChild(metricCard);
  });
}

// Export functions
window.createPercentileSteps = createPercentileSteps;
window.initScrollama = initScrollama;
window.updateMetricsDisplay = updateMetricsDisplay;

