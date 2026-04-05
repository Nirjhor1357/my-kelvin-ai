export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(work: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 3000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < options.retries && (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!canRetry) {
        break;
      }

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      await delay(backoff);
    }
  }

  throw lastError;
}
