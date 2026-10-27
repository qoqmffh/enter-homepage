---
name: ENTER 도매홈페이지
description: 주장이 아니라 날짜·건수·금액으로 증명하는 B2B 도매유통 에디토리얼 사이트
colors:
  ink: "#111315"
  paper: "#ffffff"
  white: "#fff"
  muted: "#6b6b6b"
  line: "#e3e3e0"
  charcoal: "#3c3c3c"
  yellow: "#f4d548"
  blue: "#2f4cff"
  green: "#1a8f3c"
  gold: "#8a5a1f"
typography:
  display:
    fontFamily: "'ONE Mobile', -apple-system, sans-serif"
    fontSize: "clamp(34px, 6.8vw, 74px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "normal"
  headline:
    fontFamily: "'ONE Mobile', sans-serif"
    fontSize: "clamp(24px, 4.6vw, 38px)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.01em"
  title:
    fontFamily: "'ONE Mobile', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'ONE Mobile', -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'ONE Mobile', sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: ".04em to .1em"
    textCase: "uppercase"
rounded:
  pill: "999px"
  container: "10px"
spacing:
  section-mobile: "40px"
  section-desktop: "56px"
  wrap-max: "1040px"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "13px 24px"
  cta-split:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
  nav-link-active:
    textColor: "{colors.ink}"
---

# Design System: ENTER 도매홈페이지

## Overview

**Creative North Star: "The Editorial Ledger"**

This is a white-paper, grid-ruled editorial surface, not a SaaS landing page. A thin vertical rail (an itsua.com-derived pattern, a repeating 259/260px line gradient painted as the `.wrap` background) runs behind every section on every page, giving the whole site the feel of a ledger page rather than a stack of floating cards. Numbers are the hero: a 4-column stat bar, a numbered reasons list, and an auto-scrolling settlement ticker all carry more visual weight than decorative imagery, because the product's whole pitch is "proof over claims."

The system is flat by design — there is no `box-shadow` anywhere in the stylesheet. Depth and grouping come entirely from hairline 1px dividers (`var(--line)`) and from a disciplined 4-role accent cycle (ink → blue → green → gold) applied to enumerated data, never decoratively. A single warm yellow is reserved exclusively for the primary call-to-action, so it reads as "the one button that matters" rather than a general accent.

Confirmed visual rejection: the card-grid B2B cliché. Several component classes (`.cards`/`.card`, `.doclist`, `.bloglist`, pill-chip `.trustbar`) still exist in `common.css` and are used by the 22 pages this round did not touch — the home page and header/footer chrome deliberately replace that pattern with bordered editorial rows (`.reason-list`, `.blog-row-list`, `.inline-divided`) instead of boxed cards.

**Key Characteristics:**
- Flat, white, grid-ruled — no shadows, no floating cards on the redesigned surfaces.
- One accent color per role, used consistently: ink/blue/green/gold cycle for enumerated data; yellow reserved for action.
- Numbered wayfinding (`01 / 10` … `10 / 10`) turns the long single-page scroll into a legible sequence.
- Pill shape is reserved for interactive/actionable elements (buttons, nav-bar links); everything else is square-cornered or unrounded.

## Colors

A near-monochrome ink-on-white base carries the page; four accent hues are assigned to fixed semantic roles rather than used freely.

### Primary
- **Ink** (`#111315`): primary text, headline color, default numbered-index color (item 1 of the reason cycle), active nav underline.
- **Signal Yellow** (`#f4d548`): the single action color. Used only for `.btn-primary`, the hero CTA's label half, and the fixed footer bar's hover state. Never used decoratively.

### Secondary
- **Charcoal** (`#3c3c3c`): the CTA icon chip (dark half of the two-tone hero button) and the fixed bottom contact bar's background — a secondary dark neutral distinct from Ink, used for UI "furniture" rather than text.

### Tertiary (the data-accent cycle)
- **Blue** (`#2f4cff`): 2nd item in the reason/stat accent cycle; also the fixed color for blog tags, the "more" link, and the FAQ "Q." marker.
- **Green** (`#1a8f3c`): 3rd item in the reason/stat accent cycle.
- **Gold/Bronze** (`#8a5a1f`): 4th item in the reason/stat accent cycle; also the FAQ "A." marker.

### Neutral
- **Paper** (`#ffffff` / `--paper`, duplicated as `--white`): page background, header background, card-free surface background. Note: `--paper` and `--white` are both `#fff` — an incumbent duplicate pair in `common.css`; treat `--paper` as the canonical name for backgrounds.
- **Muted Grey** (`#6b6b6b`): all secondary/supporting text — eyebrows, subcopy, section-head index/label, stat labels, ticker dates, FAQ answers.
- **Hairline** (`#e3e3e0`): every divider, the grid-rail lines, and all border strokes. This is the system's only border color.

### Named Rules
**The Four-Role Cycle Rule.** Any enumerated or tabular data (reason list items, stat-bar figures) cycles ink → blue → green → gold in that fixed order. The cycle is a role assignment, not a decorative palette — don't reorder it or add a 5th color to it.

**The One Yellow Rule.** Yellow appears only on components that trigger an action (primary buttons, the hero CTA, footer-bar hover). It is never used as a label, tag, or decorative fill.

## Typography

**Display/Body Font:** ONE Mobile (Light 300 / Regular 400 / Bold 700), with `-apple-system, sans-serif` fallback.

**Character:** A single Korean sans family carries every weight in the system — display, body, and uppercase labels are all ONE Mobile, differentiated only by size, weight, and letter-spacing. (Note: `ChosunCentennial` is loaded via `@font-face` in `common.css` per the brand font commitment in PRODUCT.md, but it is not applied to any selector in the shipped home page or chrome — it is not yet a live token of this system.)

### Hierarchy
- **Display** (700, `clamp(34px, 6.8vw, 74px)`, line-height 1.12): the home hero `<h1>` only.
- **Headline** (700, `clamp(24px, 4.6vw, 38px)`, line-height 1.25, `.h2-xl`): the lead `<h2>` of every numbered home section.
- **Title** (700, 20px, line-height 1.2): generic `<h2>` outside the hero/section-lead pattern.
- **Body** (400, 15–15.5px, line-height 1.6): paragraph copy, hero subcopy (max-width 440px on the sub line).
- **Label** (700, 11–11.5px, uppercase, letter-spacing .04–.1em, color Muted): eyebrows, section-head index/label pair, nav links, stat-bar labels, ticker column heads.

### Named Rules
**The Eyebrow-Is-Native Rule.** Small uppercase eyebrows (hero `.eyebrow-v2`, generic `.eyebrow`) are a structural part of this editorial world — they come from the itsua.com reference and the brief-pinned Desktop-Home mockup, not an invented kicker. Keep them label-weight (11–11.5px, Muted, uppercase) and don't promote them to a decorative/colored treatment.

## Layout

Mobile-first, single container: `.wrap` at `max-width: 1040px`, `padding: 0 16px` (mobile) / `0 24px` (≥768px). Every `.wrap` paints its own repeating vertical line gradient (one line every 259/260px) as a background-image — this is the grid rail, and it is why the rail appears automatically on every page without a stacking/z-index fight.

Sections are full-bleed horizontal bands: `padding: 40px 0` (mobile) / `56px 0` (≥768px), separated by a single 1px hairline bottom border (`var(--line)`); the last section in `<main>` has no bottom border. Each home section opens with `.section-head`: a numbered index (`01 / 10` … `10 / 10`) on the left and an uppercase label on the right, both Label-scale, with its own hairline rule below. This numbering is specific to the home page's 10-section sequence.

Responsive change at 768px is additive, not restructural: the stat bar goes 2-col → 4-col, `.lead-row` goes stacked → flex row (content max-width 640px), and the fixed header switches from a column stack to a row with space-between.

## Elevation & Depth

Flat. There is no `box-shadow` declaration anywhere in `common.css`. Depth and grouping are conveyed entirely by hairline 1px borders (`var(--line)`) and by whitespace/section padding — never by shadow, blur, or lift. The only "lift" affordance in the whole system is the sticky header (`position: sticky`) and the fixed footer bar (`position: fixed`), both of which use a z-index and a plain hairline/border-top for separation, not a shadow.

### Named Rules
**The Flat-By-Default Rule.** Surfaces never cast a shadow, on hover or otherwise. If a component needs to signal separation, use a 1px `var(--line)` border, not elevation.

## Shapes

Two shape vocabularies coexist by role. Interactive/actionable elements are fully pill-shaped (`border-radius: 999px`): `.btn-primary`, the two-tone hero CTA, the fixed footer-bar links. Everything else on the home page and chrome is square-cornered — sections, the stat bar, the reason list, the ticker rows, the blog row list carry no border-radius at all; the one exception is the ticker's outer frame (`.ticker-wrap`, 10px radius) which softens an otherwise dense scrolling data box. Borders are uniformly 1px hairline (`var(--line)`); there are no heavy (≥2px) borders or hard-offset/neobrutalist shadows anywhere in this world.

## Components

### Buttons
- **Shape:** full pill (`border-radius: 999px`).
- **Primary:** `.btn-primary` — Signal Yellow fill, Ink text, `padding: 13px 24px`, 700 weight, 14px.
- **Hero CTA (signature two-tone):** `.hero-v2-cta` splits the same pill into a Charcoal icon square (44px, white arrow SVG) and a Yellow label half — the pill is one continuous shape, not two adjacent buttons.
- **Ghost/secondary:** not present in the shipped home/chrome scope; `.more-link` (Blue text, 700, 14px, no container) serves as the de-facto tertiary action for "see more" links throughout.

### Navigation
- Sticky top header (`header.site`, white, 1px hairline bottom border, `z-index: 10`).
- Nav links are Label-scale (11px, 700, uppercase, Muted), horizontally scrollable on mobile with hidden scrollbar, becoming a plain row at ≥768px.
- Active state: Ink text + a 2px Ink underline inset 10px from each edge (`::after`). Hover: Muted → Ink, no underline.
- The fixed bottom contact bar (`.footerbar`) is chrome, not page nav: Charcoal background, white pill links with inline SVG icons (phone/SMS/KakaoTalk), Yellow fill on hover.

### Cards / Containers (home-scope data containers)
- **Reason list** (`.reason-list`/`.reason-row`): replaces a card grid with a numbered row list — large bold index number (22–52px) colored by the 4-role cycle, title + supporting copy beside it, 1px hairline between rows. This is the system's signature replacement for the generic "benefit card."
- **Stat bar** (`.stat-bar-v2`): a bordered grid (2-col mobile / 4-col desktop) of label + large number; the number's color is driven by content data through the same 4-role cycle (`var(--ink/--blue/--green/--gold)`), confirmed in `content/pages.json`.
- **Ticker** (`.ticker-wrap`/`.ticker-list`): a 240px-tall masked, auto-scrolling marquee of settlement rows (date/count/amount), 40s linear loop, pauses on hover, respects `prefers-reduced-motion`. White background, 1px hairline frame, 10px radius.
- **Inline-divided list** (`.inline-divided`): a flat, border-right-separated inline list used for product/badge summaries — the chip-free alternative to a pill-tag row.
- **Blog row list** (`.blog-row-list`): title + uppercase Blue tag per row, hairline-separated, no card background.

### Inputs / Fields
Not present in the shipped home/chrome scope — no form inputs appear on the home page.

## Do's and Don'ts

### Do:
- **Do** use a 1px `var(--line)` hairline rule for any new separation; that is the system's only grouping device.
- **Do** keep the 4-role accent cycle (ink → blue → green → gold) in that exact order whenever coloring enumerated/data items; don't recolor an item out of sequence.
- **Do** reserve full-pill shape (999px) for things a user can click or tap; leave data containers and sections square-cornered.
- **Do** keep eyebrows and section-head labels at Label scale (uppercase, 11–11.5px, Muted) — they are a native part of this editorial world, confirmed by the brief's own Desktop-Home mockup.

### Don't:
- **Don't** add `box-shadow` or a lift/hover-elevation effect anywhere; this system is flat by design (confirmed: zero `box-shadow` declarations in `common.css`).
- **Don't** reintroduce the boxed `.cards`/`.card` grid pattern on new redesigned surfaces — the home page explicitly replaced it with bordered rows (reason list, blog row list) per the build's own CSS comments ("카드 그리드 대신", "카드 대신 에디토리얼 로우").
- **Don't** use yellow for anything other than a primary action trigger — not labels, not tags, not decoration.
- **Don't** assume the rest of the site matches this system yet. Only `templates/home.html`, `templates/base.html` (header/footer chrome), and the corresponding rules in `static/common.css` have shipped this visual world. The other 22 pages — `why.html`, `start.html`, `settlement.html`, `products.html`, `startup.html`, `faq.html`, `blog.html` + 8 posts, `stories.html`, `about.html`, the guide hub + 5 chapters — still render the pre-redesign classes (`.cards`/`.card`, `.doclist`, pill-chip `.trustbar`, bordered-list `.bloglist`, emoji glyph icons in `.doc-icon`/`.icon-step-icon`). Extending this system to them is the next phase, not a completed fact.
