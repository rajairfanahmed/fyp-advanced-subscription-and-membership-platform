export class RequestTimeoutError extends Error {
  constructor(
    message = "The service didn’t respond in time. Nothing was changed. Try again."
  ) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: string }).name) : "";
  return name === "AbortError";
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 15_000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new RequestTimeoutError();
    }
    signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      throw new RequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

export async function readJsonSafe<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}
