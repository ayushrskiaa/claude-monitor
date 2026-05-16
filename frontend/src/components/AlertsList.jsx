import { fmtTime } from '../utils'

export default function AlertsList({ data, onEventClick }) {
  if (!data?.length) {
    return <span style={{ fontSize: 12, color: 'var(--muted)' }}>No flagged events</span>
  }

  return (
    <div>
      {data.map((a, i) => (
        <div key={a.id ?? i} className="alert-row" onClick={() => onEventClick(a)}>
          <span className="alert-icon">&#9888;</span>
          <div>
            <div className="alert-tool">{a.tool}</div>
            <div className="alert-sum">{(a.summary ?? '').slice(0, 55)}</div>
            <div className="alert-time">{fmtTime(a.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
