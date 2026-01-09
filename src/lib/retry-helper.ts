export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 5000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.status ?? error?.response?.status;
      const message = String(error?.message ?? "").toLowerCase();

      const isRateLimit =
        status === 429 ||
        message.includes("rate limit") ||
        message.includes("too many requests");

      if (!isRateLimit) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      const baseDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay + jitter;

      console.log(
        `Rate limited. Retrying in ${Math.round(delay / 1000)}s (${attempt + 1}/${maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

//batching
export async function processBatch<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => Promise<R>,
  delayMs = 1000
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  for (const item of items) {
    try {
      const result = await processor(item, index);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process item ${index + 1}:`, error);
    }

    if (index < items.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    index++;
  }

  return results;
}

