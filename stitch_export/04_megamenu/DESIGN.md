---
name: Editorial Telecom Infrastructure
colors:
  surface: '#fafaf5'
  surface-dim: '#dadad6'
  surface-bright: '#fafaf5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4ef'
  surface-container: '#eeeee9'
  surface-container-high: '#e8e8e4'
  surface-container-highest: '#e2e3de'
  on-surface: '#1a1c19'
  on-surface-variant: '#3f4943'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f1f1ec'
  outline: '#6f7a73'
  outline-variant: '#bec9c1'
  surface-tint: '#186b4c'
  primary: '#00563a'
  on-primary: '#ffffff'
  primary-container: '#1e6f50'
  on-primary-container: '#a1efc8'
  inverse-primary: '#89d6b1'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#d8dffa'
  on-secondary-container: '#5a6279'
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
  secondary-fixed: '#dae2fc'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#3c070b'
  on-tertiary-fixed-variant: '#743233'
  background: '#fafaf5'
  on-background: '#1a1c19'
  surface-variant: '#e2e3de'
typography:
  display-lg:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 58px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Pretendard, Inter, sans-serif
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  data-mono:
    fontFamily: JetBrains Mono, monospace
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system serves a fixed-line telecommunications wholesale enterprise (유선통신 도매 브랜드). The visual personality conveys unyielding institutional stability, structural discipline, and editorial lucidity. The interface avoids ephemeral tech-startup tropes, prioritizing the gravitas of physical infrastructure (fiber-optic backbone lines, dedicated circuits, enterprise wholesale distribution) translated into digital space.

The design movement is **Editorial Minimalism meets Swiss Modernism**:
- **Warm Architectural Canvas**: A natural, archival paper-white background provides warmth and tactile substance over sterile digital whites.
- **Deep Ink & Forest Accents**: High-density ink text for pristine typographical authority paired with a measured, deep forest green accent representing grounded institutional vitality and network health.
- **Strict Planar Structure**: Completely flat. Pure reliance on hairline border rules (1px), generous typographic whitespace, structured column grids, and precise alignment. No skeuomorphism, no gradients, and zero drop shadows.
- **Line-Art Rigor**: Accents, status markers, and infrastructure diagrams rely on crisp geometric line work and stark tabular data layouts.

## Colors

The palette is deliberately restrained, designed to function like high-end trade literature or financial broadsheets.

- **Primary Accent (`#1E6F50`)**: Deep Forest Green. Used strictly for core interactive triggers, critical status confirmations, selected states, and pivotal network metrics. It commands deliberate visual focus without causing eye fatigue.
- **Secondary / Ink Body (`#10182B`)**: Deep Obsidian Ink. Used for primary headlines, data values, active table rows, and dominant structural labels. It replaces default pure black with a richer, deep blue-slate cast.
- **Muted Text (`#6B7280`)**: Neutral Slate. Reserved for secondary metadata, column headers, protocol specs, input placeholders, and inactive states. Maintains strict WCAG AA legibility against the canvas.
- **Border / Structural Rule (`#E5E5DF`)**: Warm Hairline Gray. Applied as a constant 1px structural separator across cards, table cells, headers, and container boundaries.
- **Canvas / Background (`#FFFFFA`)**: Archival Off-White. The singular base canvas color. Surfaces avoid elevated tints or simulated light sources; layers are distinguished purely through 1px border divisions.
- **Surface Hover (`#F4F4EE`)**: Subtle warmth step for interactive row selections, button hover states, and navigational segment tracks.

## Typography

The typographic stack is headlined by **Pretendard**, paired with **Inter** and monospace support for circuit IDs, IP subnets, and wholesale volume metrics.

### Typographic Rules:
1. **Word Break**: Mandatory global application of `word-break: keep-all;` and `overflow-wrap: break-word;` across all titles, descriptions, and notifications to ensure natural, unfragmented Korean phrase structures.
2. **Editorial Tabular Rhythm**: Numeric data points (bandwidth Mbps/Gbps, wholesale pricing, leased line capacities) employ tabular lining numbers (`font-variant-numeric: tabular-nums;`).
3. **Hierarchy**: High contrast between section headers and body data is maintained through stark weight shifts (`600` semi-bold vs `400` regular) rather than loud color variations.

## Layout & Spacing

The layout is built upon an architectural 12-column structural grid system that shifts smoothly across devices:

- **Desktop (1280px+)**: 12 columns, `margin: 3rem`, `gutter: 1.5rem`. Max container bound at 1440px with balanced breathing room.
- **Tablet (768px – 1279px)**: 8 columns, `margin: 2rem`, `gutter: 1.25rem`. Complex wholesale data tables gain horizontal scrolling with sticky left-identifier columns.
- **Mobile (Up to 767px)**: 4 columns, `margin: 1.25rem`, `gutter: 1rem`. Stacking is clean and linear; horizontal data metrics wrap to clean key-value rows.

### Spacing Philosophy:
Whitespace serves as a functional tool to define information hierarchy without relying on heavy box backgrounds or drop shadows. Gaps between related data points remain tight (`0.5rem` to `1rem`), while margins between separate functional sections are expansive (`2.5rem` to `4rem`), preserving the clarity of an editorial publication.

## Elevation & Depth

This design system adheres to a **Strict Zero-Shadow Rule**. Visual hierarchy is communicated entirely through 2D structural planes and 1px hairline boundaries:

1. **No Shadows & No Gradients**: `box-shadow: none` and flat solid color surfaces only. Depth is structural, not simulated.
2. **Hairline Delimitation**: All containers, modular cards, tables, headers, and modal dialogs are bound by a crisp `1px solid #E5E5DF` stroke.
3. **Layer Separation**:
   - **Base Canvas**: Solid `#FFFFFA`.
   - **Contained Zones (Cards, Drawers, Floating Panels)**: Solid `#FFFFFA` encapsulated by `#E5E5DF` borders.
   - **Active/Hover Fill**: Pure flat wash of `#F4F4EE` to provide tactile response on tables, row items, and list items.
   - **Modals / Overlays**: Centered or slide-in panels bordered by `#E5E5DF`, supported by a flat translucent veil: `rgba(16, 24, 43, 0.35)`.

## Shapes

The shape geometry is crisp, measured, and distinctly institutional:

- **Cards, Modals, Panels, and Containers**: Set uniformly to **8px** (`0.5rem`). This provides subtle softening without appearing informal or consumer-app-like.
- **Interactive Buttons & Inputs**: Set to **6px** (`0.375rem`). Crisp, technical, and precise. Pill buttons (`rounded-full`) are strictly forbidden.
- **Tags, Micro Badges & Chips**: **4px** (`0.25rem`) to maintain sharp technical distinction.
- **Lines & Accents**: 1px single-stroke geometric lines with square end caps for structural diagrams and node indicators.

## Components

### 1. Buttons
- **Primary Button**:
  - Background: `#1E6F50` (Forest Deep Green), text: `#FFFFFA`, border: `1px solid #1E6F50`.
  - Border radius: `6px`. Padding: `10px 18px` (medium), `8px 14px` (small).
  - Hover: Background `#16533C`. Active: Background `#114230`. No drop shadows.
- **Secondary / Outline Button**:
  - Background: `transparent`, text: `#10182B`, border: `1px solid #E5E5DF`.
  - Border radius: `6px`.
  - Hover: Background `#F4F4EE`, border color: `#10182B`.
- **Ghost Button**:
  - Background: `transparent`, text: `#6B7280`, border: `none`.
  - Hover: Text `#10182B`, background `#F4F4EE`.

### 2. Cards & Data Containers
- Canvas: Flat `#FFFFFA`, enclosed by `1px solid #E5E5DF`.
- Border radius: `8px`.
- Padding: `24px` for primary metric tiles, `16px` for compact circuit line summaries.
- Header divider: Internal cards employ a continuous `1px solid #E5E5DF` rule beneath section titles.

### 3. Data Tables (Wholesale Line Inventory & Contracts)
- Table Header: Text `#6B7280`, typography `label-md`, uppercase styling, border-bottom `1px solid #E5E5DF`, padding `12px 16px`.
- Table Row: Height `52px`, border-bottom `1px solid #E5E5DF`. Text `#10182B` in `body-md` / `data-mono`.
- Row Hover: Flat background fill `#F4F4EE`.
- Numeric Data: Strictly right-aligned with `JetBrains Mono` and tabular alignment.

### 4. Chips & Status Badges
- Structure: Minimal outline badges (`rounded: 4px`, padding: `3px 8px`, typography: `label-sm`).
- Normal / Operating State: Border `1px solid #1E6F50`, text `#1E6F50`, background `rgba(30, 111, 80, 0.05)`.
- Inactive / Maintenance State: Border `1px solid #E5E5DF`, text `#6B7280`, background `transparent`.
- Critical Alert: Border `1px solid #DC2626`, text `#DC2626`, background `rgba(220, 38, 38, 0.05)`.

### 5. Input Fields & Dropdowns
- Background: `#FFFFFA`, border: `1px solid #E5E5DF`, radius: `6px`.
- Text: `#10182B`, placeholder text: `#6B7280`. Height: `42px`, padding: `0 14px`.
- Focus State: Border color `#1E6F50`, outline: `1px solid #1E6F50` (sharp, no glowing blurs).
- Disabled State: Background `#F4F4EE`, text `#6B7280`, border-color `#E5E5DF`.

### 6. Selection Controls (Checkboxes & Radios)
- Checkbox: `18px × 18px`, `border: 1px solid #E5E5DF`, radius `4px`. Checked: background `#1E6F50`, border `#1E6F50`, icon check in `#FFFFFA`.
- Radio: `18px × 18px`, `border: 1px solid #E5E5DF`, radius `50%`. Selected: inner pip `8px` solid `#1E6F50` on `#FFFFFA` body.

### 7. Line-Art Infrastructure Accents
- Network topology graphs and wholesale line capacity indicators are rendered in strict monochrome hairline vectors (`stroke: #10182B` or `#1E6F50`, `stroke-width: 1px`).
- Nodes are depicted as hollow `6px` squares or circles bounded by `1px` lines, avoiding ornate icon fills.