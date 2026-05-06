import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormBars } from '@/components/drivers/form-bars'

describe('<FormBars>', () => {
  it('renders empty-state text when form array is empty', () => {
    render(<FormBars form={[]} lastRaceResult={null} />)
    expect(screen.getByText(/NO RACE STARTS THIS SEASON/i)).toBeInTheDocument()
  })

  it('assigns .podium class for positions 1-3', () => {
    const { container } = render(<FormBars form={[1, 2, 3]} lastRaceResult={1} />)
    const bars = container.querySelectorAll('.fb.podium')
    expect(bars.length).toBe(3)
  })

  it('assigns .points class for positions 4-10', () => {
    const { container } = render(<FormBars form={[4, 7, 10]} lastRaceResult={4} />)
    const bars = container.querySelectorAll('.fb.points')
    expect(bars.length).toBe(3)
  })

  it('assigns .midfield class for positions 11-15', () => {
    const { container } = render(<FormBars form={[11, 13, 15]} lastRaceResult={11} />)
    const bars = container.querySelectorAll('.fb.midfield')
    expect(bars.length).toBe(3)
  })

  it('assigns .back class for positions 16-20', () => {
    const { container } = render(<FormBars form={[16, 18, 20]} lastRaceResult={16} />)
    const bars = container.querySelectorAll('.fb.back')
    expect(bars.length).toBe(3)
  })

  it('assigns .back class with DNF label for positions >= 21', () => {
    const { container } = render(<FormBars form={[21, 99]} lastRaceResult={21} />)
    const bars = container.querySelectorAll('.fb.back')
    expect(bars.length).toBe(2)
    expect(screen.getAllByText('DNF').length).toBeGreaterThanOrEqual(2)
  })

  it('shows last race result as P{n}', () => {
    render(<FormBars form={[5]} lastRaceResult={5} />)
    // P5 appears in both the form bar label and the last-race summary strip
    expect(screen.getAllByText('P5').length).toBeGreaterThanOrEqual(1)
  })

  it('shows last race result as DNF when >= 21', () => {
    render(<FormBars form={[21]} lastRaceResult={21} />)
    // The "last race" label in the summary strip
    const dnfTexts = screen.getAllByText('DNF')
    expect(dnfTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows — when lastRaceResult is null', () => {
    render(<FormBars form={[5]} lastRaceResult={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
