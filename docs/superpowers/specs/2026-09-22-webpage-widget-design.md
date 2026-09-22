# Seelen UI Web Page Widget — Design

Date: 2026-09-22
Status: approved in discussion, pending written review

## Purpose

A third-party widget for Seelen UI (installed version 2.8.6) that shows a
live, interactive web page on the Windows desktop. The first target is the
user's Glance dashboard (a self-hosted status page), but any URL that permits
framing works. The widget sits behind application windows like a Rainmeter
skin, remembers its position and size, and can be zoomed and cropped so a
chosen region of the page fills the widget.

## Decisions already made

| Question | Decision |
|---|---|
| Content selection | Any URL, plus zoom and crop offsets to frame a region |
| Placement | Seelen `Desktop` preset (behind windows, above wallpaper) |
| Interaction | Interactive: clicks and scrolling reach the page |
| Implementation | Plain `<iframe>`, vanilla TypeScript, bundled with esbuild |
| Resource id | `@axe08/webpage` (user's GitHub handle; change before publishing if desired) |

## Verified facts the design relies on

- Seelen third-party widgets are a folder with `metadata.yml` plus an HTML
  fragment, a JS file and a CSS file referenced by `!include`. The HTML is
  injected into `document.body`, the CSS into a `<style>`, and the JS as a
  `type="module"` script.
- Seelen's Tauri config sets no content security policy and the third-party
  host page has no CSP meta tag, so an iframe to a LAN/Tailscale URL loads.
- Glance's server sends neither `X-Frame-Options` nor `frame-ancestors`.
  Confirmed live against the user's Glance instance.
- All Seelen windows are granted `core:window:allow-start-dragging`,
  `core:window:allow-start-resize-dragging`, `allow-set-size`,
  `allow-set-position`, `allow-set-focusable`, and `shell:allow-open`.
- `Desktop` preset windows are created with `decorations(false)`,
  `always_on_bottom(true)`, `focusable(false)`, and remain resizable.
  The lib persists position and size to `localStorage` for this preset.
- `@seelen-ui/lib` (2.8.x) exposes `Widget.self.init()/ready()`,
  `Settings.getAsync()`, `settings.getCurrentWidgetConfig()`, and
  `Settings.onChange()`.
- The bundled CLI supports `slu resource load widget <dir>` for
  session-only loading and `slu resource bundle widget <dir>` for a
  distributable `.yaml`.
- Node 24.11 and esbuild 0.28 are installed on the development machine.

## Architecture

Single webview window, three visual layers, one settings source.

```
+-----------------------------------------------+
| drag bar: title · reload · open in browser    |  <- always or on hover
+-----------------------------------------------+
|                                               |
|   viewport (overflow hidden)                  |
|     iframe, scaled by zoom, offset by crop    |
|                                               |
|                                        [grip] |  <- resize handle
+-----------------------------------------------+
```

### Components

**`metadata.yml`** — resource manifest. Declares id, metadata, `preset:
Desktop`, `instances: Single`, the three `!include` sources, and the
settings list.

**`index.html`** — static markup: drag bar, hover hot-zone, viewport,
iframe, error overlay, resize grip. Plain global class names prefixed
`webpage-` so theme authors can target them.

**`index.css`** — layout and the two drag bar modes. Transparent body so
only the page and bar are visible.

**`src/index.ts`** — bootstrap and wiring:
1. `await Widget.self.init()` (Desktop preset restores last rect).
2. Load settings, render, subscribe to `Settings.onChange`.
3. Wire drag bar to `startDragging()`, grip to
   `startResizeDragging("SouthEast")`, reload button to iframe reload,
   open button to `shell.open(url)`.
4. `await Widget.self.ready()`.

**`src/frame.ts`** — pure functions, no DOM:
- `computeFrameRect(viewportW, viewportH, zoom, cropX, cropY)` returns the
  iframe's CSS `left`, `top`, `width`, `height`, and `scale` so that the
  page region starting at `(cropX, cropY)` in page pixels fills the
  viewport at the given zoom.
- `normalizeSettings(raw)` clamps and defaults every setting.

**`src/loader.ts`** — page availability:
- `probe(url)` does `fetch(url, { mode: "no-cors", cache: "no-store" })`;
  resolves on any response (opaque is fine), rejects on network failure.
- `startAutoReload(minutes, cb)` returns a cancel function.

### Data flow

```
Seelen settings app --(StateSettingsChanged)--> Settings.onChange
        -> normalizeSettings -> apply(): set iframe src if URL changed,
           recompute frame rect, toggle bar mode, restart auto-reload timer
ResizeObserver on viewport -> recompute frame rect
```

### Settings (declared in `metadata.yml`)

| key | type | default | notes |
|---|---|---|---|
| `url` | text | `http://localhost:8080` | any http(s) URL |
| `zoom` | range | 100 | 25–200 percent, step 5 |
| `cropX` | number | 0 | page pixels, min 0 |
| `cropY` | number | 0 | page pixels, min 0 |
| `reloadMinutes` | number | 0 | 0 = never, max 1440 |
| `barMode` | select | `hover` | `always` or `hover` |
| `barColor` | color | `#00000099` | allowAlpha |

### Interaction details

- **Drag bar.** In `always` mode it is a fixed 28 px strip. In `hover`
  mode a 6 px transparent hot-zone sits above the iframe; entering it shows
  the bar, leaving the bar hides it. Cross-origin iframes swallow pointer
  events, so all controls live outside the iframe.
- **Resize.** A 14 px grip in the bottom-right corner calls
  `startResizeDragging("SouthEast")`. The lib saves the new size.
- **Keyboard input.** Desktop windows are created non-focusable, so typing
  into the page does not work by default. On `pointerdown` anywhere in the
  widget the code calls `setFocusable(true)` once; this is best-effort and
  documented as a limitation if it proves unreliable.
- **Zoom and crop.** The iframe is laid out at
  `width = viewportW / zoom + cropX`, `height = viewportH / zoom + cropY`,
  positioned at `left = -cropX * zoom`, `top = -cropY * zoom`, with
  `transform: scale(zoom)` and `transform-origin: 0 0`. The viewport clips
  the rest.

### Error handling

- Before setting `iframe.src` and on every reload, run `probe(url)`. On
  failure show the overlay with the URL and a Retry button; on success hide
  it. Cross-origin iframes fire no error event, so the probe is the only
  reliable signal.
- Malformed URL from settings: overlay reads "Invalid URL" and the iframe
  stays blank.
- Auto-reload is skipped while the overlay is showing; Retry re-probes.

## Project layout

```
seelen-webpage-widget/
├── metadata.yml
├── index.html
├── index.css
├── src/
│   ├── index.ts
│   ├── frame.ts
│   ├── frame.test.ts
│   ├── loader.ts
│   └── loader.test.ts
├── scripts/
│   └── build.mjs          # esbuild bundle + copy manifest/html/css to dist/
├── dist/                  # build output; loaded by slu (git-ignored)
├── package.json
├── tsconfig.json
├── README.md
└── docs/superpowers/specs/
```

## Build, load, distribute

- `npm run build` bundles `src/index.ts` to `dist/index.js` (ESM, minify
  off for debuggability) and copies `metadata.yml`, `index.html`,
  `index.css` into `dist/`.
- `npm run load` runs the Seelen CLI to load `dist/` for the current session;
  the widget then appears in Seelen's settings to enable.
- `npm run bundle` runs the Seelen CLI bundler to produce a single `.yaml`
  for permanent install into the Seelen widgets folder or marketplace upload.
- `npm test` runs `node --test` over `src/*.test.ts` using Node's native
  TypeScript stripping.

## Testing

- **Unit:** `computeFrameRect` (zoom 1 no crop; zoom 2 with crop; zoom
  below 1), `normalizeSettings` (clamping, defaults, bad types), and
  `startAutoReload` (zero disables, cancel stops the timer).
- **Manual, against live Glance:** load, enable, confirm page renders and
  is clickable; drag and resize; restart Seelen and confirm position and
  size persist; change each setting and confirm live update; unplug from
  the network and confirm the error overlay and Retry.

## Out of scope

- Multiple instances (can be enabled later by changing `instances`).
- Per-monitor settings.
- Authenticated pages requiring cookies.
- Marketplace publication assets (portrait, banner, screenshots).
