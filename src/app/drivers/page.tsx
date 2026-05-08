'use client'

import type { CSSProperties } from 'react'
import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PageShell } from '@/components/layout/page-shell'
import { useDriversPageData } from '@/hooks/use-drivers-page-data'
import { PageHeader } from '@/components/drivers/page-header'
import { DriverTabs, type TabId } from '@/components/drivers/driver-tabs'
import { DriverHero } from '@/components/drivers/driver-hero'
import { AttributesCard } from '@/components/drivers/attributes-card'
import { MoodCard } from '@/components/drivers/mood-card'
import { ContractCard } from '@/components/drivers/contract-card'
import { PenaltyCard } from '@/components/drivers/penalty-card'
import { ScoutPanel } from '@/components/drivers/scout-panel'
import { ApproachModal } from '@/components/drivers/approach-modal'
import { useUIStore } from '@/stores/ui-store'
import type { Driver } from '@/types/driver'
import type { OfferTerms } from '@/engine/drivers/free-agent-signing'

export default function DriversPage() {
  const data = useDriversPageData()
  const { addNotification } = useUIStore(useShallow(s => ({ addNotification: s.addNotification })))
  const [activeTab, setActiveTab] = useState<TabId>('CAR-01')
  const [approachTarget, setApproachTarget] = useState<Driver | null>(null)

  const handleSubmit = useCallback(
    (offer: OfferTerms, slotChoice: 'CAR-01' | 'CAR-02' | 'RESERVE', displaceDriverId: string | null) => {
      if (!approachTarget || !data) return
      const result = data.signFreeAgent(approachTarget.id, offer, slotChoice, displaceDriverId)
      if (result.accepted) {
        addNotification(
          `Signed ${approachTarget.firstName} ${approachTarget.lastName} to ${slotChoice} on ${offer.termYears}-year deal`,
          'success',
        )
        setApproachTarget(null)
      }
      // On reject the modal stays open with the rejection reason rendered by evaluate()
    },
    [approachTarget, data, addNotification],
  )

  if (!data) return null

  const driver =
    activeTab === 'CAR-01' ? data.roster.car01 :
    activeTab === 'CAR-02' ? data.roster.car02 :
    activeTab === 'RESERVE' ? data.roster.reserve : null

  // Team color is set on the page root so all nested CSS custom-property
  // references resolve. colorDark is not on the Team type yet — fall back
  // to the primary color to derive a usable dark tint via CSS opacity.
  const teamStyle: CSSProperties = {
    ['--team' as string]: data.playerTeam.color,
    ['--team-dark' as string]: data.playerTeam.color,
  }

  return (
    <PageShell theme="broadcast">
      <div className="drv-wrap" style={teamStyle}>
        <PageHeader
          teamName={data.playerTeam.name}
          season={data.season}
          round={data.currentRound}
          nextRound={data.nextRound}
          constructorPos={data.constructorPosition}
          rosterCount={data.rosterCount}
        />
        <DriverTabs
          roster={data.roster}
          scoutCount={data.freeAgents.length}
          teamColor={data.playerTeam.color}
          active={activeTab}
          onChange={setActiveTab}
        />
        {activeTab === 'SCOUT' ? (
          <ScoutPanel
            scouts={data.freeAgents}
            onOpenApproach={setApproachTarget}
            onFileReport={data.fileScoutingReport}
          />
        ) : driver ? (
          <>
            <DriverHero
              driver={driver}
              team={data.playerTeam}
              currentSeason={data.season}
              championshipPosition={data.championshipPositionByDriverId[driver.id] ?? null}
              championshipGap={data.championshipGapByDriverId[driver.id] ?? null}
            />
            <div className="drv-grid">
              <AttributesCard
                driver={driver}
                peer={data.peerAttributes}
                teamColor={data.playerTeam.color}
              />
              <MoodCard
                driver={driver}
                rivalryIndex={data.rivalryIndex}
              />
              <ContractCard
                driver={driver}
                currentSeason={data.season}
                onNegotiate={() => data.openContractNegotiation(driver.id)}
                onRelease={() => { /* free-agent release flow — future */ }}
              />
            </div>
            <div className="drv-grid" style={{ marginTop: 14, gridTemplateColumns: '1fr' }}>
              <PenaltyCard
                driver={driver}
                currentSeason={data.season}
                currentRound={data.currentRound}
              />
            </div>
          </>
        ) : (
          <div style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--ink-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            No driver assigned to this slot
          </div>
        )}
      </div>
      {approachTarget && (
        <ApproachModal
          driver={approachTarget}
          remainingCap={data.remainingCap}
          rosterSlots={data.roster}
          currentPhase={data.phase}
          evaluate={(offer) => data.evaluateApproachOffer(approachTarget.id, offer)}
          onClose={() => setApproachTarget(null)}
          onSubmit={handleSubmit}
        />
      )}
    </PageShell>
  )
}
