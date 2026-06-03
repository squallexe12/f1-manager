import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameStore } from '@/stores/game-store'
import { useFreeAgentSigning } from '@/hooks/use-free-agent-signing'

describe('useFreeAgentSigning', () => {
  beforeEach(() => {
    useGameStore.setState({ world: null })
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('returns null for a non-free-agent id', () => {
    const contracted = useGameStore.getState().world!.drivers.find(d => d.teamId !== null)!
    const { result } = renderHook(() => useFreeAgentSigning(contracted.id))
    expect(result.current).toBeNull()
  })

  it('exposes asking salary and evaluates an accepted offer', () => {
    const fa = useGameStore.getState().world!.drivers.find(d => d.teamId === null)!
    const { result } = renderHook(() => useFreeAgentSigning(fa.id))
    expect(result.current).not.toBeNull()
    const verdict = result.current!.evaluate({ salary: result.current!.askingSalary, termYears: 1 })
    expect(verdict.accepted).toBe(true)
  })

  it('commit signs the free agent into the chosen slot', () => {
    const fa = useGameStore.getState().world!.drivers.find(d => d.teamId === null)!
    const { result } = renderHook(() => useFreeAgentSigning(fa.id))
    act(() => result.current!.commit({ salary: result.current!.askingSalary, termYears: 1 }, 'RESERVE'))
    expect(useGameStore.getState().world!.drivers.find(d => d.id === fa.id)!.teamId).toBe('mclaren')
  })
})
