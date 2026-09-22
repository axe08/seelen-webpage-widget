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
