# Color & Theme Architecture Audit

This audit document catalogs how colors, themes, palettes, and styling are implemented across MAKAN Translate (the web app and Windows desktop application).

---

## 1. Existing CSS Variables

The application loads its stylesheets in `index.html` in the following order:
1. `css/base.css` (initial definitions)
2. `css/layout.css`
3. `css/components.css`
4. `css/tabs.css`
5. `css/theme.css` (overriding design foundation tokens on `:root, [data-theme="dark"]` and `[data-theme="light"]`)

Because `css/theme.css` is loaded last, its values on `:root` define the current active look of the application.

### Active Design Tokens (`css/theme.css` Lines 13–90)

| CSS Variable | Current Value | Role / Purpose |
|---|---|---|
| `--bg` | `#040914` | Outer window background (dark navy) |
| `--bg-navy` | `#040914` | Window background alias |
| `--bg2` | `#071022` | Primary panel / header background |
| `--bg-sidebar` | `#050b18` | Sidebar navigation background |
| `--surface` | `#0a1528` | Cards, rows, inputs, popup background |
| `--surface2` | `#0e1e38` | Secondary raised surface / tracks |
| `--surface-card` | `#091428` | Grouped content card background |
| `--surface-card-hover` | `#0d1e3a` | Hover state for surface cards |
| `--surface-active` | `#102448` | Selected or active row / item |
| `--glass` | `rgba(5, 11, 24, 0.78)` | Translucent floating headers & panels |
| `--border` | `rgba(255, 255, 255, 0.08)` | Standard card/panel divider border |
| `--border2` | `rgba(28, 64, 118, 0.45)` | High-emphasis border / control boundary |
| `--border-subtle` | `rgba(255, 255, 255, 0.05)` | Faint divider border |
| `--border-focus` | `#08A8FF` | Focus ring / active stroke |
| `--border-glow` | `rgba(8, 168, 255, 0.4)` | Focus glow ring |
| `--mint` | `#79F8C8` | Brand mint accent |
| `--cyan` | `#08E7E5` | Brand cyan accent |
| `--electric-blue` | `#08A8FF` | Brand electric blue accent |
| `--royal-blue` | `#2869F5` | Brand deep blue accent |
| `--grad` | `linear-gradient(135deg, #79F8C8 0%, #08E7E5 46%, #08A8FF 72%, #2869F5 100%)` | MAKAN brand multi-stop gradient |
| `--grad-mint-blue` | `linear-gradient(135deg, #79F8C8 0%, #08E7E5 46%, #08A8FF 72%, #2869F5 100%)` | Brand gradient alias |
| `--grad-blue` | `linear-gradient(135deg, #1366E2 0%, #2563EB 100%)` | Action button gradient |
| `--grad-surface` | `linear-gradient(180deg, rgba(14, 30, 56, 0.5) 0%, rgba(9, 20, 40, 0.8) 100%)` | Subtle surface highlight |
| `--pri` | `#1366E2` | Primary brand button background |
| `--pri-hover` | `#1D75F8` | Primary button hover |
| `--pri-active` | `#0F52B8` | Primary button pressed/active |
| `--accent` | `#08A8FF` | Key interactive accent / focus |
| `--accent-dim` | `rgba(8, 168, 255, 0.12)` | Low-opacity accent highlight |
| `--accent-line` | `rgba(8, 168, 255, 0.32)` | Outlined accent border |
| `--cta` | `#1366E2` | Call-to-action button color |
| `--cta-ink` | `#FFFFFF` | Text color on primary call-to-action |
| `--ok` | `#10B981` | Success state color |
| `--ok-dim` | `rgba(16, 185, 129, 0.15)` | Low-emphasis success surface |
| `--green` | `#10B981` | Success green alias |
| `--warn` | `#F59E0B` | Warning / attention color |
| `--warn-dim` | `rgba(245, 158, 11, 0.15)` | Low-emphasis warning surface |
| `--err` | `#EF4444` | Danger / error color |
| `--err-dim` | `rgba(239, 68, 68, 0.15)` | Low-emphasis error surface |
| `--text` | `#F1F5F9` | Primary readable text |
| `--text-bright` | `#FFFFFF` | Emphasized white text |
| `--muted` | `#8496B0` | Secondary / metadata text |
| `--faint` | `#506482` | Tertiary / disabled text |

### Base Variables Defined in `css/base.css` (Lines 1–14)
- Backgrounds: `--bg: #05070D`, `--bg2: #070B14`, `--surface: #0B111C`, `--surface2: #101826`, `--glass: rgba(14,21,34,.72)`
- Borders: `--border: rgba(255,255,255,.07)`, `--border2: rgba(255,255,255,.13)`
- Brand & Accents: `--green: #22E58A`, `--cyan: #13C8F5`, `--blue: #3B6BFF`, `--grad: linear-gradient(100deg,#22E58A 0%,#13C8F5 50%,#3B6BFF 100%)`, `--accent: #58A6FF`, `--accent-dim: rgba(88,166,255,.12)`, `--accent-line: rgba(88,166,255,.32)`
- CTA: `--cta: #FFB44A`, `--cta-ink: #16110A`
- States: `--ok: #22E58A`, `--warn: #FFB44A`, `--err: #FF6B7A`
- Text: `--text: #EAF1F7`, `--muted: #93A1B5`, `--faint: #5E6B7E`

---

## 2. Count of Hardcoded Colors per File

Exact counts across all stylesheet files in `css/` and `index.html`:

| File | Total Lines | Hex Colors | RGB / RGBA | HSL / HSLA | Named Colors | Total Hardcoded |
|---|---|---|---|---|---|---|
| `css/base.css` | 77 | 23 | 10 | 0 | 5 | 38 |
| `css/layout.css` | 83 | 1 | 7 | 0 | 1 | 9 |
| `css/components.css` | 96 | 0 | 21 | 0 | 3 | 24 |
| `css/tabs.css` | 223 | 27 | 71 | 0 | 6 | 104 |
| `css/theme.css` | 5,360 | 349 | 311 | 0 | 18 | 678 |
| `index.html` | 1,867 | 19 | 15 | 0 | 0 | 34 |
| **Total** | **7,706** | **419** | **435** | **0** | **33** | **887** |

---

## 3. Colors Set in JavaScript

Scanning all scripts in `js/` and worker scripts for DOM style assignments (`style.color`, `style.background`, `style.borderColor`), inline style markup strings, canvas styles, and SVG fill/stroke attributes reveals **23 exact occurrences**:

| File | Line | Type | Exact Code Snippet | Role / Note |
|---|---|---|---|---|
| `js/documents.js` | 1884 | canvas | `cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.fillStyle='#000';cx.font=font;` | Document page thumbnail generation (canvas white background, black text) |
| `js/documents.js` | 1935 | canvas | `cx.strokeStyle='#333';` | Document thumbnail bounding box stroke |
| `js/documents.js` | 1940 | canvas | `cx.fillStyle='#000';` | Document thumbnail text fill |
| `js/screen.js` | 487 | style.prop | `badgeEl.style.background = 'rgba(63, 185, 80, 0.15)';` | Screen OCR ready badge background |
| `js/screen.js` | 488 | style.prop | `badgeEl.style.color = '#3FB950';` | Screen OCR ready badge text |
| `js/screen.js` | 492 | style.prop | `badgeEl.style.background = 'rgba(63, 185, 80, 0.15)';` | Screen OCR ready badge background |
| `js/screen.js` | 493 | style.prop | `badgeEl.style.color = '#3FB950';` | Screen OCR ready badge text |
| `js/screen.js` | 497 | style.prop | `badgeEl.style.background = 'rgba(255, 180, 74, 0.15)';` | Screen OCR pending badge background |
| `js/screen.js` | 498 | style.prop | `badgeEl.style.color = '#FFB44A';` | Screen OCR pending badge text |
| `js/settings.js` | 134 | inline-style | `style="color:var(--warn,#d97706);...;border:1px solid var(--border)..."` | Ollama unreachable notice box |
| `js/settings.js` | 587 | inline-style | `background:${isReady ? 'var(--ok, #3fb950)' : 'var(--muted, #8b949e)'}` | OCR engine status dot |
| `js/settings.js` | 594 | inline-style | `background:${isReady ? 'rgba(63,185,80,0.15)' : 'rgba(255,180,74,0.15)'};color:${isReady ? 'var(--ok,#3fb950)' : '#FFB44A'}` | OCR status badge |
| `js/welcome.js` | 106 | style.prop | `sumPriv.style.color = disc.isLocal ? '#3FB950' : 'var(--text-dim, #B5C2D4)';` | Welcome wizard privacy summary text color |
| `js/welcome.js` | 156 | style.prop | `vBadge.style.color = '#3FB950';` | Welcome wizard voice badge ready color |
| `js/welcome.js` | 159 | style.prop | `vBadge.style.color = 'var(--text-dim, #B5C2D4)';` | Welcome wizard voice badge default color |
| `js/welcome.js` | 167 | style.prop | `sBadge.style.color = '#3FB950';` | Welcome wizard screen badge ready color |
| `js/welcome.js` | 170 | style.prop | `sBadge.style.color = 'var(--text-dim, #B5C2D4)';` | Welcome wizard screen badge default color |
| `js/welcome.js` | 308 | style.prop | `notice.style.borderColor = 'rgba(63, 185, 80, 0.35)';` | Welcome wizard engine test success border |
| `js/welcome.js` | 309 | style.prop | `notice.style.background = 'rgba(63, 185, 80, 0.08)';` | Welcome wizard engine test success background |
| `js/welcome.js` | 310 | style.prop | `txt.style.color = '#3FB950';` | Welcome wizard engine test success text |
| `js/welcome.js` | 313 | style.prop | `notice.style.borderColor = 'rgba(8, 168, 255, 0.3)';` | Welcome wizard engine test testing border |
| `js/welcome.js` | 314 | style.prop | `notice.style.background = 'rgba(8, 168, 255, 0.06)';` | Welcome wizard engine test testing background |
| `js/welcome.js` | 315 | style.prop | `txt.style.color = 'var(--text-dim, #B5C2D4)';` | Welcome wizard engine test testing text |

---

## 4. Screens and Components with Specialized Palettes

1. **Document Tab (`css/theme.css` Lines 2241–2776):**
   - Main card: `.doc-file-card` (`var(--surface)`, border `var(--border)`).
   - Action button (`#dGo`): primary accent background (`var(--pri)` or `var(--grad-blue)`), text `var(--on-accent, #FFFFFF)`.
   - Progress text (`#dProgText`): `var(--text)` / `var(--muted)`.
   - Status chip (`#dStatusChip`): dynamic state chip:
     - Working: `var(--accent)`
     - Waiting: `var(--icon-purple)` (`#A78BFA` / `#818cf8`)
     - Done: `var(--success)` (`#10B981`)
     - Failed: `var(--danger)` (`#EF4444`)
     - Attention: `var(--warning)` (`#F59E0B`)
   - Preview pane (`.doc-preview-pane`): `var(--surface)` with `var(--text)`.

2. **Settings Tabs (`css/theme.css` Lines 4345–4556, `css/tabs.css`):**
   - Navigation buttons (`.settings-nav-btn`): active background `var(--selected, #102448)`, hover `var(--hover, #0d1e3a)`.
   - Card containers: `var(--surface-card, #091428)`, border `var(--border)`.
   - Text inputs and selects: background `var(--input, #071022)`, border `var(--input-border, rgba(28, 64, 118, 0.45))`.

3. **Welcome Wizard (`css/theme.css` Lines 4794–5140, `js/welcome.js`):**
   - Modal backdrop: `.welcome-ov` (`rgba(4, 9, 20, 0.82)` with backdrop blur).
   - Modal window: `.welcome-modal` (`var(--panel, #071022)`, border `var(--border)`).
   - Progress indicators: `.welcome-step-dot` (`var(--accent)` when active, `var(--success)` when complete).

4. **Popups, Dropdowns & Modals (`css/theme.css` Lines 303–1035, 5141–5360):**
   - Unified Language Picker (`.unified-lang-picker`): surface `var(--popup, #0a1528)`, borders `var(--border)`, search input `var(--input)`.
   - Dropdown menus: `.dropdown-menu` surface `var(--popup)`.

5. **Toasts (`css/components.css` Lines 40–70, `css/theme.css`):**
   - Toast container (`.toast`): surface `var(--popup, #0a1528)`, border `var(--border2)`, box-shadow `var(--shadow-md)`.
   - Semantic toast borders: success (`var(--success)`), error (`var(--danger)`), warning (`var(--warning)`).

6. **Screen Translator (`screen-translator/capture.html`, `screen-translator/overlay.html`, `screen-translator/manager.js`):**
   - `capture.html` (384 lines): fullscreen screenshot snip tool with translucent backdrop `rgba(0, 0, 0, 0.3)`, selection highlight border `var(--accent, #08A8FF)`, and dimensions pill.
   - `overlay.html` (803 lines): floating desktop translation overlay with dark translucent acrylic bubbles (`rgba(7, 16, 34, 0.88)`), border `rgba(255, 255, 255, 0.12)`, text `#F1F5F9`.

7. **AI Worker Scripts (`ai-worker.js`, `piper-worker.js`):**
   - Pure computational worker threads running WebGPU/WASM ONNX models off-thread; no DOM or styling dependencies.

---

## 5. Images and SVG Logos Containing Color (Untouched)

All brand assets use the MAKAN winged logo palette and must remain untouched:
- `brand/makanlab-m-mark.svg` (linearGradient `#79F8C8` -> `#08E7E5` -> `#08A8FF` -> `#2869F5`)
- `brand/makanlab-square-icon.svg`
- `brand/makanlab-wordmark.svg`
- `brand/makanlab-signature-with-tagline.svg`
- `brand/makanlab-m-mark.png`, `brand/makanlab-square-icon.png`, `brand/makanlab-wordmark.png`
- `icon-192.png`, `icon-512.png`, `assets/icon.png`, `assets/tray.png`, `assets/icon.ico`

---

## 6. Assumptions of Light-on-Dark Text

In the existing dark-only stylesheet, several rules assume a dark background and hardcode light text `#FFFFFF` or `#fff` without relying on theme tokens:

1. `css/base.css:22`: `::selection { background: rgba(19, 200, 245, 0.35); color: #fff; }` (hardcoded white on selection highlight).
2. `css/theme.css:178`: `.btn-primary { color: #FFFFFF; }` (primary buttons assume dark background with white ink).
3. `css/theme.css:377`: `.status-badge.active { color: #FFFFFF; }`
4. `css/theme.css:495`: `.chip-pill.selected { color: #FFFFFF; }`
5. `css/theme.css:1937`: `.sub-prog-bar-text { color: #fff !important; }`
6. `css/theme.css:2490`: `#dGo { color: #fff !important; }`
7. `css/theme.css:3690`: `.screen-snip-hint { color: #ffffff; }`
8. `css/theme.css:4171`: `.ocr-box-label { color: #ffffff; }`
9. `css/theme.css:4873`: `.welcome-hero h1 { color: #fff; }`
10. `css/theme.css:4880`: `.welcome-btn-primary { color: #fff; }`
11. `css/theme.css:5052`: `.welcome-finish-btn { color: #fff; }`
12. `css/theme.css:5286`: `.ulp-badge { color: #fff; }`

When switching to light themes (e.g., **Platinum Blue** or **Champagne Minimal**), text on light surfaces must use `var(--text)` or `var(--on-accent)` rather than hardcoded white.

---

## 7. Conversion Allow-List (Items Retaining Literal Colors)

The following items should not be converted to theme tokens to preserve branding or functional integrity:
- Brand gradients (`--grad`, `--grad-mint-blue`, `#79F8C8` -> `#08E7E5` -> `#08A8FF` -> `#2869F5` in `css/base.css:5` and `css/theme.css:39`).
- Document thumbnail canvas rendering in `js/documents.js:1884–1940` (renders physical white document page preview with black text for page thumbnail generation).
- Brand SVGs in `brand/*.svg`.
