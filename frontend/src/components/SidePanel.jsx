import CategoryChart from './CategoryChart'
import TimelineChart from './TimelineChart'
import TopTools from './TopTools'
import AlertsList from './AlertsList'

export default function SidePanel({ stats, onEventClick }) {
  return (
    <div id="side">
      <div className="card">
        <div className="card-title">Category Breakdown</div>
        <CategoryChart data={stats?.by_category} />
      </div>
      <div className="card">
        <div className="card-title">Events / Hour (24 h)</div>
        <TimelineChart data={stats?.timeline} />
      </div>
      <div className="card">
        <div className="card-title">Top Tools</div>
        <TopTools data={stats?.by_tool} />
      </div>
      <div className="card">
        <div className="card-title">Recent Alerts</div>
        <AlertsList data={stats?.recent_flagged} onEventClick={onEventClick} />
      </div>
    </div>
  )
}
