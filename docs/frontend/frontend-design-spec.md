# Frontend Design Specification: Mission Control — F1 Kinetic Command

**Date:** 2026-04-04
**Status:** Draft
**Spec Reference:** `docs/superpowers/specs/2026-04-04-mission-control-design.md`
**Plan Reference:** `docs/superpowers/plans/2026-04-04-mission-control-implementation.md`

---

## 1. User Journeys

### 1.1 First-Time Player

| Step | Screen | Player Action | System Response |
|------|--------|---------------|-----------------|
| 1 | Landing (`/`) | Sees "New Game" / "Continue" / "Load Game" | "Continue" disabled if no save. |
| 2 | New Game (`/new-game`) | Browses 11 team cards, selects one | Card expands: car radar preview, budget tier, driver pair. Scenarios filter by team. |
| 3 | New Game | Selects scenario (e.g., "The Rebuild") | Card expands with flavor text + starting conditions. "Begin Season" activates. |
| 4 | New Game | Clicks "Begin Season" | Auto-save created. Transition animation (lime wipe). Redirect to `/paddock`. |
| 5 | Paddock (`/paddock`) | First dashboard view | Widgets fade in staggered. Feed shows 2-3 welcome events: season intro, TD recommending first R&D, scenario-specific event. |
| 6 | Paddock | Clicks Factory recommendation | Navigates to `/factory`. First available upgrades pulse cyan. |
| 7 | Paddock | Clicks "Advance to Race Weekend" | Confirmation dialog with race card. Phase → practice. Redirect to `/strategy`. |
| 8 | Strategy (`/strategy`) | Practice phase | Program selector per driver. Race Engineer recommendation highlighted. |

**No onboarding modal.** Every first-time element is discoverable through Paddock Feed events and department head recommendations.

### 1.2 Race Weekend

| Phase | Primary Actions | Exit Condition |
|-------|----------------|----------------|
| Practice | Select programs, run session | Click "Advance to Qualifying" |
| Qualifying | Set tire compound per session | All sessions complete; "Advance to Race" |
| Race | Driver commands, strategy changes, sim speed | Race completes all laps |
| Post-Race | Review results, narrative consequences | "Return to Paddock" |

**Sprint variant:** Phase breadcrumb shows `FP1 > SQ > Sprint > Qualifying > Race`.

### 1.3 Strategic Decision (Paddock Event)

| Step | UI Behavior |
|------|-------------|
| Event generated | Slides into feed. "Breaking"/"decision" events trigger toast notification on any screen. |
| Player reads | Headline + severity icon visible in collapsed state. |
| Player clicks | **Simple events:** Options as inline buttons. **Complex:** Full-screen modal. |
| Player evaluates | Each option shows brief consequence hint (telegraphic, not exhaustive). |
| Player decides | Selected state animation. "Resolved" badge. Affected metrics flash on widgets. |
| Expiration | "EVENT EXPIRED" in gray. Default outcome applied. |

### 1.4 Season Management

| Activity | Screen | Flow |
|----------|--------|------|
| R&D | Factory | Browse tree → click node → see cost/time/delta → "Start Development". One active per branch. |
| Budget | Financial HQ | Spend-vs-cap bar. Category breakdown. Sponsor KPI progress. Amber pulse if under pressure. |
| Contracts | Driver Office | Click driver → profile → "Negotiate" → sliders (salary/term/bonus) → probability indicator → submit. |
| Regulations | Regulations | MVP: read-only timeline + technical directives feed. |

### 1.5 Multi-Season

| Step | Details |
|------|---------|
| Final race | Season summary overlay: standings, prize money, prestige change. |
| Season End | Contract expirations, driver market, regulation results. |
| Off-season | Guided sequence: renew/release, market signings, R&D carry-over, budget allocation. Checklist widget. |
| New Season | "Begin Season N+1" when all tasks addressed. Transition animation. |

---

## 2. Interaction Patterns

### 2.1 Progressive Disclosure (Three-Layer Model)

| Layer | Visible | Access |
|-------|---------|--------|
| **Glance** | Key metrics, status, alerts | Default view |
| **Detail** | Charts, breakdowns, secondary data | Click/tap widget or card |
| **Deep Dive** | Full tables, negotiation UI, comparison tools | Dedicated panels or modals |

### 2.2 Action Hierarchy Per Screen

| Screen | Primary | Secondary | Tertiary |
|--------|---------|-----------|----------|
| Paddock | Advance to Race Weekend | Resolve events, review flags | Navigate to other screens |
| Factory | Start R&D upgrade | Adjust aero allocation | Review component lifecycle |
| Drivers | Negotiate contract | Scout, compare | Review mood history |
| Strategy (Race) | Driver commands, PIT | Change speed, select strategy | Read commentary, forecasts |
| Finance | Review budget | Manage sponsors | Adjust marketing |
| Calendar | Preview next race | Review past results | — |
| Regulations | Read changes | — | — |

### 2.3 Notification System

| Tier | Trigger | Behavior | Dismissal |
|------|---------|----------|-----------|
| **Toast** | Breaking events, phase transitions, critical alerts | Top-right slide-in, 5s persist, max 3 stacked | Auto-dismiss, click to act, X |
| **Badge** | Unresolved events, department flags | Red dot on nav icon, count | Clears when viewed |
| **Inline** | Department recommendations, KPI warnings | Highlighted card/row (cyan info, amber warning) | Persists until addressed |

**During race:** Toasts suppressed. Critical events appear as highlighted commentary + screen-edge flash.

### 2.4 Strategy Room Information Hierarchy (Race)

1. Lap counter + safety car status (top bar)
2. Your drivers' positions + gaps (timing tower, highlighted)
3. Active driver commands (center, always visible)
4. Tire state + pit window (center)
5. Strategy options (center, expandable)
6. Commentary feed (right, auto-scroll)
7. Battle forecasts (right)
8. Full timing tower (left, scrollable)
9. Weather + PU stress (top bar, secondary)
10. Sim speed controls (right footer)

---

## 3. Component State Matrix

### Health Widget

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Shimmer placeholder | Initial load |
| Normal | Value + trend | Data within range |
| Warning | Amber glow, amber text | Warning threshold |
| Critical | Red glow, red text, pulse | Critical threshold |
| Updating | Number roll animation | Value change |

### Paddock Feed Item

| State | Visual | Trigger |
|-------|--------|---------|
| New | Full opacity, severity border, bold | Just generated |
| Read | 0.85 opacity, headline only | Scrolled past |
| Expanded | Full body + actions | Clicked |
| Resolved | "Resolved" badge, 0.6 opacity | Option selected |
| Expired | "Expired" badge, strikethrough | Past expiresAtRound |

### Tech Tree Node

| State | Visual | Trigger |
|-------|--------|---------|
| Locked | Dimmed, lock icon, dashed border | Prerequisites not met |
| Available | Full brightness, solid border | Prerequisites met |
| In Progress | Cyan glow, progress bar, ETA | Development started |
| Queued | Dotted cyan border | Queued after current |
| Complete | Lime border, check icon | Finished |

### Driver Command Button

| State | Visual | Trigger |
|-------|--------|---------|
| Default | Ghost style | No command active |
| Active | Solid fill + command color | Selected |
| Disabled | Dim, cursor-not-allowed | Pre-start or retired |
| Hover | Border brightens, scale(1.02) | Mouse enter |
| Focus-visible | Lime outline ring | Keyboard focus |
| Pressed | scale(0.97) | Click |

### Timing Tower Row

| State | Visual | Trigger |
|-------|--------|---------|
| Normal | Default text | Running normally |
| Player Team | Lime accent bar, brighter text | Your drivers |
| Position Gained | Green flash | Overtake |
| Position Lost | Red flash | Overtaken |
| Pitting | "PIT" badge, amber | In pit lane |
| Retired | Strikethrough, "RET" | DNF |

### Contract Negotiation

| State | Visual | Trigger |
|-------|--------|---------|
| View Mode | Read-only, "Negotiate" button | Default |
| Negotiation | Sliders, probability indicator | Click negotiate |
| Pending | Disabled, spinner | Offer submitted |
| Accepted | Lime flash, "Signed" badge | Driver accepts |
| Rejected | Red flash, reason text | Driver declines |
| Counter | Amber, counter values shown | Driver counters |

---

## 4. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop XL | 1440px+ | Full 3-column Strategy Room, side-by-side panels |
| Desktop | 1280-1439px | Compressed spacing, tech tree 2+1 |
| Tablet | 768-1279px | Stacked with collapsible sections |

Minimum supported: 768px. Mobile (< 768px) is Phase 3.

### Strategy Room Adaptation

**1440px+ (3-column):**
Left: Timing Tower (280px) | Center: Strategy + Commands (flex) | Right: Commentary + Forecast (320px)

**1280px (compressed 3-column):**
Timing Tower 240px, smaller fonts | Right 280px, forecast collapsed by default

**768px (tabbed):**
Full-width tabs: "Timing" | "Strategy" | "Live Feed"
Driver commands + sim speed pinned at bottom (fixed)
Top status bar persists

### Other Screens at 768px

| Screen | Adaptation |
|--------|-----------|
| Paddock | Widgets → horizontal scroll strip. Cards + feed stack. |
| Factory | Radar + tree stack vertically. Tree scrolls horizontally. |
| Drivers | Cards stack. Comparison uses toggle instead of side-by-side. |
| Finance | Budget bar full-width. Sponsors stack. |
| Calendar | Grid → vertical timeline. |
| Nav | Icons only, labels hidden, tooltips on long-press. |

---

## 5. Animation Specifications

All respect `prefers-reduced-motion`. [RM] = disabled when reduced motion active.

### Page Transitions

| Animation | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Page enter | opacity, translateY(8→0) | 200ms | ease-out |
| Page exit | opacity | 150ms | ease-in |
| Season transition | opacity (full-screen overlay) | 600ms | ease-in-out |
| Phase transition | opacity, scale(0.98→1) | 250ms | ease-out |

### Data Updates [RM]

| Animation | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Number roll | translateY, opacity on digits | 300ms | ease-out |
| Progress fill | scaleX | 400ms | ease-out |
| Radar morph | SVG path interpolation | 500ms | ease-in-out |
| Position flash | background opacity | 400ms | linear |

### User Interactions

| Animation | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Button press | scale(0.97) | 100ms | ease-out |
| Button hover | border-color, box-shadow | 150ms | ease-out |
| Card expand | height (Framer Motion layout) | 200ms | ease-out |
| Modal open | opacity, scale(0.95→1) | 200ms | ease-out |
| Modal close | opacity, scale(1→0.97) | 150ms | ease-in |
| Toast in | translateX(100%→0) | 250ms | ease-out |
| Toast out | translateX(0→100%), opacity | 200ms | ease-in |

### Race Simulation [RM]

| Animation | Property | Duration | Easing |
|-----------|----------|----------|--------|
| Commentary slide-in | translateY(20→0), opacity | 200ms | ease-out |
| Gap update | translateY digit swap | 200ms | ease-out |
| Tire wear | scaleX on wear bar | 300ms | linear |
| Safety car banner | translateY(-100%→0) | 300ms | ease-out |
| Weather change | opacity crossfade | 400ms | ease-in-out |
| Widget pulse | box-shadow pulse | 600ms | ease-in-out |

---

## 6. Accessibility Specifications

### 6.1 Keyboard Navigation

**Global:** Tab through interactive elements. Enter/Space activates. Escape closes modals. Skip-to-content link on every page.

**Strategy Room:** Driver commands = radio group (Arrow Left/Right). Sim speed = radio group. Tab between command groups → speed → strategy options. Timing tower: Arrow Up/Down navigates rows.

**Paddock Feed:** Arrow Up/Down between items. Enter expands. Tab to action buttons. Escape collapses.

**Contract Negotiation:** Tab between sliders (range inputs, Arrow Left/Right adjusts). Tab to Submit.

### 6.2 ARIA Roles

| Component | ARIA |
|-----------|------|
| Nav bar | `role="navigation"`, `aria-current="page"` on active |
| Health widgets | `role="status"` |
| Paddock Feed | `role="feed"`, items `role="article"`, `aria-live="polite"` |
| Tech tree | `role="tree"`, `aria-expanded`, `aria-disabled` on locked |
| Timing tower | `role="table"`, player rows prefixed "Your driver" |
| Driver commands | `role="radiogroup"`, `aria-checked` |
| Commentary | `role="log"`, `aria-live="polite"`, critical entries `aria-live="assertive"` |
| Status bar | `role="status"`, SC/weather changes `aria-live="assertive"` |
| Toasts | `role="alert"` |
| Modals | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Radar charts | `role="img"`, aria-label with all 6 values |
| Progress bars | `role="progressbar"`, valuenow/min/max |

### 6.3 Focus Management

| Transition | Focus Behavior |
|------------|---------------|
| Page nav | Focus to `h1` after route transition |
| Modal open | Focus to first focusable inside. Trap focus. |
| Modal close | Return focus to trigger element |
| Feed item expand | Focus to first action button |
| Phase transition | Focus to Strategy Room heading + SR announcement |
| Toast | No focus move. Announced via `role="alert"`. |

### 6.4 Color-Blind Safety

| Element | Secondary Indicator |
|---------|-------------------|
| Feed severity | Icon shapes (circle/triangle/diamond/square/star) + text labels |
| Sector times | "PB" / "OB" suffix |
| Tire compounds | Label always visible (S/M/H) |
| Budget status | Text: "Healthy" / "Warning" / "Critical" |
| Driver mood | Numeric value always shown |

### 6.5 High Contrast Mode

- `--bg-surface`: 0.03 → 0.08 opacity
- `--border-default`: 0.06 → 0.20 opacity
- Accent colors +15% saturation
- Glassmorphism disabled; solid `--bg-secondary` backgrounds
- Border width: 1px → 2px
- Text targets WCAG AAA (7:1) for body
