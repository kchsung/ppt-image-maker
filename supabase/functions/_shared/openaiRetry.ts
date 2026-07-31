export const DEFAULT_PPT_PLAN_MODEL = 'gpt-5';

const MAX_RETRY_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Retries only upstream transport and rate-limit responses. The response body
 * stays untouched for the caller, except on attempts that are discarded.
 */
export async function fetchOpenAiWithRetry(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!isTransientStatus(response.status) || attempt === MAX_RETRY_ATTEMPTS - 1) {
        return response;
      }

      await wait(getRetryDelayMs(response, attempt));
    } catch (error) {
      lastNetworkError = error;
      if (attempt === MAX_RETRY_ATTEMPTS - 1) {
        throw error;
      }

      await wait(getExponentialDelayMs(attempt));
    }
  }

  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error('OpenAI request failed after retry attempts.');
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function getRetryDelayMs(response: Response, attempt: number): Promise<number> {
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return clampDelay(Math.ceil(retryAfterSeconds * 1_000));
  }

  const body = await response.clone().text();
  const messageMatch = body.match(/(?:try again in|retry after)\s*(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/iu);
  if (messageMatch) {
    return clampDelay(Math.ceil(Number(messageMatch[1]) * 1_000));
  }

  return getExponentialDelayMs(attempt);
}

function getExponentialDelayMs(attempt: number): number {
  return clampDelay(1_000 * 2 ** attempt + Math.floor(Math.random() * 500));
}

function clampDelay(delayMs: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(250, delayMs));
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
