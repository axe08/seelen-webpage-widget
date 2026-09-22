# Seelen Web Page Widget

A [Seelen UI](https://seelen.io) desktop widget that shows a live, interactive
web page on your desktop. Built for a homelab dashboard (Glance) but works with
any page that allows being embedded in an iframe.

Resource id: `@axe08/webpage`

## Features

- Sits on the desktop behind your windows; each instance remembers its own position and size.
- Multiple instances, each with its own URL and settings.
- Page region cropping: left, top, width and height in page pixels. Width scales the region to fill the widget; height sizes the widget to fit.
- Zoom (25–200 %) when no region width is set.
- Hide the page's scrollbar (wheel scrolling still works).
- Drag bar (always visible or reveal on hover, with a configurable hide delay) with a reload button.
- Corner grip to resize.
- Optional auto reload interval.
- Reachability check with a retry overlay when the page is down.

## Requirements

- Seelen UI 2.8.6 or newer.
- For development: Node 24+ and npm.

## Install (end user)

1. Download or build `bundle <date> <time>.yml` (see Build below).
2. Copy it into `%APPDATA%\com.seelen.seelen-ui\widgets\`:
   ```bash
   cp "$(ls -t dist/bundle*.yml | head -1)" "$APPDATA/com.seelen.seelen-ui/widgets/webpage.yml"
   ```
3. Restart Seelen UI, open Settings → Widgets, enable **Web Page**, set the URL.

## Build and develop

```bash
npm install
npm test          # unit tests (node --test)
npm run typecheck # TypeScript check
npm run build     # bundles to dist/
npm run load      # build + load into the running Seelen UI for this session
npm run bundle    # build + produce dist/bundle <date> <time>.yml for distribution
```

`npm run load` registers the widget only for the current Seelen session; it
disappears after Seelen restarts. Use the bundle for a permanent install.

Press Ctrl+Shift+I with the widget focused to open DevTools.

## Settings

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

## Multiple instances

The widget is declared with `instances: Multiple`. In Seelen Settings →
Widgets → Web Page, use the instance selector to add or remove windows; each
instance has its own settings and remembers its own placement. The original
window appears in the selector as "Instance 000000"; it is Seelen's default
instance — deleting it only makes it reappear on the next launch. New
instances start with the default instance's URL; once you edit the default
instance, its own edits live with it.

## Pages that refuse to embed

If the page shows a browser refusal message, the site sends
`X-Frame-Options` or a `frame-ancestors` policy. Glance does not. Some apps
(qBittorrent, Portainer, Uptime Kuma admin) do. Put such apps behind a reverse
proxy that strips those headers, or embed a page that permits framing.

## Known issues

- Desktop widgets are created non-focusable. The widget asks for focus on the
  first click so typing into the page works; if keyboard input does not reach
  the page, click the widget once more.
- The scrollbar cannot be recoloured: it belongs to the embedded page. "Hide page scrollbar" clips it instead.
- Seelen themes are deliberately not applied to this widget (it renders someone else's page), so theme authors cannot restyle the bar.

## Layout

```
metadata.yml       resource manifest and settings declarations
index.html         widget markup (body fragment)
index.css          widget styles
src/index.ts       runtime: wires DOM, Seelen settings and Tauri window calls
src/frame.ts       pure geometry + settings normalisation (unit tested)
src/loader.ts      reachability probe + auto reload timer (unit tested)
scripts/build.mjs  esbuild bundle to dist/
scripts/slu.mjs    resolves the absolute dist path and invokes the Seelen CLI
```

## License

MIT. See [LICENSE](LICENSE).
