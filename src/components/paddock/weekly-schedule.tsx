import type { WeeklyScheduleItem } from '@/engine/paddock/factory-schedule'

interface WeeklyScheduleProps {
  items: WeeklyScheduleItem[]
}

export function WeeklySchedule({ items }: WeeklyScheduleProps) {
  return (
    <div className="pd-schedule" role="list" aria-label="This week's factory schedule">
      <div className="pd-panel-head">
        <div className="ph-title">This Week · Factory</div>
        <div className="ph-sub">SCHEDULED</div>
      </div>
      {items.map(item => (
        <div key={item.when} className="pd-sched-item" role="listitem">
          <div className="pd-sched-when">{item.when}</div>
          <div className="pd-sched-label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
