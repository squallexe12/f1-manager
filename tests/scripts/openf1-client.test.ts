import { describe, it, expect, vi } from 'vitest'
import { createOpenF1Client } from '@scripts/openf1/client'

function makeFetchResponse<T>(data: T, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
    statusText: ok ? 'OK' : 'Error',
  })
}

describe('createOpenF1Client', () => {
  it('fetches sessions for a given year and session type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse([{ session_key: 1, session_name: 'Race', circuit_short_name: 'Sakhir', country_name: 'Bahrain', year: 2024, date_start: '2024-03-02' }]),
    )
    const client = createOpenF1Client({ fetch: fetchMock, retries: 0 })
    const sessions = await client.getSessions({ year: 2024, sessionName: 'Race' })
    expect(sessions).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('year=2024')
    expect(url).toContain('session_name=Race')
  })

  it('retries a failed request up to the configured retry count', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeFetchResponse({}, false, 500))
      .mockResolvedValueOnce(makeFetchResponse({}, false, 500))
      .mockResolvedValueOnce(makeFetchResponse([{ driver_number: 1, lap_number: 1, lap_duration: 80 }]))
    const client = createOpenF1Client({ fetch: fetchMock, retries: 2, retryDelayMs: 0 })
    const laps = await client.getLaps(1234)
    expect(laps).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse({}, false, 500))
    const client = createOpenF1Client({ fetch: fetchMock, retries: 1, retryDelayMs: 0 })
    await expect(client.getLaps(1234)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetches stints for a session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse([{ driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 20, compound: 'SOFT', tyre_age_at_start: 0 }]),
    )
    const client = createOpenF1Client({ fetch: fetchMock, retries: 0 })
    const stints = await client.getStints(5678)
    expect(stints[0].compound).toBe('SOFT')
    expect((fetchMock.mock.calls[0][0] as string)).toContain('session_key=5678')
  })

  it('fetches weather for a session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse([{ date: '2024-03-02T15:00:00Z', air_temperature: 25, track_temperature: 38, rainfall: 0, humidity: 40 }]),
    )
    const client = createOpenF1Client({ fetch: fetchMock, retries: 0 })
    const weather = await client.getWeather(5678)
    expect(weather).toHaveLength(1)
    expect(weather[0].air_temperature).toBe(25)
  })
})
