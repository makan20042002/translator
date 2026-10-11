# Responsive Layout Failure Diagnosis (ITEM 1)

## 1. Failure 1: `tests/web/subtitle.spec.js:85`
### Symptom
At a 360px viewport width, the `#sDrop` bounding box right edge (`dropBox.x + dropBox.width`) is at `x = 534` (expected `<= 361`).

### Root Causes & Exact CSS Rules
1. **Unwrapping Topbar Flex Row** (`css/theme.css:670-682`):
   ```css
   .topbar {
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 14px;
     padding-block: 16px;
     padding-inline: 24px;
     border-bottom: 1px solid var(--border);
     background: var(--glass);
     backdrop-filter: blur(14px);
     position: sticky;
     top: 0;
     z-index: 30;
   }
   ```
   - In `css/theme.css:670`, `.topbar` is defined as a non-wrapping flex row (`display: flex; justify-content: space-between; gap: 14px;`).
   - `.topbar-lead` contains `#pageTitle` ("One translator, every engine.") with `font-size: 20px; font-weight: 700;` (~200px minimum text width).
   - `.topbar-ctrls` (`css/theme.css:752`) contains buttons `#offBtn` ("Offline mode"), `#uiLang` ("فارسی"), `#openSet` ("Engines & keys"), and `#topbarSettingsBtn`.
   - In `css/base.css:36`, `.btn` has `white-space: nowrap`. The buttons in `.topbar-ctrls` sum to ~320px inline width.
   - Combined minimum inline content width: `200px (lead) + 14px (gap) + 320px (ctrls) = 534px`.
   - The media query in `css/theme.css:880` applied only at `max-width: 768px` and allowed some wrapping, but its children lacked flexible shrinking and container query bounds.

2. **Flex Column Expansion on Main Viewport** (`css/theme.css:664`):
   ```css
   .main-viewport {
     flex: 1;
     min-width: 0;
     display: flex;
     flex-direction: column;
   }
   ```
   - `#mainViewport` is a column flex container containing `.topbar` and `main.wrap.main-panels-wrap`.
   - In flex layout, an unshrinkable cross-axis child (`.topbar` at 534px) pushes the column container to expand to match that child's minimum content width (534px).

3. **Wrap & Drop Element Full Width Stretch** (`css/base.css:23`, `css/layout.css:18,26`):
   - `main.wrap` (`.wrap{max-width:1240px;margin:0 auto;padding:0 24px}`) stretches across `#mainViewport`.
   - `.sub-card` has `width: 100%` and `#sDrop` has `width: 100%`.
   - Consequently, `#sDrop` expands to `534px` width, placing its right edge at `x = 534` instead of `<= 361`.

4. **Language Bar Child Sizing** (`css/base.css:67`):
   - `.bar .grp:first-child` (`<div class="grp"><select id="src"></select><button id="swap">⇄</button><select id="tgt"></select></div>`):
   - The two language dropdowns `#src` and `#tgt` default to their intrinsic option text width (`flex: 0 1 auto`), which combined with `#swap` (38px) and gaps exceeds 330px when unconstrained, contributing to horizontal overflow on 360px viewports.

---

## 2. Failure 2: `tests/web/theme-scroll.spec.js:64`
### Symptom
At 700px in English, the sidebar bounding box overlaps the main content bounding box (`overlaps === true`).

### Root Causes & Exact CSS Rules
1. **Drawer Fixed Positioning Overlay** (`css/theme.css:834-848`):
   ```css
   @media (max-width: 768px) {
     .sidebar {
       position: fixed;
       top: 0;
       bottom: 0;
       left: 0;
       width: 250px;
       min-width: 0;
       max-width: 80vw;
       z-index: 40;
       transform: translateX(-100%);
       transition: transform 0.25s var(--ease);
       pointer-events: none;
       box-shadow: none;
       padding-inline: 16px;
     }
   ```
   - `.sidebar` was turned into a `position: fixed` drawer rather than taking its own space in normal document flow.
   - When the test resizes the browser window from 1100px or 1280px down to 700px, `.sidebar` triggers `transition: transform 0.25s var(--ease)`.
   - `tests/web/theme-scroll.spec.js` waits 100ms (`waitForTimeout(100)`). At 100ms, the 250ms transition is only ~40% elapsed. The sidebar is still sliding offscreen and its bounding box right edge is still inside positive coordinates (`sidebarBox.x + sidebarBox.width > mainBox.x`), directly overlapping `#mainViewport` which starts at `x = 0`.
   - Furthermore, `position: fixed` inherently detaches the sidebar from normal flow, causing overlay collisions.

2. **Mismatch with Required Responsive Hierarchy**:
   - The required layout hierarchy is:
     - **> 1100px**: Full sidebar (250px) taking its column space (left in LTR, right in RTL).
     - **761px - 1100px**: Icon-only sidebar (72px) taking its own column space in normal flow, never overlapping main.
     - **<= 760px**: The sidebar becomes a horizontal icon strip at the top of the page in normal flow (`position: static`), full width, with main placed below it with no overlap.
