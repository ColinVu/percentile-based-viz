/**
 * Data loading and processing
 * Handles loading datasets and processing data
 */

// Load dataset based on selection
async function loadSelectedDataset() {
  const selectedDataset = document.querySelector('input[name="dataset"]:checked').value;
  
  // Show loading indicator
  document.querySelector('.loading').style.display = 'flex';
  
  try {
    if (selectedDataset === 'us-counties') {
      await loadUSCountyData();
    } else if (selectedDataset === 'country-development') {
      await loadCountryDevelopmentData();
    }
    // Custom dataset is handled by file input event
  } catch (error) {
    console.error('Error loading dataset:', error);
    alert('Error loading dataset. Please try again.');
  } finally {
    // Hide loading indicator
    document.querySelector('.loading').style.display = 'none';
  }
}

// Load US County indicators dataset
async function loadUSCountyData() {
  try {
    const response = await fetch('us-county-indicators.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    window.appState.jsonData = XLSX.utils.sheet_to_json(worksheet);
    processData();
  } catch (error) {
    console.error('Error loading US County data:', error);
    // Fallback to sample county data
    loadFallbackCountyData();
  }
}

// Load Country Development indicators dataset
async function loadCountryDevelopmentData() {
  try {
    const response = await fetch('CountryDevelopmentIndicators_withcode.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    window.appState.jsonData = XLSX.utils.sheet_to_json(worksheet);
    processData();
  } catch (error) {
    console.error('Error loading Country Development data:', error);
    // Fallback to sample country data
    loadFallbackCountryData();
  }
}

// Fallback sample data for US Counties (when file can't be loaded)
function loadFallbackCountyData() {
  window.appState.jsonData = [
    {
      "County": "Alameda",
      "State": "California",
      "Population": 1671329,
      "MedianIncome": 94588,
      "PovertyRate": 9.8,
      "UnemploymentRate": 4.1,
      "LifeExpectancy": 82.4,
      "EducationBachelor": 45.2,
      "HealthcareAccess": 91.2
    },
    {
      "County": "Cook",
      "State": "Illinois", 
      "Population": 5150233,
      "MedianIncome": 65886,
      "PovertyRate": 13.4,
      "UnemploymentRate": 5.2,
      "LifeExpectancy": 78.9,
      "EducationBachelor": 35.8,
      "HealthcareAccess": 87.6
    },
    {
      "County": "Harris",
      "State": "Texas",
      "Population": 4731145,
      "MedianIncome": 64588,
      "PovertyRate": 15.1,
      "UnemploymentRate": 4.8,
      "LifeExpectancy": 79.2,
      "EducationBachelor": 32.4,
      "HealthcareAccess": 82.1
    },
    {
      "County": "Maricopa",
      "State": "Arizona",
      "Population": 4485414,
      "MedianIncome": 68234,
      "PovertyRate": 12.8,
      "UnemploymentRate": 4.3,
      "LifeExpectancy": 80.1,
      "EducationBachelor": 31.7,
      "HealthcareAccess": 85.3
    },
    {
      "County": "Orange",
      "State": "California",
      "Population": 3186989,
      "MedianIncome": 94441,
      "PovertyRate": 9.2,
      "UnemploymentRate": 3.8,
      "LifeExpectancy": 83.1,
      "EducationBachelor": 42.1,
      "HealthcareAccess": 89.7
    }
  ];
  console.log('Using fallback US County data due to CORS restrictions');
  // Only show CORS info if running locally (file:// protocol)
  if (window.location.protocol === 'file:') {
    showCorsInfo();
  }
  processData();
}

// Fallback sample data for Countries (when file can't be loaded)
function loadFallbackCountryData() {
  window.appState.jsonData = [
    { 
      "Country": "United States",
      "Lifeexpectancyatbirth": 78.851,
      "Gross_national_income_percapita": 56140.23348,
      "Totalfertilityrate": 1.7764,
      "Meanyearsofschooling": 13.41344,
      "Population25Older_SomeSecondaryEducation": 95.58524,
      "MaternalMortality_per100Kbirths": 14,
      "PctInternetUsers": 87.26611,
      "PctMobilePhone": 123.68756,
      "MandatoryPaidMatLeave_Days": ".."
    },
    { 
      "Country": "Germany",
      "Lifeexpectancyatbirth": 81.334,
      "Gross_national_income_percapita": 46945.94358,
      "Totalfertilityrate": 1.586,
      "Meanyearsofschooling": 14.15564,
      "Population25Older_SomeSecondaryEducation": 96.95859,
      "MaternalMortality_per100Kbirths": 7,
      "PctInternetUsers": 87.74214,
      "PctMobilePhone": 132.64121,
      "MandatoryPaidMatLeave_Days": 98
    },
    { 
      "Country": "Japan",
      "Lifeexpectancyatbirth": 84.687,
      "Gross_national_income_percapita": 40799.47818,
      "Totalfertilityrate": 1.368,
      "Meanyearsofschooling": 13.36984,
      "Population25Older_SomeSecondaryEducation": "..",
      "MaternalMortality_per100Kbirths": 5,
      "PctInternetUsers": 91.79275,
      "PctMobilePhone": 139.21533,
      "MandatoryPaidMatLeave_Days": 98
    },
    { 
      "Country": "Brazil",
      "Lifeexpectancyatbirth": 75.887,
      "Gross_national_income_percapita": 14103.45182,
      "Totalfertilityrate": 1.736,
      "Meanyearsofschooling": 8.02056,
      "Population25Older_SomeSecondaryEducation": 58.51515,
      "MaternalMortality_per100Kbirths": 60,
      "PctInternetUsers": 70.70329,
      "PctMobilePhone": 104.70044,
      "MandatoryPaidMatLeave_Days": 120
    },
    { 
      "Country": "India",
      "Lifeexpectancyatbirth": 69.657,
      "Gross_national_income_percapita": 6426.674805,
      "Totalfertilityrate": 2.179,
      "Meanyearsofschooling": 6.49648,
      "Population25Older_SomeSecondaryEducation": 40.84507,
      "MaternalMortality_per100Kbirths": 145,
      "PctInternetUsers": 41.00000,
      "PctMobilePhone": 84.86432,
      "MandatoryPaidMatLeave_Days": 182
    }
  ];
  console.log('Using fallback Country Development data due to CORS restrictions');
  // Only show CORS info if running locally (file:// protocol)
  if (window.location.protocol === 'file:') {
    showCorsInfo();
  }
  processData();
}

// Show CORS information message
function showCorsInfo() {
  const corsInfo = document.getElementById('cors-info');
  if (corsInfo) {
    corsInfo.style.display = 'flex';
    // Auto-hide after 10 seconds
    setTimeout(() => {
      corsInfo.style.display = 'none';
    }, 10000);
  }
}

// Process the loaded data
function processData() {
  // Detect schema: Country vs County/State
  const firstRow = window.appState.jsonData && window.appState.jsonData.length > 0 ? window.appState.jsonData[0] : null;
  const hasCountry = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'Country');
  const hasCountyState = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'County') && Object.prototype.hasOwnProperty.call(firstRow, 'State');
  
  if (hasCountry) {
    window.appState.geoMode = 'country';
  } else if (hasCountyState) {
    window.appState.geoMode = 'county';
  } else {
    alert('Unsupported data format. Expect a "Country" column or "County" and "State" columns.');
    return;
  }
  
  // Populate dropdown
  const countrySelect = document.getElementById('countrySelect');
  const titleEl = document.getElementById('app-title');
  const nameEl = document.getElementById('country-name');
  
  if (window.appState.geoMode === 'country') {
    titleEl.textContent = 'Percentile Scroll';
    countrySelect.innerHTML = '<option value="">Select a country...</option>';
    nameEl.textContent = 'Select a country';
    window.appState.entities = window.appState.jsonData.map(d => d.Country).filter(Boolean).sort();
  } else {
    titleEl.textContent = 'US County Development Indicators - Percentile Scroll';
    countrySelect.innerHTML = '<option value="">Select a county...</option>';
    nameEl.textContent = 'Select a county';
    // Create a display label and keep original columns for filtering
    window.appState.jsonData.forEach(d => { d.__displayName = `${(d.County || '').toString().trim()}, ${(d.State || '').toString().trim()}`; });
    window.appState.entities = window.appState.jsonData
      .filter(d => d.County && d.State)
      .map(d => d.__displayName)
      .sort((a, b) => a.localeCompare(b));
  }
  
  window.appState.entities.forEach(label => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    countrySelect.appendChild(option);
  });
  
  // Set default selection
  if (window.appState.geoMode === 'country') {
    if (window.appState.entities.includes('United States')) {
      countrySelect.value = 'United States';
      window.appState.selectedCountry = 'United States';
    } else if (window.appState.entities.length > 0) {
      countrySelect.value = window.appState.entities[0];
      window.appState.selectedCountry = window.appState.entities[0];
    }
  } else {
    if (window.appState.entities.length > 0) {
      countrySelect.value = window.appState.entities[0];
      window.appState.selectedCountry = window.appState.entities[0];
    }
  }
  
  if (window.appState.selectedCountry) {
    window.calculatePercentiles(window.appState.selectedCountry);
    window.updateCountryInfo();
    if (window.updateMetricsDisplay) {
      window.updateMetricsDisplay(50);
    }
  }
}

// Export functions to window
window.loadSelectedDataset = loadSelectedDataset;
window.processData = processData;

