let lastCallTime = 0;
const MIN_DELAY_MS = 15_000; // 15 seconds

export async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY_MS - (now - lastCallTime));
  if (wait > 0) {
    await new Promise(res => setTimeout(res, wait));
  }
  lastCallTime = Date.now();
}
