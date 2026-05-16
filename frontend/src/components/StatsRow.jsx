import { fmtNum } from '../utils'

export default function StatsRow({ stats }) {
  const top = stats?.by_tool?.[0]?.tool ?? '—'
  return (
    <div id="stats">
      <div className="sc">
        <div className="sc-n">{stats ? fmtNum(stats.total) : '—'}</div>
        <div className="sc-l">Total Events</div>
      </div>
      <div className="sc">
        <div className="sc-n red">{stats ? fmtNum(stats.flagged) : '—'}</div>
        <div className="sc-l">Flagged</div>
      </div>
      <div className="sc">
        <div className="sc-n">{stats ? fmtNum(stats.sessions) : '—'}</div>
        <div className="sc-l">Sessions</div>
      </div>
      <div className="sc">
        <div className="sc-n" style={{ fontSize: 15 }}>{stats ? top : '—'}</div>
        <div className="sc-l">Top Tool</div>
      </div>
    </div>
  )
}
