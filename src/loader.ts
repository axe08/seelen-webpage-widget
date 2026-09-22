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
