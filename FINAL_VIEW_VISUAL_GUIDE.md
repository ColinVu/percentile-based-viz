# Final View - Visual Guide

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Final View                                                         │
├──────────────────────────┬──────────────────────────────────────────┤
│  METRICS PANE            │  BEESWARM/BOX PLOT PANE                 │
│                          │                                          │
│  ┌────────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ Metric 1      95%  │  │  │                                    │ │
│  │ Metric 2      87%  │  │  │      [Visualization Area]          │ │
│  │ Metric 3      76%  │  │  │                                    │ │
│  │ Metric 4      65%  │  │  │   - Beeswarm Chart (default)       │ │
│  │ Metric 5      54%  │  │  │   - OR Box Plot                    │ │
│  │ ...                │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │                    │  │  │                                    │ │
│  │  ┌──────────────┐  │  │  │  ┌──────────────┐                 │ │
│  │  │☐ Distributed │  │  │  │  │☐ Box Plot    │                 │ │
│  │  └──────────────┘  │  │  │  └──────────────┘                 │ │
│  └────────────────────┘  │  └────────────────────────────────────┘ │
└──────────────────────────┴──────────────────────────────────────────┘
    Checkbox 1 (Left)           Checkbox 2 (Right)
```

## Checkbox States Visualization

### Left Checkbox: "Distributed"

#### ☐ UNCHECKED (Even Spacing)
```
Metric A  95%  ← Top
Metric B  87%  ↓
Metric C  76%  ↓ Equal spacing
Metric D  65%  ↓ regardless of
Metric E  54%  ↓ percentile values
Metric F  43%  ↓
Metric G  32%  ← Bottom
```

#### ☑ CHECKED (Distributed)
```
Metric A  95%  ← Top (near 100%)
Metric B  87%  
Metric C  76%  ↓ Spacing reflects
            ↓ actual percentile
Metric D  65%  ↓ differences
Metric E  54%  
Metric F  43%  
            ↓
Metric G  32%  ← Bottom (near 0%)
```

### Right Checkbox: "Box Plot"

#### ☐ UNCHECKED (Beeswarm)
```
         Value Axis
            ↑
       100%─┤
            │    ●  ●
        90%─┤  ● ●● ●
            │ ●●●●●●●
        80%─┤●●●●●●●●●
            │ ●●●●●●
        70%─┤  ●●●●
            │   ●●
        60%─┤    ●
            └────────→
         Swarm spread
```

#### ☑ CHECKED (Box Plot)
```
         Value Axis
            ↑
       100%─┤  ┬  ← Max (whisker)
            │  │
        90%─┤  ┼  ← 75th percentile (Q3)
            │ ┌┴┐
        80%─┤ │ │
            │ ├─┤ ← Median (Q2)
        70%─┤ │ │
            │ └┬┘
        60%─┤  ┼  ← 25th percentile (Q1)
            │  │
        50%─┤  ┴  ← Min (whisker)
            └─────
           ● = Selected point
```

## Four Combination Examples

### 1. Even + Beeswarm (Default)
**Best for**: General exploration with consistent label spacing
```
Labels: Evenly spaced
Track:  Colored gradient
Right:  Colored beeswarm showing all points
```

### 2. Even + Box Plot
**Best for**: Statistical overview with easy metric scanning
```
Labels: Evenly spaced
Track:  Colored gradient
Right:  Box plot showing quartiles and outliers
```

### 3. Distributed + Beeswarm
**Best for**: Understanding how metric positioning relates to their values
```
Labels: Positioned by percentile
Track:  Solid gray
Right:  Colored beeswarm showing all points
```

### 4. Distributed + Box Plot
**Best for**: Comparing label positions with statistical distribution
```
Labels: Positioned by percentile (aligned with y-axis)
Track:  Solid gray
Right:  Box plot (visual alignment between left and right)
```

## Interactive Features

### Metrics Pane Interactions
- **Click label**: Select and display that metric
- **Drag handle**: Scroll through metrics
- **Click track**: Jump to nearest metric

### Beeswarm Mode Interactions
- **Hover point**: Show tooltip with details
- **Click point**: Change selected location and refresh view

### Box Plot Mode Interactions
- **Hover**: Show percentile line
- **Visual markers**: Yellow dot shows selected location's value

## State Persistence

Both checkboxes remember their state during your session:
- Switch between metrics → checkboxes stay in same position
- Switch to different view and back → checkboxes return to last state
- Refresh page → state resets to default (unchecked)

## Quick Tips

1. **Start with defaults** to get familiar with the data
2. **Try Distributed mode** to see if your metrics cluster at high/low percentiles
3. **Use Box Plot** to quickly identify outliers and quartile ranges
4. **Combine Distributed + Box Plot** to see how your selection compares to distribution
5. **Use Even + Beeswarm** for detailed individual point analysis


