# Similar Records Feature

## Overview
Added functionality to show similar records when right-clicking a dot in the beeswarm chart while in "Encode by Selection" mode.

## Changes Made

### 1. Modified `views/data-loader.js`
- Added initialization of `SimilarityIndex` in the `processData()` function
- The index is initialized after data is loaded with:
  - Nominal columns (Country, County, State) for filtering
  - Robust scaling method for better outlier handling
- Added retry logic to wait for the SimilarityIndex module to load before initializing

### 2. Modified `views/beeswarm-category-final.js`
- Added `highlightBeeswarmElement(label, highlight)` function:
  - Finds and highlights/unhighlights circles or text elements in the beeswarm by label
  - Applies light blue highlight when hovering over similar records
  - Works with both circle and text encoding modes
  
- Added `selectRecord(label)` function:
  - Handles record selection when clicking a similar record
  - Works in both selection and normal encoding modes
  - Updates the selection table, percentiles, and re-renders the view
  
- Enhanced `showColorInputBox()` function:
  - Accepts an optional `recordLabel` parameter
  - When in selection encoding mode and `recordLabel` is provided:
    - Finds the 3 most similar records using the SimilarityIndex
    - Displays their names underneath the color input (without numbering)
    - Shows a separator and "Similar regions:" header
    - Makes each similar record interactive with hover and click handlers
  - Updated both circle and text label right-click handlers to pass the record label

### 3. Modified `index.html`
- Added script tag to load `SimilarityIndex.js` as a regular (non-module) script
- Ensures synchronous loading before other view component scripts
- Positioned after SheetJS but before view components

### 4. Modified `SimilarityIndex.js`
- Converted from ES module to regular script
- Changed `export class SimilarityIndex` to `window.SimilarityIndex = class SimilarityIndex`
- Ensures it's available globally and loads synchronously

## How It Works

1. **Dataset Loading**: When a dataset is loaded, the SimilarityIndex is initialized with all records and their numeric columns.

2. **Right-Click Detection**: When a user right-clicks a dot in the beeswarm chart:
   - The system checks if we're in "Encode by Selection" mode
   - If yes, it finds the row index of the clicked record

3. **Finding Similar Records**: 
   - Uses `SimilarityIndex.queryByRowIndex()` to find the 3 most similar records
   - Similarity is based on Euclidean distance in scaled numeric feature space
   - Missing values are imputed with column medians (robust scaling)

4. **Display**: The pop-up shows:
   - Color input box (existing functionality)
   - Horizontal separator
   - "Similar regions:" label
   - List of the 3 most similar record names (no numbering)

5. **Interactive Features**:
   - **Hover**: When hovering over a similar record name:
     - The name gets a light gray background in the pop-up
     - The corresponding dot/text in the beeswarm is highlighted in light blue
   - **Click**: Clicking a similar record name:
     - Selects that record (updates the active selection)
     - Updates the metric list to show that record's percentiles
     - Re-renders the beeswarm with the new selection
     - Closes the pop-up

## Usage

1. Switch to "Faxis" view mode (category-final)
2. Select "Encode by Selection" mode in the sidebar
3. Right-click any dot in the beeswarm chart
4. The pop-up will show:
   - Color input for changing the dot's color
   - The 3 most similar records to the clicked one

## Technical Details

### Similarity Calculation
- Uses all numeric columns in the dataset
- Applies robust scaling (median and IQR) to normalize values
- Computes Euclidean distance in scaled space
- Returns top-k nearest neighbors (k=3)

### Performance
- Index build: O(N×D) where N=records, D=numeric columns
- Query: O(N×D) for exhaustive search (fast for typical datasets)
- Uses Float32Array for efficient distance calculations

## Testing
To test the feature:
1. Load the Country Development or US County dataset
2. Navigate to Faxis view
3. Ensure "Encode by Selection" is selected
4. Add a few locations to the selection table
5. Right-click any colored dot in the beeswarm chart
6. Verify that 3 similar records appear below the color input (without numbering)
7. Hover over a similar record name:
   - The name should get a light gray background
   - The corresponding dot/text in the beeswarm should highlight in light blue
8. Click on a similar record name:
   - The pop-up should close
   - That record should become the active selection
   - The metric list should update to show that record's percentiles
   - The beeswarm should re-render with the new selection highlighted

## Notes
- Similar records only appear when in "Encode by Selection" mode
- If SimilarityIndex fails to initialize, the feature gracefully degrades (no similar records shown)
- The feature works with all dataset types (country, county, custom)
