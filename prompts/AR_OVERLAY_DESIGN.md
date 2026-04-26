# AR Text Detection Overlay Design Guidelines

## Overview
Two-step approach: AR overlay on frozen frame + magnifier modal for detailed reading.

---

## Step 1: AR Overlay on Frozen Frame

### Box Positioning
- **Size**: ORIGINAL SIZE (do NOT enlarge)
- **Position**: Exactly where Google Vision detects text
- **Alignment**: Precise pixel-perfect alignment with detected text regions

### Visual Style
- **Color Scheme**: Black text (#000000) on white background (#FFFFFF)
- **Contrast Ratio**: 21:1 (highest accessibility standard)
- **Font**: Clear, readable sans-serif (Arial, Helvetica, or system font)
- **Font Size**: Original detected text size (NOT enlarged)
- **Border**: Thin border around text region for visibility
- **Opacity**: Full opacity (no transparency)

### WCAG Compliance
- ✅ 21:1 contrast ratio (exceeds AA and AAA standards)
- ✅ Color-blind friendly (black/white works for all color blindness types)
- ✅ No reliance on color alone
- ✅ Clear visual distinction

---

## Step 2: Magnifier Modal (Click to Read)

### Trigger
- User clicks on any detected text box in AR overlay
- Modal opens showing full detected text

### Content Display
- **Font Size**: Default 24pt (readable on phone and desktop)
- **Color**: Black text (#000000) on white background (#FFFFFF)
- **Contrast**: 21:1 (WCAG AAA compliant)
- **Line Height**: 1.5x for readability
- **Max Width**: 80 characters per line (optimal reading)

### Zoom Controls
- **+/- Buttons**: Allow user to scale font size
- **Range**: 16pt (minimum) to 48pt (maximum)
- **Step**: 2pt increments
- **Current Size Display**: Show current font size (e.g., "24pt")

### Additional Features
- **Copy Button**: Copy detected text to clipboard
- **Close Button**: Close magnifier and return to AR overlay
- **Full Text Display**: Show entire detected text, not word-by-word

---

## Color Specifications

### Primary Colors
- **Text**: #000000 (pure black)
- **Background**: #FFFFFF (pure white)
- **Border**: #333333 (dark gray, optional for box outline)

### Accessibility Notes
- Black/white combination works for:
  - Protanopia (red-blind)
  - Deuteranopia (green-blind)
  - Tritanopia (blue-yellow blind)
  - Monochromacy (complete color blindness)

---

## Typography

### Font Selection
- **Family**: Sans-serif (Arial, Helvetica, Segoe UI, or system default)
- **Weight**: Regular (400) for body text
- **Style**: Normal (no italics unless original text is italic)

### Size Guidelines
- **AR Overlay**: Match original detected text size
- **Magnifier Default**: 24pt
- **Magnifier Min**: 16pt
- **Magnifier Max**: 48pt

### Line Spacing
- **AR Overlay**: Tight (1.0x)
- **Magnifier**: Loose (1.5x) for readability

---

## Implementation Notes

### DO NOT
- ❌ Enlarge text in AR overlay (causes misalignment)
- ❌ Use colors other than black/white for primary text
- ❌ Rely on color alone to distinguish elements
- ❌ Use small fonts in magnifier (minimum 16pt)
- ❌ Use decorative fonts that reduce readability

### DO
- ✅ Keep AR overlay boxes at original size
- ✅ Use 21:1 contrast ratio
- ✅ Provide zoom controls in magnifier
- ✅ Test with color-blind users
- ✅ Ensure keyboard navigation support

---

## Testing Checklist

- [ ] AR boxes align perfectly with detected text
- [ ] Box size matches original text size
- [ ] Black/white colors display correctly
- [ ] 21:1 contrast ratio verified
- [ ] Magnifier modal opens on click
- [ ] Zoom buttons work (16pt → 48pt)
- [ ] Full text displays in magnifier
- [ ] Copy button works
- [ ] Tested with color-blind simulator
- [ ] Tested on phone and desktop

---

## References

**WCAG 2.1 Standards:**
- Level AA: 4.5:1 contrast (normal text)
- Level AAA: 7:1 contrast (normal text)
- Our Implementation: 21:1 (exceeds all standards)

**Accessibility Best Practices:**
- Black on white: Most recommended for low vision
- White on black: Preferred by photophobia patients
- Our choice: Black on white (broader audience)
