# Seelen Web Page Widget — Round Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user's post-test changes to the working widget: remove the open-in-browser button, make the hover bar reliable with a configurable hide delay, replace left/top crop with a page-region model, add a hide-scrollbar switch, and allow multiple instances with per-instance placement.

**Architecture:** Same three-file widget. `src/frame.ts` grows a `computeLayout` function that derives scale and iframe geometry from the region settings and reports the viewport height the widget should adopt. `src/index.ts` gains a small bar hover state machine, per-instance position persistence (replacing the library's shared-key persistence), and an auto-height step after layout. The manifest declares the new settings and `instances: Multiple`.

**Tech Stack:** unchanged — TypeScript 5, esbuild, `@seelen-ui/lib` 2.8.4, `@tauri-apps/api` 2.11, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-22-webpage-widget-design.md` plus the user's round-two decisions recorded in this plan's Global Constraints.

## Global Constraints

- Resource id stays `@axe08/webpage`. Preset stays `Desktop`. `instances` becomes `Multiple`.
- Settings keys are exactly: `url`, `zoom`, `regionLeft`, `regionTop`, `regionWidth`, `regionHeight`, `hideScrollbar`, `reloadMinutes`, `barMode`, `barHideDelayMs`, `barColor`. The old `cropX`/`cropY` keys are removed.
- Region semantics: `regionWidth > 0` → `scale = viewportW / regionWidth` and `zoom` is ignored; `regionWidth = 0` → `scale = zoom`. `regionHeight > 0` → the widget's viewport height is set to `ceil(regionHeight * scale)` after every layout; `regionHeight = 0` → height follows the window.
- Hide scrollbar: when on, the iframe's laid-out width gains `SCROLLBAR_PX = 17` page pixels so the page's vertical scrollbar falls outside the clipped viewport.
- Bar hover: entering the hot-zone or the bar shows the bar and cancels any pending hide; leaving either schedules a hide after `barHideDelayMs` (default 600, range 0–5000). `always` mode never hides.
- The open-in-browser button and the `SeelenCommand.OpenFile` call are removed entirely.
- Per-instance persistence: `Widget.self.init({ saveAndRestoreLastRect: false })`; the widget stores physical `x`, `y`, `width`, `height` in `localStorage` under keys prefixed `webpage:<instanceId or "single">:` and restores them before `ready()`.
- Tests run with `npm test`; typecheck with `npm run typecheck`; load with `npm run load` (Seelen UI is running).
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Region geometry, settings model, and manifest

**Files:**
- Modify: `src/frame.ts` (replace whole file)
- Modify: `src/frame.test.ts` (replace whole file)
- Modify: `metadata.yml` (replace whole file)

**Interfaces:**
- Produces:
  ```ts
  export const SCROLLBAR_PX = 17;
  export interface FrameRect { left: number; top: number; width: number; height: number; scale: number; }
  export interface Layout { frame: FrameRect; desiredViewportH: number | null; }
  export type BarMode = "always" | "hover";
  export interface WidgetSettings {
    url: string; zoom: number;
    regionLeft: number; regionTop: number; regionWidth: number; regionHeight: number;
    hideScrollbar: boolean; reloadMinutes: number;
    barMode: BarMode; barHideDelayMs: number; barColor: string;
  }
  export const DEFAULT_SETTINGS: WidgetSettings;
  export function computeLayout(viewportW: number, viewportH: number, s: WidgetSettings): Layout;
  export function normalizeSettings(raw: Record<string, unknown>): WidgetSettings;
  ```
- The old `computeFrameRect` is removed; Task 2 switches the runtime to `computeLayout`.

- [ ] **Step 1: Replace `src/frame.test.ts` with the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { computeLayout, normalizeSettings, DEFAULT_SETTINGS, SCROLLBAR_PX } from "./frame.ts";

const base = { ...DEFAULT_SETTINGS, hideScrollbar: false };

test("computeLayout with no region and zoom 1 fills the viewport exactly", () => {
  const { frame, desiredViewportH } = computeLayout(800, 600, base);
  assert.deepEqual(frame, { left: 0, top: 0, width: 800, height: 600, scale: 1 });
  assert.equal(desiredViewportH, null);
});

test("computeLayout with no region uses zoom as the scale and offsets by left/top", () => {
  const { frame } = computeLayout(800, 600, { ...base, zoom: 2, regionLeft: 100, regionTop: 50 });
  assert.deepEqual(frame, { left: -200, top: -100, width: 500, height: 350, scale: 2 });
});

test("computeLayout with regionWidth derives scale from the viewport width and ignores zoom", () => {
  const { frame, desiredViewportH } = computeLayout(800, 600, { ...base, zoom: 2, regionLeft: 100, regionWidth: 400 });
  assert.equal(frame.scale, 2);
  assert.equal(frame.left, -200);
  assert.equal(frame.width, 500);
  assert.equal(frame.height, 300);
  assert.equal(desiredViewportH, null);
});

test("computeLayout with regionHeight reports the viewport height that fits the region", () => {
  const { frame, desiredViewportH } = computeLayout(800, 600, { ...base, regionTop: 20, regionWidth: 400, regionHeight: 300 });
  assert.equal(frame.scale, 2);
  assert.equal(frame.top, -40);
  assert.equal(frame.height, 320);
  assert.equal(desiredViewportH, 600);
});

test("computeLayout with regionHeight but no regionWidth uses zoom for the scale", () => {
  const { frame, desiredViewportH } = computeLayout(800, 600, { ...base, zoom: 0.5, regionHeight: 400 });
  assert.equal(frame.scale, 0.5);
  assert.equal(frame.width, 1600);
  assert.equal(frame.height, 400);
  assert.equal(desiredViewportH, 200);
});

test("computeLayout adds the scrollbar allowance to the iframe width when hideScrollbar is on", () => {
  const off = computeLayout(800, 600, base).frame.width;
  const on = computeLayout(800, 600, { ...base, hideScrollbar: true }).frame.width;
  assert.equal(on, off + SCROLLBAR_PX);
  const region = computeLayout(800, 600, { ...base, hideScrollbar: true, regionWidth: 400 }).frame;
  assert.equal(region.width, 400 + SCROLLBAR_PX);
});

test("computeLayout rounds sizes up and offsets to whole pixels", () => {
  const { frame } = computeLayout(801, 601, { ...base, zoom: 0.75 });
  assert.equal(frame.width, Math.ceil(801 / 0.75));
  assert.equal(frame.height, Math.ceil(601 / 0.75));
});

test("normalizeSettings returns defaults for an empty object", () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.url, "http://localhost:8080");
  assert.equal(DEFAULT_SETTINGS.zoom, 1);
  assert.equal(DEFAULT_SETTINGS.barMode, "hover");
  assert.equal(DEFAULT_SETTINGS.barHideDelayMs, 600);
  assert.equal(DEFAULT_SETTINGS.hideScrollbar, true);
});

test("normalizeSettings converts zoom percent to a clamped factor", () => {
  assert.equal(normalizeSettings({ zoom: 150 }).zoom, 1.5);
  assert.equal(normalizeSettings({ zoom: 10 }).zoom, 0.25);
  assert.equal(normalizeSettings({ zoom: 999 }).zoom, 2);
  assert.equal(normalizeSettings({ zoom: "abc" }).zoom, 1);
});

test("normalizeSettings clamps region values, reload minutes and hide delay to integers in range", () => {
  const s = normalizeSettings({ regionLeft: -5, regionTop: 12.7, regionWidth: -1, regionHeight: 99999, reloadMinutes: 5000, barHideDelayMs: 9000 });
  assert.equal(s.regionLeft, 0);
  assert.equal(s.regionTop, 12);
  assert.equal(s.regionWidth, 0);
  assert.equal(s.regionHeight, 20000);
  assert.equal(s.reloadMinutes, 1440);
  assert.equal(s.barHideDelayMs, 5000);
  assert.equal(normalizeSettings({ reloadMinutes: -1 }).reloadMinutes, 0);
  assert.equal(normalizeSettings({ barHideDelayMs: -1 }).barHideDelayMs, 0);
});

test("normalizeSettings trims the url and blanks anything that is not http(s)", () => {
  assert.equal(normalizeSettings({ url: "  http://a.local/x  " }).url, "http://a.local/x");
  assert.equal(normalizeSettings({ url: "ftp://a.local" }).url, "");
  assert.equal(normalizeSettings({ url: "not a url" }).url, "");
  assert.equal(normalizeSettings({ url: 42 }).url, "");
});

test("normalizeSettings only accepts known bar modes, booleans for hideScrollbar, and non-empty colours", () => {
  assert.equal(normalizeSettings({ barMode: "always" }).barMode, "always");
  assert.equal(normalizeSettings({ barMode: "sideways" }).barMode, "hover");
  assert.equal(normalizeSettings({ hideScrollbar: false }).hideScrollbar, false);
  assert.equal(normalizeSettings({ hideScrollbar: "yes" }).hideScrollbar, true);
  assert.equal(normalizeSettings({ barColor: "" }).barColor, DEFAULT_SETTINGS.barColor);
  assert.equal(normalizeSettings({ barColor: "#ff000080" }).barColor, "#ff000080");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the frame tests FAIL (`computeLayout` and `SCROLLBAR_PX` are not exported); the 6 loader tests still pass.

- [ ] **Step 3: Replace `src/frame.ts`**

```ts
/** Page pixels added to the iframe width so the page's own scrollbar is clipped away. */
export const SCROLLBAR_PX = 17;

export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

export interface Layout {
  frame: FrameRect;
  /** Viewport height (CSS px) the widget should adopt so the region fits, or null to follow the window. */
  desiredViewportH: number | null;
}

export type BarMode = "always" | "hover";

export interface WidgetSettings {
  url: string;
  zoom: number;
  regionLeft: number;
  regionTop: number;
  regionWidth: number;
  regionHeight: number;
  hideScrollbar: boolean;
  reloadMinutes: number;
  barMode: BarMode;
  barHideDelayMs: number;
  barColor: string;
}

export const DEFAULT_SETTINGS: WidgetSettings = {
  url: "http://localhost:8080",
  zoom: 1,
  regionLeft: 0,
  regionTop: 0,
  regionWidth: 0,
  regionHeight: 0,
  hideScrollbar: true,
  reloadMinutes: 0,
  barMode: "hover",
  barHideDelayMs: 600,
  barColor: "#00000099",
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const REGION_MAX = 20000;
const RELOAD_MAX_MINUTES = 1440;
const HIDE_DELAY_MAX_MS = 5000;

/**
 * Lays out the iframe inside a clipping viewport of viewportW x viewportH.
 * The page region starting at (regionLeft, regionTop) fills the viewport.
 * With regionWidth > 0 the scale is derived so that region width spans the
 * viewport; otherwise the zoom factor is the scale. With regionHeight > 0
 * the layout also reports the viewport height that makes the region fit.
 */
export function computeLayout(viewportW: number, viewportH: number, s: WidgetSettings): Layout {
  const scale = s.regionWidth > 0 ? viewportW / s.regionWidth : s.zoom;
  const pageW = s.regionWidth > 0 ? s.regionWidth : viewportW / scale;
  const pageH = s.regionHeight > 0 ? s.regionHeight : viewportH / scale;
  const scrollbar = s.hideScrollbar ? SCROLLBAR_PX : 0;
  return {
    frame: {
      left: Math.round(-s.regionLeft * scale) + 0,
      top: Math.round(-s.regionTop * scale) + 0,
      width: Math.ceil(pageW + s.regionLeft + scrollbar),
      height: Math.ceil(pageH + s.regionTop),
      scale,
    },
    desiredViewportH: s.regionHeight > 0 ? Math.ceil(s.regionHeight * scale) : null,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return trimmed;
  } catch {
    return "";
  }
}

function normalizeZoom(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.zoom;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n / 100));
}

export function normalizeSettings(raw: Record<string, unknown>): WidgetSettings {
  const barMode: BarMode = raw.barMode === "always" ? "always" : "hover";
  const barColor =
    typeof raw.barColor === "string" && raw.barColor.trim() !== ""
      ? raw.barColor
      : DEFAULT_SETTINGS.barColor;
  return {
    url: "url" in raw ? normalizeUrl(raw.url) : DEFAULT_SETTINGS.url,
    zoom: "zoom" in raw ? normalizeZoom(raw.zoom) : DEFAULT_SETTINGS.zoom,
    regionLeft: clampInt(raw.regionLeft, 0, REGION_MAX, 0),
    regionTop: clampInt(raw.regionTop, 0, REGION_MAX, 0),
    regionWidth: clampInt(raw.regionWidth, 0, REGION_MAX, 0),
    regionHeight: clampInt(raw.regionHeight, 0, REGION_MAX, 0),
    hideScrollbar: typeof raw.hideScrollbar === "boolean" ? raw.hideScrollbar : DEFAULT_SETTINGS.hideScrollbar,
    reloadMinutes: clampInt(raw.reloadMinutes, 0, RELOAD_MAX_MINUTES, 0),
    barMode,
    barHideDelayMs: clampInt(raw.barHideDelayMs, 0, HIDE_DELAY_MAX_MS, DEFAULT_SETTINGS.barHideDelayMs),
    barColor,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: 12 frame tests + 6 loader tests = 18 PASS. `npm run typecheck` will now FAIL because `src/index.ts` still imports `computeFrameRect`; that is expected and is fixed in Task 2. Record the exact tsc error in the report.

- [ ] **Step 5: Commit the geometry change**

```bash
git add src/frame.ts src/frame.test.ts
git commit -m "feat: page-region layout model with scrollbar allowance and hide delay setting

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Replace `metadata.yml`**

```yaml
id: "@axe08/webpage"
icon: PiGlobeHemisphereWest
metadata:
  displayName: Web Page
  description: Shows a live web page on your desktop, such as a homelab dashboard.
  tags: [web, dashboard, iframe, homelab]
preset: Desktop
instances: Multiple
lazy: false
html: !include index.html
js: !include index.js
css: !include index.css
settings:
  - type: text
    key: url
    label: Page URL
    description: Any http or https address that allows being embedded (no X-Frame-Options).
    defaultValue: "http://localhost:8080"

  - group:
      label: View
      items:
        - type: range
          key: zoom
          label: Zoom (%)
          description: Used only when Region width is 0.
          min: 25
          max: 200
          step: 5
          defaultValue: 100

        - type: switch
          key: hideScrollbar
          label: Hide page scrollbar
          description: Clips the page's own scrollbar. Wheel scrolling still works.
          defaultValue: true

  - group:
      label: Region (page pixels)
      items:
        - type: number
          key: regionLeft
          label: Left
          description: Page pixels hidden on the left.
          min: 0
          defaultValue: 0

        - type: number
          key: regionTop
          label: Top
          description: Page pixels hidden at the top.
          min: 0
          defaultValue: 0

        - type: number
          key: regionWidth
          label: Width
          description: 0 = to the edge. Above 0, this width is scaled to fill the widget and Zoom is ignored.
          min: 0
          defaultValue: 0

        - type: number
          key: regionHeight
          label: Height
          description: 0 = follow the window. Above 0, the widget height is set so this region fits exactly.
          min: 0
          defaultValue: 0

  - group:
      label: Behaviour
      items:
        - type: number
          key: reloadMinutes
          label: Auto reload every (minutes)
          description: 0 disables automatic reload.
          min: 0
          max: 1440
          defaultValue: 0

        - type: select
          key: barMode
          label: Drag bar
          options:
            - label: Show on hover
              value: hover
            - label: Always visible
              value: always
          defaultValue: hover

        - type: number
          key: barHideDelayMs
          label: Drag bar hide delay (ms)
          description: How long after the mouse leaves before the bar hides.
          min: 0
          max: 5000
          defaultValue: 600

        - type: color
          key: barColor
          label: Drag bar colour
          allowAlpha: true
          defaultValue: "#00000099"
```

- [ ] **Step 7: Validate the manifest with the Seelen CLI**

Run: `node scripts/build.mjs 2>&1 | tail -3; "C:/Program Files/Seelen/Seelen UI/slu.exe" resource load widget "B:/VibeCode/seelen-webpage-widget/dist"; echo exit=$?`
Expected: `exit=0`. The build bundles the still-unfixed `src/index.ts` (esbuild does not typecheck), so the widget may misbehave until Task 2, but the manifest must parse. If the CLI reports a manifest error, fix the field it names and re-run.

- [ ] **Step 8: Commit the manifest**

```bash
git add metadata.yml
git commit -m "feat: declare region, scrollbar, hide-delay settings and multiple instances

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Runtime — bar state machine, per-instance persistence, region auto-height, no open button

**Files:**
- Modify: `index.html` (replace)
- Modify: `index.css` (replace)
- Modify: `src/index.ts` (replace)

**Interfaces:**
- Consumes: `computeLayout`, `normalizeSettings`, `WidgetSettings` from `./frame.ts`; `probe`, `startAutoReload` from `./loader.ts`; `Widget`, `Settings` from `@seelen-ui/lib`; `LogicalSize`, `PhysicalPosition`, `PhysicalSize` from `@tauri-apps/api/dpi`.
- DOM contract: `.webpage-root[data-bar-mode][data-bar-visible]`, `.webpage-hotzone`, `.webpage-bar`, `.webpage-bar-title`, `.webpage-bar-reload`, `.webpage-viewport`, `.webpage-frame`, `.webpage-error`, `.webpage-error-text`, `.webpage-error-retry`, `.webpage-grip`. (No `.webpage-bar-open`.)

- [ ] **Step 1: Replace `index.html`**

```html
<div class="webpage-root" data-bar-mode="hover" data-bar-visible="false">
  <div class="webpage-hotzone" aria-hidden="true"></div>
  <div class="webpage-bar">
    <span class="webpage-bar-title">Web Page</span>
    <button class="webpage-bar-reload" type="button" title="Reload">&#x21bb;</button>
  </div>
  <div class="webpage-viewport">
    <iframe class="webpage-frame" title="Embedded page" referrerpolicy="no-referrer"></iframe>
    <div class="webpage-error" hidden>
      <p class="webpage-error-text">Cannot reach page.</p>
      <button class="webpage-error-retry" type="button">Retry</button>
    </div>
  </div>
  <div class="webpage-grip" title="Resize"></div>
</div>
```

- [ ] **Step 2: Replace `index.css`**

```css
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.webpage-root {
  --webpage-bar-height: 28px;
  --webpage-bar-color: #00000099;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  color: #fff;
}

/* Transparent strip at the top edge that reveals the bar in hover mode. */
.webpage-hotzone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  z-index: 3;
}
.webpage-root[data-bar-mode="always"] .webpage-hotzone { display: none; }
.webpage-root[data-bar-visible="true"] .webpage-hotzone { pointer-events: none; }

.webpage-bar {
  flex: 0 0 var(--webpage-bar-height);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  background: var(--webpage-bar-color);
  cursor: move;
  user-select: none;
  z-index: 2;
}
.webpage-root[data-bar-mode="hover"] .webpage-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--webpage-bar-height);
  transform: translateY(-100%);
  transition: transform 120ms ease-out;
}
.webpage-root[data-bar-mode="hover"][data-bar-visible="true"] .webpage-bar {
  transform: translateY(0);
}

.webpage-bar-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
}
.webpage-bar button {
  all: unset;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}
.webpage-bar button:hover { background: rgba(255, 255, 255, 0.18); }
.webpage-bar button:focus-visible { outline: 1px solid rgba(255, 255, 255, 0.7); }

.webpage-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}

.webpage-frame {
  position: absolute;
  border: 0;
  transform-origin: 0 0;
  background: #fff;
}

.webpage-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(20, 20, 20, 0.85);
  z-index: 1;
}
.webpage-error[hidden] { display: none; }
.webpage-error-text { margin: 0; text-align: center; padding: 0 12px; }
.webpage-error-retry {
  all: unset;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
}
.webpage-error-retry:focus-visible { outline: 1px solid rgba(255, 255, 255, 0.7); }

.webpage-grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  z-index: 3;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.55) 50%);
}
```

- [ ] **Step 3: Replace `src/index.ts`**

```ts
import { Settings, Widget } from "@seelen-ui/lib";
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { computeLayout, normalizeSettings, type WidgetSettings } from "./frame.ts";
import { probe, startAutoReload } from "./loader.ts";

function $<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`webpage widget: missing element ${selector}`);
  return el;
}

const root = $<HTMLDivElement>(".webpage-root");
const hotzone = $<HTMLDivElement>(".webpage-hotzone");
const bar = $<HTMLDivElement>(".webpage-bar");
const title = $<HTMLSpanElement>(".webpage-bar-title");
const reloadBtn = $<HTMLButtonElement>(".webpage-bar-reload");
const viewport = $<HTMLDivElement>(".webpage-viewport");
const frame = $<HTMLIFrameElement>(".webpage-frame");
const errorBox = $<HTMLDivElement>(".webpage-error");
const errorText = $<HTMLParagraphElement>(".webpage-error-text");
const retryBtn = $<HTMLButtonElement>(".webpage-error-retry");
const grip = $<HTMLDivElement>(".webpage-grip");

const widget = Widget.self;

let current: WidgetSettings = normalizeSettings({});
let cancelAutoReload: () => void = () => {};
let loadedUrl = "";
let loadGeneration = 0;
let focusRequested = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let autoHeightTimer: ReturnType<typeof setTimeout> | null = null;
let lastAppliedViewportH = -1;

// ---------- error overlay ----------

function showError(message: string): void {
  errorText.textContent = message;
  errorBox.hidden = false;
}

function hideError(): void {
  errorBox.hidden = true;
}

// ---------- layout ----------

function layoutFrame(): void {
  const { width: vw, height: vh } = viewport.getBoundingClientRect();
  if (vw === 0 || vh === 0) return;
  const { frame: r, desiredViewportH } = computeLayout(vw, vh, current);
  frame.style.left = `${r.left}px`;
  frame.style.top = `${r.top}px`;
  frame.style.width = `${r.width}px`;
  frame.style.height = `${r.height}px`;
  frame.style.transform = `scale(${r.scale})`;
  scheduleAutoHeight(vh, desiredViewportH);
}

/**
 * When a region height is set, resize the window so the viewport is exactly
 * that tall. Debounced so it runs once a resize drag has ended rather than
 * fighting the grip, and guarded so a size the window refuses is tried once.
 */
function scheduleAutoHeight(currentViewportH: number, desiredViewportH: number | null): void {
  if (autoHeightTimer !== null) clearTimeout(autoHeightTimer);
  autoHeightTimer = setTimeout(() => {
    autoHeightTimer = null;
    void applyAutoHeight(currentViewportH, desiredViewportH);
  }, 250);
}

async function applyAutoHeight(currentViewportH: number, desiredViewportH: number | null): Promise<void> {
  if (desiredViewportH === null) {
    lastAppliedViewportH = -1;
    return;
  }
  if (Math.abs(currentViewportH - desiredViewportH) <= 1) {
    lastAppliedViewportH = -1; // settled; a later manual resize may re-correct
    return;
  }
  if (lastAppliedViewportH === desiredViewportH) return; // tried once, window refused
  lastAppliedViewportH = desiredViewportH;
  const chromeH = document.documentElement.clientHeight - currentViewportH;
  const w = document.documentElement.clientWidth;
  try {
    await widget.window.setSize(new LogicalSize(w, chromeH + desiredViewportH));
  } catch (err) {
    console.error("webpage widget: auto height failed", err);
  }
}

// ---------- page loading ----------

async function loadPage(force: boolean): Promise<void> {
  const gen = ++loadGeneration;
  const url = current.url;
  if (url === "") {
    frame.removeAttribute("src");
    loadedUrl = "";
    showError("Invalid URL. Set a valid http(s) address in the widget settings.");
    return;
  }
  const reachable = await probe(url);
  if (gen !== loadGeneration) return;
  if (!reachable) {
    showError(`Cannot reach ${url}`);
    return;
  }
  hideError();
  if (force || url !== loadedUrl) {
    frame.src = url;
    loadedUrl = url;
  }
}

// ---------- bar ----------

function cancelHide(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function showBar(): void {
  cancelHide();
  root.dataset.barVisible = "true";
}

function scheduleHide(): void {
  if (current.barMode === "always") return;
  cancelHide();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    root.dataset.barVisible = "false";
  }, current.barHideDelayMs);
}

function applyBar(): void {
  root.dataset.barMode = current.barMode;
  root.style.setProperty("--webpage-bar-color", current.barColor);
  if (current.barMode === "always") {
    showBar();
  } else if (hideTimer === null && root.dataset.barVisible === "true" && !bar.matches(":hover")) {
    scheduleHide();
  }
  try {
    title.textContent = current.url === "" ? "Web Page" : new URL(current.url).host;
  } catch {
    title.textContent = "Web Page";
  }
}

// ---------- settings ----------

function applyAutoReload(): void {
  cancelAutoReload();
  cancelAutoReload = startAutoReload(current.reloadMinutes, () => {
    if (errorBox.hidden) void loadPage(true);
  });
}

async function applySettings(raw: Record<string, unknown>): Promise<void> {
  const next = normalizeSettings(raw);
  const urlChanged = next.url !== current.url;
  current = next;
  applyBar();
  layoutFrame();
  applyAutoReload();
  if (urlChanged || loadedUrl === "") await loadPage(false);
}

// ---------- per-instance position persistence ----------

const storageKey = (k: string): string => `webpage:${widget.decoded.instanceId ?? "single"}:${k}`;

function readStoredInt(k: string): number | null {
  const v = localStorage.getItem(storageKey(k));
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function restoreRect(): Promise<void> {
  const x = readStoredInt("x");
  const y = readStoredInt("y");
  const w = readStoredInt("width");
  const h = readStoredInt("height");
  if (w !== null && h !== null && w > 0 && h > 0) {
    await widget.window.setSize(new PhysicalSize(w, h));
  }
  if (x !== null && y !== null) {
    await widget.adjustAndSetPosition(x, y);
  }
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args) => {
    if (t !== null) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function persistRect(): Promise<void> {
  await widget.window.onMoved(
    debounce((e: { payload: PhysicalPosition }) => {
      localStorage.setItem(storageKey("x"), String(e.payload.x));
      localStorage.setItem(storageKey("y"), String(e.payload.y));
    }, 500),
  );
  await widget.window.onResized(
    debounce((e: { payload: PhysicalSize }) => {
      localStorage.setItem(storageKey("width"), String(e.payload.width));
      localStorage.setItem(storageKey("height"), String(e.payload.height));
    }, 500),
  );
}

// ---------- interactions ----------

function wireInteractions(): void {
  // Drag is driven only by this handler; the bar has no data-tauri-drag-region
  // attribute, so clicks on the buttons never start a drag.
  bar.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.button !== 0) return;
    void widget.window.startDragging();
  });

  grip.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void widget.window.startResizeDragging("SouthEast");
  });

  hotzone.addEventListener("mouseenter", () => {
    if (current.barMode === "hover") showBar();
  });
  hotzone.addEventListener("mouseleave", scheduleHide);
  bar.addEventListener("mouseenter", showBar);
  bar.addEventListener("mouseleave", scheduleHide);

  reloadBtn.addEventListener("click", () => void loadPage(true));
  retryBtn.addEventListener("click", () => void loadPage(true));

  // Desktop widgets are created non-focusable; request focus once so typing
  // inside the page works. Best effort.
  root.addEventListener("pointerdown", () => {
    if (focusRequested) return;
    focusRequested = true;
    widget.window.setFocusable(true).catch(() => {});
  });

  new ResizeObserver(() => layoutFrame()).observe(viewport);
}

// ---------- bootstrap ----------

async function main(): Promise<void> {
  await widget.init({ useThemes: false, saveAndRestoreLastRect: false });
  await restoreRect();
  await persistRect();
  wireInteractions();
  const settings = await Settings.getAsync();
  await applySettings(settings.getCurrentWidgetConfig() as Record<string, unknown>);
  await Settings.onChange((s) => {
    applySettings(s.getCurrentWidgetConfig() as Record<string, unknown>).catch((err) => {
      console.error("webpage widget: failed to apply settings", err);
      showError("Failed to apply settings. Open DevTools (Ctrl+Shift+I) for details.");
    });
  });
  await widget.ready();
  layoutFrame();
}

main().catch((err) => {
  console.error("webpage widget failed to start", err);
  showError("Widget failed to start. Open DevTools (Ctrl+Shift+I) for details.");
});
```

- [ ] **Step 4: Typecheck, test, build, load**

Run: `npm run typecheck && npm test && npm run load; echo exit=$?`
Expected: typecheck clean, 18 tests pass, load exit 0. If `onMoved`/`onResized` callback typings disagree with the `{ payload: PhysicalPosition }` shape, import and use Tauri's event type instead (`import type { Event } from "@tauri-apps/api/event"` and `(e: Event<PhysicalPosition>)`), and record the change.

- [ ] **Step 5: Controller render check**

The controller captures the widget window via PrintWindow after load. The implementer does not do a screenshot.

- [ ] **Step 6: Commit**

```bash
git add index.html index.css src/index.ts
git commit -m "feat: hover bar hide delay, per-instance placement, region auto-height, drop open button

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: README update and permanent bundle

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Replace the `## Features` bullet list with:
```markdown
- Sits on the desktop behind your windows; each instance remembers its own position and size.
- Multiple instances, each with its own URL and settings.
- Page region cropping: left, top, width and height in page pixels. Width scales the region to fill the widget; height sizes the widget to fit.
- Zoom (25–200 %) when no region width is set.
- Hide the page's scrollbar (wheel scrolling still works).
- Drag bar (always visible or reveal on hover, with a configurable hide delay) with a reload button.
- Corner grip to resize.
- Optional auto reload interval.
- Reachability check with a retry overlay when the page is down.
```

Replace the `## Settings` table with:
```markdown
| Setting | Default | Notes |
|---|---|---|
| Page URL | `http://localhost:8080` | http or https |
| Zoom (%) | 100 | 25–200; used only when Region width is 0 |
| Hide page scrollbar | on | clips the page's own scrollbar |
| Region Left / Top (px) | 0 / 0 | page pixels hidden on the left / top |
| Region Width (px) | 0 | 0 = to the edge; above 0 scales that width to fill the widget |
| Region Height (px) | 0 | 0 = follow the window; above 0 sets the widget height to fit |
| Auto reload every (minutes) | 0 | 0 = never |
| Drag bar | Show on hover | or Always visible |
| Drag bar hide delay (ms) | 600 | 0–5000 |
| Drag bar colour | `#00000099` | alpha supported |
```

Add after the Settings section:
```markdown
## Multiple instances

The widget is declared with `instances: Multiple`. Add instances from the
widget's page in Seelen Settings → Widgets → Web Page; each instance has its
own settings and remembers its own placement.
```

In `## Known issues`, add a second bullet:
```markdown
- The scrollbar cannot be recoloured: it belongs to the embedded page. "Hide page scrollbar" clips it instead.
```

- [ ] **Step 2: Bundle and install permanently**

Run: `npm run bundle && ls -la dist/*.yml && cp dist/bundle*.yml "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml" && ls -la "$APPDATA/com.seelen.seelen-ui/widgets/"`
Expected: a fresh bundle file, copied over the previous `webpage.yml`. Do not restart Seelen UI.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document region cropping, scrollbar hiding, hide delay and multiple instances

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the round-two decisions

- Open button removed: Task 2 markup and runtime (no `.webpage-bar-open`, no `invoke`).
- Drag reliability: Task 2 `showBar` on bar mouseenter cancels pending hide; `barHideDelayMs` setting from Task 1 manifest.
- Page region model: Task 1 `computeLayout` + manifest; Task 2 `layoutFrame` + `applyAutoHeight`.
- Hide scrollbar: Task 1 `SCROLLBAR_PX` + manifest switch; consumed by `computeLayout`.
- Multiple instances: Task 1 manifest `instances: Multiple`; Task 2 per-instance persistence with `saveAndRestoreLastRect: false`.
- README: Task 3.

---

### Task 4: Fixes from user testing — iframe size cap, default instance registration

**Files:**
- Modify: `index.css` (one rule)
- Modify: `src/index.ts` (one new function, called from `main`)
- Modify: `metadata.yml` (one description)
- Modify: `README.md` (Multiple instances section)

**Findings being fixed:**
1. Seelen's host stylesheet applies `iframe { max-width: 100%; max-height: 100%; }` inside `@layer basic-widget-reset`. The widget's inline width/height are capped at the viewport, which discards the scrollbar allowance at zoom ≤ 100 % and truncates the page at zoom < 100 %.
2. Seelen's settings page lists only the keys under `$instances`; the default window runs with the nil instance id `00000000-0000-0000-0000-000000000000`, which is never in that list, so once any instance is added the default window's settings cannot be edited. Seelen's backend creates instances from `$instances` keys with a duplicate check on the id and always keeps the nil instance, so the default window can safely register itself under its own id.

- [ ] **Step 1: Override the host cap in `index.css`**

Change the `.webpage-frame` rule to:
```css
.webpage-frame {
  position: absolute;
  border: 0;
  transform-origin: 0 0;
  background: #fff;
  max-width: none;
  max-height: none;
}
```

- [ ] **Step 2: Register the default instance in `src/index.ts`**

Add after the `storageKey` helper:
```ts
const NIL_INSTANCE_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Seelen's settings page lists only the ids under `$instances`, and the
 * default window runs with the nil id, which is never listed. Register it
 * so it shows up as an editable instance. Seelen dedupes on instance id, so
 * no second window is created. Best effort: failures are logged only.
 */
async function ensureDefaultInstanceRegistered(): Promise<void> {
  if (widget.decoded.instanceId !== NIL_INSTANCE_ID) return;
  try {
    const settings = await Settings.getAsync();
    const byWidget = settings.inner.byWidget;
    const root = byWidget[widget.id] ?? { enabled: true };
    const instances = root.$instances ?? {};
    if (NIL_INSTANCE_ID in instances) return;
    byWidget[widget.id] = { ...root, $instances: { ...instances, [NIL_INSTANCE_ID]: {} } };
    await settings.save();
  } catch (err) {
    console.error("webpage widget: could not register default instance", err);
  }
}
```

In `main()`, call it right after `await persistRect();` and before `wireInteractions();`:
```ts
  await ensureDefaultInstanceRegistered();
```

If `settings.inner.byWidget[widget.id]` typing rejects the assignment, cast the assigned object `as (typeof byWidget)[string]` and record the change.

- [ ] **Step 3: Clarify the URL setting in `metadata.yml`**

Change the `url` description to:
```yaml
    description: Any http or https address that allows being embedded. Each instance can have its own URL; a new instance starts with the default instance's URL.
```

- [ ] **Step 4: Update the README `## Multiple instances` section**

Replace it with:
```markdown
## Multiple instances

The widget is declared with `instances: Multiple`. In Seelen Settings →
Widgets → Web Page, use the instance selector to add or remove windows; each
instance has its own settings and remembers its own placement. The original
window appears in the selector as "Instance 000000"; it is Seelen's default
instance and cannot be removed. A new instance starts with the default
instance's URL until you change it.
```

- [ ] **Step 5: Verify, load, and commit**

Run: `npm run typecheck && npm test && npm run load; echo exit=$?`
Expected: clean, 18 tests, exit 0. Then commit all four files:
```bash
git add index.css src/index.ts metadata.yml README.md
git commit -m "fix: lift host iframe size cap; register default instance so it stays editable

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Bundle and install permanently**

Run: `npm run bundle && rm -f "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml" && cp "$(ls -t dist/bundle*.yml | head -1)" "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml" && ls -la "$APPDATA/com.seelen.seelen-ui/widgets/" && grep -c NIL_INSTANCE_ID "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml"`
Expected: fresh bundle installed; grep ≥ 1. Do not restart Seelen UI.
