import { describe, it, expect } from 'vitest'
import { SPONSORS, SPONSOR_METRIC_KINDS } from '@/data/sponsors'

describe('SPONSORS metric descriptors', () => {
  it('every KPI template carries a valid metric kind', () => {
    for (const sponsor of SPONSORS) {
      expect(sponsor.kpiTemplates.length).toBeGreaterThan(0)
      for (const kpi of sponsor.kpiTemplates) {
        expect(SPONSOR_METRIC_KINDS).toContain(kpi.metric)
        expect(typeof kpi.target).toBe('number')
      }
    }
  })

  it('covers all 17 sponsors with unique ids', () => {
    expect(SPONSORS).toHaveLength(17)
    expect(new Set(SPONSORS.map(s => s.id)).size).toBe(17)
  })
})
