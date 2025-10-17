# Project Structure

This application has been refactored into a modular structure for better maintainability.

## File Organization

### Main Files
- `index.html` - Main HTML file, now streamlined with imports
- `styles.css` - All CSS styles (unchanged)
- `index-old-backup.html` - Backup of the original monolithic file

### Views Folder (`views/`)

All view logic has been extracted into separate JavaScript modules:

#### Core Utilities
- `shared.js` - Shared utilities, state management, and helper functions
- `data-loader.js` - Data loading and processing logic

#### View Modules
- `percentile-scroll.js` - Percentile Scroll view (main scrolling view)
- `location-identifier.js` - Horizontal view with horizontal beeswarm
- `category-slider.js` - Category Slider (Distributed) (percentile-based positioning)
- `category-slider-v2.js` - Category Slider (Color ramp) (evenly spaced labels)
- `category-slider-v3.js` - Category Slider (Country Detailed) (country code labels)
- `box-whisker.js` - Box and Whisker view
- `beeswarm-category.js` - Beeswarm rendering for category sliders
- `beeswarm-category-v3.js` - Beeswarm rendering with country codes/continents
- `box-plot.js` - Box plot rendering

## Key Features

### State Management
All global state is now centralized in `window.appState` object:
- `jsonData` - The loaded dataset
- `entities` - List of countries/counties
- `currentPercentiles` - Calculated percentiles for selected entity
- `selectedCountry` - Currently selected entity
- `geoMode` - 'country' or 'county'
- `viewMode` - Current view mode
- `categorySelectedMetricKey` - Selected metric in category views
- `categorySnapPoints` - Slider snap points
- `previousBeeswarmNodes` - For smooth transitions

### Shared Functions
All utility functions are exposed on the `window` object for cross-module access:
- `formatMetricName()` - Format metric names
- `getPercentileColor()` - Get color for percentile value
- `createPercentileGradient()` - Create CSS gradient
- `calculatePercentiles()` - Calculate percentiles for entity
- `getNumericMetrics()` - Get list of numeric metrics
- `formatValue()` - Format values based on metric type
- `updateCountryInfo()` - Update UI with selected entity

## Benefits of Modular Structure

1. **Better Maintainability** - Each view is isolated in its own file
2. **Easier Debugging** - Smaller, focused files are easier to debug
3. **Improved Collaboration** - Multiple developers can work on different views
4. **Code Reusability** - Shared utilities are centralized
5. **Performance** - Browser can cache individual modules
6. **Scalability** - Easy to add new views or modify existing ones

## Development

To run the application:
```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`

## File Sizes

The original `index.html` was ~2877 lines. The new structure:
- `index.html`: ~400 lines (86% reduction!)
- Total across all modules: Similar total size, but much more organized

