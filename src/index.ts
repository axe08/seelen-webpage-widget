import { Settings, Widget } from "@seelen-ui/lib";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
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
let autoReloadStarted = false;

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
  try {
    const size = await widget.window.innerSize();
    const scale = await widget.window.scaleFactor();
    const chromePx = size.height - Math.round(currentViewportH * scale);
    await widget.window.setSize(
      new PhysicalSize(size.width, chromePx + Math.round(desiredViewportH * scale)),
    );
  } catch (err) {
    console.error("webpage widget: auto height failed", err);
  }
}

// ---------- page loading ----------

async function loadPage(force: boolean): Promise<void> {
  const gen = ++loadGeneration;
  const url = current.url;
  if (url === "") {
    frame.src = "about:blank";
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
  } else if (hideTimer !== null) {
    scheduleHide();
  } else if (root.dataset.barVisible === "true" && !bar.matches(":hover")) {
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
  autoReloadStarted = true;
  cancelAutoReload();
  cancelAutoReload = startAutoReload(current.reloadMinutes, () => void loadPage(true));
}

async function applySettings(raw: Record<string, unknown>): Promise<void> {
  const next = normalizeSettings(raw);
  const urlChanged = next.url !== current.url;
  const reloadChanged = next.reloadMinutes !== current.reloadMinutes;
  current = next;
  applyBar();
  layoutFrame();
  if (!autoReloadStarted || reloadChanged) applyAutoReload();
  if (urlChanged || loadedUrl === "") await loadPage(false);
}

// ---------- per-instance position persistence ----------

const storageKey = (k: string): string => `webpage:${widget.decoded.instanceId ?? "single"}:${k}`;

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
    const widgetSettings = byWidget[widget.id] ?? { enabled: true };
    const instances = widgetSettings.$instances ?? {};
    if (NIL_INSTANCE_ID in instances) return;
    byWidget[widget.id] = { ...widgetSettings, $instances: { ...instances, [NIL_INSTANCE_ID]: {} } };
    await settings.save();
  } catch (err) {
    console.error("webpage widget: could not register default instance", err);
  }
}

function readStoredInt(k: string): number | null {
  try {
    const v = localStorage.getItem(storageKey(k));
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function storeInt(k: string, v: number): void {
  try {
    localStorage.setItem(storageKey(k), String(v));
  } catch (err) {
    console.warn("webpage widget: could not persist rect", err);
  }
}

async function restoreRect(): Promise<void> {
  try {
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
  } catch (err) {
    console.error("webpage widget: could not restore position", err);
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
      storeInt("x", e.payload.x);
      storeInt("y", e.payload.y);
    }, 500),
  );
  await widget.window.onResized(
    debounce((e: { payload: PhysicalSize }) => {
      storeInt("width", e.payload.width);
      storeInt("height", e.payload.height);
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
  await ensureDefaultInstanceRegistered();
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
