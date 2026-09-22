# Seelen Web Page Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Seelen UI third-party widget that shows a live, interactive web page (default: the user's Glance dashboard) on the Windows desktop with zoom, crop, drag, resize and live settings.

**Architecture:** One Seelen `Desktop`-preset webview window whose body holds a drag bar, a clipped viewport containing a scaled and offset `<iframe>`, an error overlay and a resize grip. Pure functions in `src/frame.ts` and `src/loader.ts` hold all logic that can be unit tested; `src/index.ts` only wires DOM, Seelen settings and Tauri window calls together. esbuild bundles everything into a single `dist/index.js` that the Seelen loader injects.

**Tech Stack:** TypeScript 5, esbuild 0.28, `@seelen-ui/lib` 2.8.4, `@tauri-apps/api` 2.11, Node 24 built-in test runner (`node --test`, native TypeScript stripping), Seelen UI 2.8.6 CLI (`slu.exe`).

**Spec:** `docs/superpowers/specs/2026-09-22-webpage-widget-design.md`

## Global Constraints

- Resource id is `@axe08/webpage`; folder name is `seelen-webpage-widget`.
- Widget preset is `Desktop`, instances `Single`.
- All HTML/CSS class names are plain, global, and prefixed `webpage-`.
- Default URL is `http://localhost:8080`.
- Settings keys are exactly: `url`, `zoom`, `cropX`, `cropY`, `reloadMinutes`, `barMode`, `barColor`.
- `zoom` is a percentage in settings (25–200, step 5, default 100); internally it is a factor (`0.25`–`2`).
- Tests run with `node --test` and import `.ts` files directly (Node 24 strips types natively). No test framework dependency.
- `dist/` is git-ignored; `node_modules/` is git-ignored.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- The Seelen CLI lives at `C:\Program Files\Seelen\Seelen UI\slu.exe`. Seelen UI must be running for `resource load`.
- Node 24 and npm 11 are installed. Bash tool is Git Bash; quote paths with spaces.

---

### Task 1: Project scaffold and build pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `scripts/build.mjs`
- Create: `src/index.ts` (placeholder that proves bundling works; replaced in Task 5)
- Create: `metadata.yml` (minimal; settings added in Task 4)
- Create: `index.html` (minimal; full markup in Task 5)
- Create: `index.css` (minimal; full styles in Task 5)

**Interfaces:**
- Produces: `npm run build` → `dist/{metadata.yml,index.html,index.css,index.js}`; `npm test` → runs `src/**/*.test.ts`; `npm run load` → loads `dist/` into the running Seelen UI; `npm run bundle` → produces `dist/export_<date>.yml`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "seelen-webpage-widget",
  "version": "0.1.0",
  "private": true,
  "description": "Seelen UI widget that shows a live web page on the desktop",
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test src/",
    "typecheck": "tsc --noEmit",
    "load": "npm run build && \"C:/Program Files/Seelen/Seelen UI/slu.exe\" resource load widget dist",
    "bundle": "npm run build && \"C:/Program Files/Seelen/Seelen UI/slu.exe\" resource bundle widget dist"
  },
  "devDependencies": {
    "@seelen-ui/lib": "2.8.4",
    "@tauri-apps/api": "^2.11.1",
    "@types/node": "^24.0.0",
    "esbuild": "^0.28.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.mjs"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Create `scripts/build.mjs`**

```js
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [resolve(root, "src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: resolve(dist, "index.js"),
  sourcemap: "inline",
  minify: false,
  logLevel: "info",
});

for (const name of ["metadata.yml", "index.html", "index.css"]) {
  cpSync(resolve(root, name), resolve(dist, name));
}

console.log("build complete ->", dist);
```

- [ ] **Step 5: Create placeholder `src/index.ts`**

```ts
import { Widget } from "@seelen-ui/lib";

const widget = Widget.self;
await widget.init();
document.body.textContent = "webpage widget scaffold";
await widget.ready();
```

- [ ] **Step 6: Create minimal `metadata.yml`**

```yaml
id: "@axe08/webpage"
icon: PiGlobeHemisphereWest
metadata:
  displayName: Web Page
  description: Shows a live web page on your desktop, such as a homelab dashboard.
  tags: [web, dashboard, iframe, homelab]
preset: Desktop
instances: Single
lazy: false
html: !include index.html
js: !include index.js
css: !include index.css
settings: []
```

Note: `js: !include index.js` refers to the bundled file that lives next to `metadata.yml` inside `dist/`. The source is `src/index.ts`; the build script copies the manifest into `dist/` where `index.js` is emitted.

- [ ] **Step 7: Create minimal `index.html` and `index.css`**

`index.html`:
```html
<div class="webpage-root"></div>
```

`index.css`:
```css
.webpage-root { width: 100%; height: 100%; }
```

- [ ] **Step 8: Install dependencies and build**

Run (from `B:\VibeCode\seelen-webpage-widget`):
```bash
npm install && npm run build && ls dist
```
Expected: `index.css  index.html  index.js  metadata.yml`, and `index.js` is larger than 10 KB (the Seelen lib is bundled in).

- [ ] **Step 9: Verify the test runner works with an empty suite**

Run: `npm test`
Expected: exits 0 with `# tests 0` (no test files yet is fine; if `node --test src/` errors because the directory has no test files, create `src/smoke.test.ts` containing `import test from "node:test"; test("smoke", () => {});` and re-run, then delete it in Task 2).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore scripts/build.mjs src/index.ts metadata.yml index.html index.css
git commit -m "chore: scaffold widget project with esbuild build pipeline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Frame geometry and settings normalisation (`src/frame.ts`)

**Files:**
- Create: `src/frame.ts`
- Test: `src/frame.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FrameRect { left: number; top: number; width: number; height: number; scale: number; }
  export function computeFrameRect(viewportW: number, viewportH: number, zoom: number, cropX: number, cropY: number): FrameRect;

  export type BarMode = "always" | "hover";
  export interface WidgetSettings {
    url: string;            // trimmed; "" if invalid
    zoom: number;           // factor, clamped 0.25..2
    cropX: number;          // >= 0, integer
    cropY: number;          // >= 0, integer
    reloadMinutes: number;  // 0..1440, integer, 0 = never
    barMode: BarMode;
    barColor: string;       // CSS colour string
  }
  export const DEFAULT_SETTINGS: WidgetSettings;
  export function normalizeSettings(raw: Record<string, unknown>): WidgetSettings;
  ```
- Math: `scale = zoom`; `left = -cropX * zoom`; `top = -cropY * zoom`; `width = viewportW / zoom + cropX`; `height = viewportH / zoom + cropY`. Widths/heights are rounded up to whole pixels; left/top rounded to whole pixels.

- [ ] **Step 1: Write the failing tests**

`src/frame.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { computeFrameRect, normalizeSettings, DEFAULT_SETTINGS } from "./frame.ts";

test("computeFrameRect at zoom 1 with no crop fills the viewport exactly", () => {
  const r = computeFrameRect(800, 600, 1, 0, 0);
  assert.deepEqual(r, { left: 0, top: 0, width: 800, height: 600, scale: 1 });
});

test("computeFrameRect at zoom 2 with crop offsets shifts and enlarges the iframe", () => {
  const r = computeFrameRect(800, 600, 2, 100, 50);
  assert.deepEqual(r, { left: -200, top: -100, width: 500, height: 350, scale: 2 });
});

test("computeFrameRect at zoom 0.5 lays the iframe out at double size", () => {
  const r = computeFrameRect(800, 600, 0.5, 0, 0);
  assert.deepEqual(r, { left: 0, top: 0, width: 1600, height: 1200, scale: 0.5 });
});

test("computeFrameRect rounds fractional sizes up to whole pixels", () => {
  const r = computeFrameRect(801, 601, 0.75, 0, 0);
  assert.equal(r.width, Math.ceil(801 / 0.75));
  assert.equal(r.height, Math.ceil(601 / 0.75));
});

test("normalizeSettings returns defaults for an empty object", () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.url, "http://localhost:8080");
  assert.equal(DEFAULT_SETTINGS.zoom, 1);
  assert.equal(DEFAULT_SETTINGS.barMode, "hover");
});

test("normalizeSettings converts zoom percent to a clamped factor", () => {
  assert.equal(normalizeSettings({ zoom: 150 }).zoom, 1.5);
  assert.equal(normalizeSettings({ zoom: 10 }).zoom, 0.25);
  assert.equal(normalizeSettings({ zoom: 999 }).zoom, 2);
  assert.equal(normalizeSettings({ zoom: "abc" }).zoom, 1);
});

test("normalizeSettings clamps crop offsets and reload minutes to integers in range", () => {
  const s = normalizeSettings({ cropX: -5, cropY: 12.7, reloadMinutes: 5000 });
  assert.equal(s.cropX, 0);
  assert.equal(s.cropY, 12);
  assert.equal(s.reloadMinutes, 1440);
  assert.equal(normalizeSettings({ reloadMinutes: -1 }).reloadMinutes, 0);
});

test("normalizeSettings trims the url and blanks anything that is not http(s)", () => {
  assert.equal(normalizeSettings({ url: "  http://a.local/x  " }).url, "http://a.local/x");
  assert.equal(normalizeSettings({ url: "ftp://a.local" }).url, "");
  assert.equal(normalizeSettings({ url: "not a url" }).url, "");
  assert.equal(normalizeSettings({ url: 42 }).url, "");
});

test("normalizeSettings only accepts known bar modes and non-empty colours", () => {
  assert.equal(normalizeSettings({ barMode: "always" }).barMode, "always");
  assert.equal(normalizeSettings({ barMode: "sideways" }).barMode, "hover");
  assert.equal(normalizeSettings({ barColor: "" }).barColor, DEFAULT_SETTINGS.barColor);
  assert.equal(normalizeSettings({ barColor: "#ff000080" }).barColor, "#ff000080");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, with an error that `./frame.ts` cannot be found.

- [ ] **Step 3: Implement `src/frame.ts`**

```ts
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Lays out the iframe so that the page region starting at (cropX, cropY)
 * page-pixels fills a viewport of viewportW x viewportH at the given zoom.
 * The iframe is positioned inside a clipping container, scaled from its
 * top-left corner.
 */
export function computeFrameRect(
  viewportW: number,
  viewportH: number,
  zoom: number,
  cropX: number,
  cropY: number,
): FrameRect {
  return {
    left: Math.round(-cropX * zoom),
    top: Math.round(-cropY * zoom),
    width: Math.ceil(viewportW / zoom + cropX),
    height: Math.ceil(viewportH / zoom + cropY),
    scale: zoom,
  };
}

export type BarMode = "always" | "hover";

export interface WidgetSettings {
  url: string;
  zoom: number;
  cropX: number;
  cropY: number;
  reloadMinutes: number;
  barMode: BarMode;
  barColor: string;
}

export const DEFAULT_SETTINGS: WidgetSettings = {
  url: "http://localhost:8080",
  zoom: 1,
  cropX: 0,
  cropY: 0,
  reloadMinutes: 0,
  barMode: "hover",
  barColor: "#00000099",
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const RELOAD_MAX_MINUTES = 1440;

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
  const factor = n / 100;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor));
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
    cropX: clampInt(raw.cropX, 0, Number.MAX_SAFE_INTEGER, 0),
    cropY: clampInt(raw.cropY, 0, Number.MAX_SAFE_INTEGER, 0),
    reloadMinutes: clampInt(raw.reloadMinutes, 0, RELOAD_MAX_MINUTES, 0),
    barMode,
    barColor,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all 9 tests PASS. If `normalizeSettings({})` fails the defaults test, check that absent keys fall back to `DEFAULT_SETTINGS` (the `"url" in raw` guards) rather than to `""`.

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/frame.ts src/frame.test.ts
git commit -m "feat: add frame geometry and settings normalisation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Reachability probe and auto-reload timer (`src/loader.ts`)

**Files:**
- Create: `src/loader.ts`
- Test: `src/loader.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type FetchLike = (input: string, init?: RequestInit) => Promise<unknown>;
  export function probe(url: string, fetchImpl?: FetchLike, timeoutMs?: number): Promise<boolean>;
  export function startAutoReload(minutes: number, cb: () => void, setIntervalImpl?: typeof setInterval, clearIntervalImpl?: typeof clearInterval): () => void;
  ```
- `probe` resolves `true` if `fetchImpl` resolves (an opaque no-cors response counts), `false` if it rejects or exceeds `timeoutMs` (default 8000).
- `startAutoReload` returns a cancel function. `minutes <= 0` never schedules and returns a no-op cancel.

- [ ] **Step 1: Write the failing tests**

`src/loader.test.ts`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { probe, startAutoReload } from "./loader.ts";

test("probe resolves true when fetch resolves", async () => {
  const ok = await probe("http://x.local", async () => ({ type: "opaque" }));
  assert.equal(ok, true);
});

test("probe resolves false when fetch rejects", async () => {
  const ok = await probe("http://x.local", async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(ok, false);
});

test("probe passes no-cors and no-store options to fetch", async () => {
  let seen: RequestInit | undefined;
  await probe("http://x.local", async (_url, init) => {
    seen = init;
    return {};
  });
  assert.equal(seen?.mode, "no-cors");
  assert.equal(seen?.cache, "no-store");
  assert.ok(seen?.signal instanceof AbortSignal);
});

test("probe resolves false when fetch never settles before the timeout", async () => {
  const ok = await probe("http://x.local", () => new Promise(() => {}), 20);
  assert.equal(ok, false);
});

test("startAutoReload with zero minutes never schedules", () => {
  let scheduled = 0;
  const cancel = startAutoReload(0, () => {}, ((() => { scheduled++; return 1; }) as unknown) as typeof setInterval);
  assert.equal(scheduled, 0);
  cancel();
});

test("startAutoReload schedules minutes*60000 ms and cancel clears it", () => {
  let intervalMs = -1;
  let cleared: unknown = null;
  const fakeSet = ((_cb: () => void, ms: number) => { intervalMs = ms; return 42; }) as unknown as typeof setInterval;
  const fakeClear = ((id: unknown) => { cleared = id; }) as unknown as typeof clearInterval;
  const cancel = startAutoReload(5, () => {}, fakeSet, fakeClear);
  assert.equal(intervalMs, 5 * 60_000);
  cancel();
  assert.equal(cleared, 42);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL because `./loader.ts` cannot be found (the Task 2 tests still pass).

- [ ] **Step 3: Implement `src/loader.ts`**

```ts
export type FetchLike = (input: string, init?: RequestInit) => Promise<unknown>;

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Checks whether a URL is reachable. Uses a no-cors request so that any
 * response, including an opaque cross-origin one, counts as success. A
 * network failure or a timeout resolves false. Never throws.
 */
export async function probe(
  url: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await Promise.race([
      fetchImpl(url, { mode: "no-cors", cache: "no-store", signal: controller.signal }),
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("probe timeout")), { once: true });
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls cb every `minutes` minutes. Returns a cancel function.
 * `minutes <= 0` disables auto reload.
 */
export function startAutoReload(
  minutes: number,
  cb: () => void,
  setIntervalImpl: typeof setInterval = setInterval,
  clearIntervalImpl: typeof clearInterval = clearInterval,
): () => void {
  if (!(minutes > 0)) return () => {};
  const id = setIntervalImpl(cb, minutes * 60_000);
  return () => clearIntervalImpl(id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all 15 tests PASS.

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: no errors. If `setIntervalImpl` typing complains about Node vs DOM overloads, keep `typeof setInterval` and cast at the call site only in tests (as the tests already do).

- [ ] **Step 6: Commit**

```bash
git add src/loader.ts src/loader.test.ts
git commit -m "feat: add reachability probe and auto-reload timer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Widget manifest with settings declarations

**Files:**
- Modify: `metadata.yml` (replace the `settings: []` line with the full list)

**Interfaces:**
- Produces: settings keys `url`, `zoom`, `cropX`, `cropY`, `reloadMinutes`, `barMode`, `barColor` in the merged config returned by `Settings.getCurrentWidgetConfig()`. Setting type names in YAML are lowercase: `text`, `range`, `number`, `select`, `color`.

- [ ] **Step 1: Replace the settings block in `metadata.yml`**

Full file after the edit:
```yaml
id: "@axe08/webpage"
icon: PiGlobeHemisphereWest
metadata:
  displayName: Web Page
  description: Shows a live web page on your desktop, such as a homelab dashboard.
  tags: [web, dashboard, iframe, homelab]
preset: Desktop
instances: Single
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
          min: 25
          max: 200
          step: 5
          defaultValue: 100

        - type: number
          key: cropX
          label: Crop from left (px)
          description: Page pixels hidden on the left, before zoom is applied.
          min: 0
          defaultValue: 0

        - type: number
          key: cropY
          label: Crop from top (px)
          description: Page pixels hidden at the top, before zoom is applied.
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

        - type: color
          key: barColor
          label: Drag bar colour
          allowAlpha: true
          defaultValue: "#00000099"
```

- [ ] **Step 2: Build and load into the running Seelen UI**

Run: `npm run load`
Expected: the CLI exits 0 with no parse error. Open Seelen Settings → Widgets; "Web Page" appears with a settings page showing URL, View and Behaviour groups. If the CLI reports a YAML deserialisation error naming a field, compare the field against the bundled manifests in `C:\Program Files\Seelen\Seelen UI\static\widgets\flyouts\metadata.yml` (which uses `select`, `number`, `switch` and `group.items`).

- [ ] **Step 3: Commit**

```bash
git add metadata.yml
git commit -m "feat: declare widget settings in manifest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Markup, styles and the widget runtime (`src/index.ts`)

**Files:**
- Modify: `index.html` (replace)
- Modify: `index.css` (replace)
- Modify: `src/index.ts` (replace placeholder)

**Interfaces:**
- Consumes: `computeFrameRect`, `normalizeSettings`, `WidgetSettings` from `./frame.ts`; `probe`, `startAutoReload` from `./loader.ts`; `Widget`, `Settings`, `invoke`, `SeelenCommand` from `@seelen-ui/lib`.
- DOM contract (class names used by `src/index.ts`): `.webpage-root`, `.webpage-hotzone`, `.webpage-bar`, `.webpage-bar-title`, `.webpage-bar-reload`, `.webpage-bar-open`, `.webpage-viewport`, `.webpage-frame`, `.webpage-error`, `.webpage-error-text`, `.webpage-error-retry`, `.webpage-grip`. Root carries `data-bar-mode="hover"|"always"` and `data-bar-visible="true"|"false"`.

- [ ] **Step 1: Write `index.html`**

```html
<div class="webpage-root" data-bar-mode="hover" data-bar-visible="false">
  <div class="webpage-hotzone" aria-hidden="true"></div>
  <div class="webpage-bar" data-tauri-drag-region>
    <span class="webpage-bar-title">Web Page</span>
    <button class="webpage-bar-reload" type="button" title="Reload">&#x21bb;</button>
    <button class="webpage-bar-open" type="button" title="Open in browser">&#x2197;</button>
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

- [ ] **Step 2: Write `index.css`**

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

- [ ] **Step 3: Write `src/index.ts`**

```ts
import { invoke, SeelenCommand, Settings, Widget } from "@seelen-ui/lib";
import { computeFrameRect, normalizeSettings, type WidgetSettings } from "./frame.ts";
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
const openBtn = $<HTMLButtonElement>(".webpage-bar-open");
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
let focusRequested = false;

function showError(message: string): void {
  errorText.textContent = message;
  errorBox.hidden = false;
}

function hideError(): void {
  errorBox.hidden = true;
}

function layoutFrame(): void {
  const { width: vw, height: vh } = viewport.getBoundingClientRect();
  if (vw === 0 || vh === 0) return;
  const r = computeFrameRect(vw, vh, current.zoom, current.cropX, current.cropY);
  frame.style.left = `${r.left}px`;
  frame.style.top = `${r.top}px`;
  frame.style.width = `${r.width}px`;
  frame.style.height = `${r.height}px`;
  frame.style.transform = `scale(${r.scale})`;
}

async function loadPage(force: boolean): Promise<void> {
  const url = current.url;
  if (url === "") {
    frame.removeAttribute("src");
    loadedUrl = "";
    showError("Invalid URL. Set a valid http(s) address in the widget settings.");
    return;
  }
  const reachable = await probe(url);
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

function applyBar(): void {
  root.dataset.barMode = current.barMode;
  root.style.setProperty("--webpage-bar-color", current.barColor);
  if (current.barMode === "always") root.dataset.barVisible = "true";
  else root.dataset.barVisible = "false";
  try {
    title.textContent = current.url === "" ? "Web Page" : new URL(current.url).host;
  } catch {
    title.textContent = "Web Page";
  }
}

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

function wireInteractions(): void {
  // Drag: the bar has data-tauri-drag-region, but we also call the API
  // explicitly so buttons inside the bar do not start a drag.
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
    if (current.barMode === "hover") root.dataset.barVisible = "true";
  });
  bar.addEventListener("mouseleave", () => {
    if (current.barMode === "hover") root.dataset.barVisible = "false";
  });

  reloadBtn.addEventListener("click", () => void loadPage(true));
  retryBtn.addEventListener("click", () => void loadPage(true));
  openBtn.addEventListener("click", () => {
    if (current.url !== "") void invoke(SeelenCommand.OpenFile, { path: current.url });
  });

  // Desktop widgets are created non-focusable; request focus once so typing
  // inside the page works. Best effort.
  root.addEventListener("pointerdown", () => {
    if (focusRequested) return;
    focusRequested = true;
    widget.window.setFocusable(true).catch(() => {});
  });

  new ResizeObserver(() => layoutFrame()).observe(viewport);
}

async function main(): Promise<void> {
  await widget.init({ useThemes: false });
  wireInteractions();
  const settings = await Settings.getAsync();
  await applySettings(settings.getCurrentWidgetConfig() as Record<string, unknown>);
  await Settings.onChange((s) => {
    void applySettings(s.getCurrentWidgetConfig() as Record<string, unknown>);
  });
  await widget.ready();
  layoutFrame();
}

main().catch((err) => {
  console.error("webpage widget failed to start", err);
  showError("Widget failed to start. Open DevTools (Ctrl+Shift+I) for details.");
});
```

- [ ] **Step 4: Type-check and run unit tests**

Run: `npm run typecheck && npm test`
Expected: no type errors; all 15 tests PASS. If `widget.window.startResizeDragging` is flagged, confirm `@tauri-apps/api` is 2.11 or newer (`npm ls @tauri-apps/api`).

- [ ] **Step 5: Build and load into the running Seelen UI**

Run: `npm run load`
Expected: CLI exits 0. In Seelen Settings → Widgets enable "Web Page". A window appears on the desktop, behind other windows, showing the Glance home page. If the window is blank with no overlay, focus it and press Ctrl+Shift+I to open DevTools and check the console.

- [ ] **Step 6: Manual verification checklist (record results in the commit body)**

Perform each and note pass/fail:
1. Glance page renders and links inside it respond to clicks; mouse wheel scrolls the page.
2. Hover the top edge: the bar slides in showing the host `localhost:8080`; move away: it hides.
3. Drag the bar: the window moves. Drag the bottom-right grip: the window resizes and the page relays out.
4. Settings → Zoom 150: the page enlarges live. Crop from left 200: the page shifts left live. Restore defaults.
5. Settings → Drag bar "Always visible": bar is pinned; colour change applies.
6. Reload button reloads the page. Open-in-browser opens the URL in the default browser.
7. Set URL to a page that forbids framing (one that sends X-Frame-Options) and confirm the iframe shows the browser's refusal page rather than the widget crashing; set URL to `http://nonexistent.local` and confirm the "Cannot reach" overlay and that Retry re-probes. Restore the Glance URL.
8. Quit and relaunch Seelen UI (tray icon → Quit, then start from Start menu): the widget returns at the same position and size.

- [ ] **Step 7: Commit**

```bash
git add index.html index.css src/index.ts
git commit -m "feat: web page widget runtime with drag, resize, zoom, crop and live settings

Manual verification against the user's Glance instance:
- render/interaction: <pass|fail>
- hover bar: <pass|fail>
- drag/resize: <pass|fail>
- live zoom/crop: <pass|fail>
- bar mode/colour: <pass|fail>
- reload/open: <pass|fail>
- error overlay + retry: <pass|fail>
- persistence across restart: <pass|fail>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Replace each `<pass|fail>` with the observed result. Any `fail` must be fixed before the commit, or explicitly documented in the README's Known issues section (Task 6) if it is the focus limitation the spec already allows.

---

### Task 6: README and distributable bundle

**Files:**
- Create: `README.md`
- Verify: `dist/export_<date>.yml` produced by `npm run bundle` (not committed)

**Interfaces:**
- Consumes: scripts from Task 1.

- [ ] **Step 1: Write `README.md`**

```markdown
# Seelen Web Page Widget

A [Seelen UI](https://seelen.io) desktop widget that shows a live, interactive
web page on your desktop. Built for a homelab dashboard (Glance) but works with
any page that allows being embedded in an iframe.

Resource id: `@axe08/webpage`

## Features

- Sits on the desktop behind your windows; position and size are remembered.
- Zoom (25–200 %) and crop offsets to frame one region of a page.
- Drag bar (always visible or reveal on hover) with reload and open-in-browser.
- Corner grip to resize.
- Optional auto reload interval.
- Reachability check with a retry overlay when the page is down.

## Requirements

- Seelen UI 2.8.6 or newer.
- For development: Node 24+ and npm.

## Install (end user)

1. Download or build `export_<date>.yml` (see Build below).
2. Copy it into `%APPDATA%\com.seelen.seelen-ui\widgets\`.
3. Restart Seelen UI, open Settings → Widgets, enable **Web Page**, set the URL.

## Build and develop

```bash
npm install
npm test          # unit tests (node --test)
npm run build     # bundles to dist/
npm run load      # build + load into the running Seelen UI for this session
npm run bundle    # build + produce dist/export_<date>.yml for distribution
```

`npm run load` registers the widget only for the current Seelen session; it
disappears after Seelen restarts. Use the bundle for a permanent install.

Press Ctrl+Shift+I with the widget focused to open DevTools.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Page URL | `http://localhost:8080` | http or https |
| Zoom (%) | 100 | 25–200 |
| Crop from left / top (px) | 0 | page pixels hidden before zoom |
| Auto reload every (minutes) | 0 | 0 = never |
| Drag bar | Show on hover | or Always visible |
| Drag bar colour | `#00000099` | alpha supported |

## Pages that refuse to embed

If the page shows a browser refusal message, the site sends
`X-Frame-Options` or a `frame-ancestors` policy. Glance does not. Some apps
(qBittorrent, Portainer, Uptime Kuma admin) do. Put such apps behind a reverse
proxy that strips those headers, or embed a page that permits framing.

## Known issues

- Desktop widgets are created non-focusable. The widget asks for focus on the
  first click so typing into the page works; if keyboard input does not reach
  the page, click the widget once more.

## Layout

```
metadata.yml     resource manifest and settings declarations
index.html       widget markup (body fragment)
index.css        widget styles
src/index.ts     runtime: wires DOM, Seelen settings and Tauri window calls
src/frame.ts     pure geometry + settings normalisation (unit tested)
src/loader.ts    reachability probe + auto reload timer (unit tested)
scripts/build.mjs esbuild bundle to dist/
```
```

- [ ] **Step 2: Produce the distributable bundle**

Run: `npm run bundle && ls dist`
Expected: an `export_<date>.yml` file appears in `dist/`. Open it and confirm it starts with the resource id and inlines the html, js and css.

- [ ] **Step 3: Install the bundle permanently and verify**

Run:
```bash
cp dist/export_*.yml "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml"
```
Then quit and relaunch Seelen UI. Expected: "Web Page" is still listed in Settings → Widgets and still enabled with the saved settings, without running `npm run load`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with install, build and settings reference

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- Purpose and placement (Desktop preset, behind windows, persistent rect): Task 1 manifest + Task 5 `widget.init()`.
- Any URL plus zoom and crop: Task 2 math, Task 4 settings, Task 5 `layoutFrame`.
- Interactive iframe; controls outside the iframe: Task 5 markup.
- Drag bar modes, reload, open in browser: Task 5.
- Resize grip: Task 5 (`startResizeDragging`).
- Live settings via `Settings.onChange`: Task 5 `main()`.
- Error overlay with probe and retry; invalid URL message; auto reload paused while errored: Task 3 + Task 5 `loadPage`/`applyAutoReload`.
- Keyboard focus best effort: Task 5 `pointerdown` handler; documented in Task 6 README.
- Build, load, bundle, test commands: Task 1 scripts; Task 6 README.
- Unit tests for frame math, normalisation, auto reload: Tasks 2 and 3. Manual test list: Task 5 Step 6.
- Out of scope items are not implemented anywhere.
