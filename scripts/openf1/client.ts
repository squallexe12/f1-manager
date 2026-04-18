import type {
  OpenF1Lap,
  OpenF1Session,
  OpenF1Stint,
  OpenF1Weather,
} from './types'

// ---------------------------------------------------------------------------
// OpenF1 HTTP client
//
// Thin typed wrapper over api.openf1.org. Dependency-injected fetch keeps the
// client unit-testable without network I/O. Retries use linear backoff to
// stay gentle with a free public API.
// ---------------------------------------------------------------------------

const OPENF1_BASE_URL = 'https://api.openf1.org/v1'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface OpenF1ClientOptions {
  fetch?: FetchLike
  retries?: number
  retryDelayMs?: number
  baseUrl?: string
}

export interface OpenF1Client {
  getSessions(params: { year: number; sessionName?: string }): Promise<OpenF1Session[]>
  getLaps(sessionKey: number): Promise<OpenF1Lap[]>
  getStints(sessionKey: number): Promise<OpenF1Stint[]>
  getWeather(sessionKey: number): Promise<OpenF1Weather[]>
}

export function createOpenF1Client(options: OpenF1ClientOptions = {}): OpenF1Client {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const retries = options.retries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 500
  const baseUrl = options.baseUrl ?? OPENF1_BASE_URL

  async function request<T>(path: string, query: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)]),
    ).toString()
    const url = `${baseUrl}${path}?${qs}`

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchImpl(url)
        if (!response.ok) {
          throw new Error(`OpenF1 request failed: ${response.status} ${response.statusText} (${url})`)
        }
        return (await response.json()) as T
      } catch (err) {
        lastError = err
        if (attempt < retries && retryDelayMs > 0) {
          await sleep(retryDelayMs * (attempt + 1))
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  return {
    getSessions({ year, sessionName }) {
      const query: Record<string, string | number> = { year }
      if (sessionName) query.session_name = sessionName
      return request<OpenF1Session[]>('/sessions', query)
    },
    getLaps(sessionKey) {
      return request<OpenF1Lap[]>('/laps', { session_key: sessionKey })
    },
    getStints(sessionKey) {
      return request<OpenF1Stint[]>('/stints', { session_key: sessionKey })
    },
    getWeather(sessionKey) {
      return request<OpenF1Weather[]>('/weather', { session_key: sessionKey })
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
