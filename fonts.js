/**
 * fonts.js — Runtime font token adapter
 *
 * Reads all font custom properties from fonts.css and exposes them
 * as a global FONTS object for use in D3 .attr() / .style() calls
 * and programmatic inline-style assignments.
 *
 * To change any font setting, edit fonts.css — not this file.
 */
const FONTS = (() => {
  const style = getComputedStyle(document.documentElement);
  const str = (v) => style.getPropertyValue(v).trim();
  const num = (v) => parseInt(str(v), 10);

  return {
    /** font-family values */
    family: {
      base: str('--font-family-base'),   // Arial, sans-serif
      code: str('--font-family-code'),   // 'Courier New', monospace
      mono: str('--font-family-mono'),   // monospace
    },

    /**
     * font-size values as integers (px).
     * For D3 .attr('font-size', FONTS.size.xs)         → SVG attribute
     * For D3 .style('font-size', FONTS.size.xs + 'px') → CSS style
     */
    size: {
      tiny:    num('--font-size-tiny'),    // 8  — tiny chart labels
      xs:      num('--font-size-xs'),      // 10 — axis text, small labels
      sm:      num('--font-size-sm'),      // 11 — small text
      md:      num('--font-size-md'),      // 12 — body text, chart title (sm)
      body:    num('--font-size-body'),    // 13 — medium body
      base:    num('--font-size-base'),    // 14 — base text, chart titles
      medium:  num('--font-size-medium'),  // 15 — panel headers
      lg:      num('--font-size-lg'),      // 16 — section headers
      xl:      num('--font-size-xl'),      // 18 — xl text
      '2xl':   num('--font-size-2xl'),     // 20
      '3xl':   num('--font-size-3xl'),     // 24
      '4xl':   num('--font-size-4xl'),     // 30
      '5xl':   num('--font-size-5xl'),     // 36
      display: num('--font-size-display'), // 50
    },

    /** font-weight values */
    weight: {
      normal:   str('--font-weight-normal'),    // normal
      medium:   str('--font-weight-medium'),    // 500
      semibold: str('--font-weight-semibold'),  // 600
      bold:     str('--font-weight-bold'),      // bold
    },

    /** static text colors (mirrors fonts.css --color-text-* tokens) */
    color: {
      white:        str('--color-text-white'),
      faint:        str('--color-text-faint'),
      note:         str('--color-text-note'),
      subtle:       str('--color-text-subtle'),
      lighter:      str('--color-text-lighter'),
      muted:        str('--color-text-muted'),
      medium:       str('--color-text-medium'),
      instructions: str('--color-text-instructions'),
      body:         str('--color-text-body'),
      subheading:   str('--color-text-subheading'),
      dark:         str('--color-text-dark'),
      heading:      str('--color-text-heading'),
      black:        str('--color-text-black'),
      primary:      str('--color-text-primary'),
      blueHover:    str('--color-text-blue-hover'),
      accentBlue:   str('--color-text-accent-blue'),
      chipBlue:     str('--color-text-chip-blue'),
      indigo:       str('--color-text-indigo'),
      error:        str('--color-text-error'),
      warning:      str('--color-text-warning'),
      red:          str('--color-text-red'),
      darkRed:      str('--color-text-dark-red'),
      outlierLow:   str('--color-text-outlier-low'),
      outlierHigh:  str('--color-text-outlier-high'),
    },
  };
})();
