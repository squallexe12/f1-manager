import { describe, expect, it } from 'vitest'
import { moodTone, moodLabel } from '@/lib/utils/mood-display'

describe('moodTone', () => {
  describe('frustration key', () => {
    it('returns good when frustration <= 30', () => {
      expect(moodTone('frustration', 0)).toBe('good')
      expect(moodTone('frustration', 30)).toBe('good')
    })
    it('returns warn when frustration is 31-60', () => {
      expect(moodTone('frustration', 31)).toBe('warn')
      expect(moodTone('frustration', 60)).toBe('warn')
    })
    it('returns bad when frustration > 60', () => {
      expect(moodTone('frustration', 61)).toBe('bad')
      expect(moodTone('frustration', 100)).toBe('bad')
    })
  })

  describe('other keys (motivation, confidence)', () => {
    it('returns good when value >= 75', () => {
      expect(moodTone('motivation', 75)).toBe('good')
      expect(moodTone('confidence', 100)).toBe('good')
    })
    it('returns warn when value is 45-74', () => {
      expect(moodTone('motivation', 45)).toBe('warn')
      expect(moodTone('confidence', 74)).toBe('warn')
    })
    it('returns bad when value < 45', () => {
      expect(moodTone('motivation', 44)).toBe('bad')
      expect(moodTone('confidence', 0)).toBe('bad')
    })
  })
})

describe('moodLabel', () => {
  describe('frustration key', () => {
    it('returns CALM when <= 25', () => expect(moodLabel('frustration', 20)).toBe('CALM'))
    it('returns BUILDING when 26-50', () => expect(moodLabel('frustration', 40)).toBe('BUILDING'))
    it('returns AGITATED when 51-70', () => expect(moodLabel('frustration', 65)).toBe('AGITATED'))
    it('returns CRITICAL when > 70', () => expect(moodLabel('frustration', 80)).toBe('CRITICAL'))
  })

  describe('other keys', () => {
    it('returns PEAK when >= 80', () => expect(moodLabel('motivation', 80)).toBe('PEAK'))
    it('returns STRONG when 60-79', () => expect(moodLabel('motivation', 65)).toBe('STRONG'))
    it('returns STEADY when 40-59', () => expect(moodLabel('confidence', 50)).toBe('STEADY'))
    it('returns LOW when < 40', () => expect(moodLabel('confidence', 30)).toBe('LOW'))
  })
})
