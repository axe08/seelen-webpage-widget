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

test("computeLayout combines the scrollbar allowance with a left offset", () => {
  const { frame } = computeLayout(800, 600, { ...base, hideScrollbar: true, regionLeft: 100 });
  assert.equal(frame.left, -100);
  assert.equal(frame.width, 800 + 100 + SCROLLBAR_PX);
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
