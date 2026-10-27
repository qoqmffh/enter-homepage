---
name: Architectural Wholesale Specifier
colors:
  surface: '#FFFFFA'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e1e7ff'
  surface-container-highest: '#dae2fc'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4943'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6f7a73'
  outline-variant: '#bec9c1'
  surface-tint: '#186b4c'
  primary: '#00563a'
  on-primary: '#ffffff'
  primary-container: '#1e6f50'
  on-primary-container: '#a1efc8'
  inverse-primary: '#89d6b1'
  secondary: '#7e570a'
  on-secondary: '#ffffff'
  secondary-container: '#ffc975'
  on-secondary-container: '#795204'
  tertiary: '#793536'
  on-tertiary: '#ffffff'
  tertiary-container: '#964c4c'
  on-tertiary-container: '#ffd4d3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a5f3cc'
  primary-fixed-dim: '#89d6b1'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#ffddaf'
  secondary-fixed-dim: '#f3be6b'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#614000'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#3c070b'
  on-tertiary-fixed-variant: '#743233'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fc'
  text-ink: '#10182B'
  text-secondary: '#6B7280'
  border-hairline: '#E5E5DF'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 96px
    fontWeight: '700'
    lineHeight: 96px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 76px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Noto Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Noto Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-code:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-index:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.06em
spacing:
  gutter: 0px
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an editorial technical catalog for institutional and B2B wholesale procurement. Drawing inspiration from Swiss structural typography, architectural blueprints, and industrial trade spec sheets, the aesthetic is austere, deliberate, and radically utilitarian. It deliberately rejects decorative trends such as gradients, soft shadows, rounded floating pills, and emotive lifestyle photography.

The visual presence relies on stark, giant-scale headlines set against expansive warm-white canvas areas, framed by 1px hairline construction grids. Monospaced index tags and metadata paths establish absolute clarity, conveying reliability, inventory discipline, and structural permanence for enterprise operations.

## Colors

The palette is strictly calibrated for high legibility, contrast, and catalog authority without chromatic clutter:

- **Canvas & Surface (`#FFFFFA`)**: A subtle, warm-white background evoking unbleached technical paper and archival cardstock.
- **Ink Primary (`#10182B`)**: Deep industrial midnight ink used for primary body copy, primary headers, and high-priority glyphs.
- **Secondary Ink (`#6B7280`)**: Neutral slate used for metadata, tabular keys, secondary text, and column headers.
- **Hairline Grid & Separator (`#E5E5DF`)**: Strict 1px boundary lines defining structure, borders, and column guidelines.
- **Accent Green (`#1E6F50`)**: Deep pine green indicating active states, live inventory confirmations, and authenticated specs.
- **Action Amber (`#B98A3D`)**: Muted architectural amber reserved exclusively for actionable triggers, primary transactional CTA buttons, and status alerts.

Avoid fills, blurs, or gradients. Colors are applied strictly as flat ink washes, border strokes, or typographic fills.

## Typography

The typographic hierarchy is divided into three functional pillars:

1. **Display & Headings (Space Grotesk)**: Structural, geometric, and aggressive. Applied at 72px–96px on desktop with tight letter spacing (`-0.03em`) to anchor sections with commanding authority.
2. **Body & Prose (Noto Sans / Pretendard alternative)**: Balanced, neutral, and readable for enterprise dense tables, long-form contracts, SKU notes, and logistical data.
3. **Index & Metadata (Space Mono)**: Monospaced uppercase tags used for slug paths (`/REF:0948-B`), inventory matrices, SKU specifications, batch counts, and index markers (`[SEC_01]`).

All monospaced labels must be rendered in uppercase with positive letter spacing (`0.06em` to `0.08em`) to guarantee legibility against hairline borders.

## Layout & Spacing

The structural layout relies on an architectural 4-column system defined by visible 1px vertical borders (`#E5E5DF`) that extend across the canvas:

- **Desktop (1024px+)**: 4 equal structural columns separated by thin vertical guidelines. Outer section margins are set to `3rem` (`48px`). Content modules dock edge-to-edge against grid intersections.
- **Tablet (768px - 1023px)**: 2 equal structural columns with `2rem` outer margins.
- **Mobile (< 768px)**: 1 unified structural column with `1rem` outer canvas padding.

Spacers maintain hard-edge mathematical steps (`4px`, `8px`, `16px`, `24px`, `40px`). Component containers do not use floating bubble margins; instead, they lock flush against row borders or column partitions to preserve the feeling of a print-ready technical document.

## Elevation & Depth

This design system is completely devoid of elevation via drop shadows, blurred overlays, or dimensional skeuomorphism. Depth is communicated strictly through planar boundaries and hairline stroke divisions:

- **Surface Tiers**: Base canvas `#FFFFFA`. Secondary modular panes use the same background or alternating structural panels enclosed by 1px solid `#E5E5DF`.
- **Dividers**: Every container, header strip, and tabular row terminates with an explicit 1px hairline rule.
- **Modals & Flyouts**: Render with flat canvas fills, framed in an absolute 1px `#10182B` or `#E5E5DF` stroke without any ambient diffusion. Focus states invert contrast rather than projecting elevation.

## Shapes

The shape system enforces pure rectangular geometry. Elements have a default corner radius of `0px`, with an absolute maximum radius of `2px` for interactive inputs and badges if border containment requires pixel stabilization.

Rounded pills, floating bubbles, and organic circular shapes are strictly prohibited. Corners are sharp, echoing drafting tables and sheet-metal cuts.

## Components

### Buttons
- **Primary CTA**: Background `#B98A3D`, text `#FFFFFA`, border `1px solid #B98A3D`, sharp corners (`0px` or `2px` max). Font `Space Mono` uppercase, tracking `0.06em`. On hover, color shifts to dark amber `#9E7430`.
- **Secondary / Spec Action**: Background transparent, text `#10182B`, border `1px solid #10182B`. On hover, inverts to background `#10182B` and text `#FFFFFA`.
- **Ghost Utility**: Background transparent, border none, text `#6B7280` with hover transition to `#10182B` accompanied by a leading monospaced caret (`->`).

### Input Fields & Selectors
- Background `#FFFFFA`, border `1px solid #E5E5DF`, border radius `0px`.
- Typography: `Noto Sans` 14px for user input; field label set in `Space Mono` 11px uppercase in `#6B7280`.
- Active focus state: Hairline border transitions directly to 1px `#10182B` without outline glows.

### Checkboxes & Radio Controls
- Checkbox: Sharp square (`14px` by `14px`), border `1px solid #10182B`, `0px` radius. Active state contains a solid `#10182B` square inset.
- Radio: Strict square outline containing an inner centered square (avoid circular styling to sustain industrial drafting tone).

### Cards & Grid Containers
- Structural panels defined by `1px solid #E5E5DF`. Zero outer shadows.
- Header bands contain monospaced index identifiers (e.g., `// 01.04 SPEC_DOC`) locked to top borders.
- Padding inside cards adheres to strict multiples of `16px` (`space-md`) or `24px` (`space-lg`).

### Data Tables & Spec Lists
- Zebra striping is omitted in favor of horizontal 1px hairline borders (`#E5E5DF`).
- Numeric values and identifiers are set in `Space Mono` aligned flush-right. Descriptions and labels are set in `Noto Sans` aligned flush-left.
- Status badges: Compact rectangular tags with `1px` border (e.g., Green `#1E6F50` border and text for "VERIFIED_STOCK", Amber `#B98A3D` for "ALLOCATED").