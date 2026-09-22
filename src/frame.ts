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
      // + 0 normalises -0 (Math.round of a negative zero) to 0
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
