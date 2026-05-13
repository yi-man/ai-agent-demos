const DEFAULT_MAX_ATTEMPTS = Number(process.env.MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT || "10");
const DEFAULT_MIN_WAIT = 4000;
const DEFAULT_MAX_WAIT = 60000;

export async function retryFn(fn, { maxAttempts = DEFAULT_MAX_ATTEMPTS, minWait = DEFAULT_MIN_WAIT, maxWait = DEFAULT_MAX_WAIT, abortExceptions = [], logger } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (abortExceptions.some(Cls => e instanceof Cls)) throw e;
      if (attempt < maxAttempts) {
        const delay = Math.min(minWait * Math.pow(2, attempt - 1), maxWait);
        logger?.warn?.(`Attempt ${attempt} failed, retrying in ${delay}ms: ${e.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
