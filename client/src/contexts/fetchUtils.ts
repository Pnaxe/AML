const DEFAULT_RETRY_DELAY_MS = 400
const DEFAULT_TIMEOUT_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    cancel: () => window.clearTimeout(timeoutId),
  }
}

function mergeSignals(signals: Array<AbortSignal | undefined>) {
  const activeSignals = signals.filter(Boolean) as AbortSignal[]
  if (!activeSignals.length) {
    return undefined
  }

  const controller = new AbortController()
  const abort = () => controller.abort()

  for (const signal of activeSignals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 1,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeout = timeoutSignal(timeoutMs)
    try {
      const response = await fetch(input, {
        ...init,
        signal: mergeSignals([init?.signal, timeout.signal]),
      })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (isAbortError(error)) {
        throw error
      }
      if (attempt === retries) {
        throw error
      }
      await sleep(DEFAULT_RETRY_DELAY_MS * (attempt + 1))
    } finally {
      timeout.cancel()
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed')
}
