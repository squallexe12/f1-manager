import { describe, expect, it } from 'vitest'
import { computeDriverOvr } from '@/lib/utils/driver-ovr'

describe('computeDriverOvr', () => {
  it('matches the formula in new-designs/drivers/Drivers Page.html', () => {
    const ovr = computeDriverOvr({
      pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50,
    })
    // (97*1.3 + 96*1.2 + 92*0.8 + 90*0.7 + 95*0.3 + 50*0.2) / 4.5
    // = 126.1 + 115.2 + 73.6 + 63 + 28.5 + 10 = 416.4 / 4.5 = 92.53... → 93
    expect(ovr).toBe(93)
  })
})
