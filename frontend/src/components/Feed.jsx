import { memo } from 'react'
import { CAT_COLORS } from '../constants'
import { fmtTime, fmtSess } from '../utils'

// ── EventRow ──────────────────────────────────────────────────────────────────

const EventRow = memo(function EventRow({ event, onClick }) {
  const color = CAT_COLORS[event.category] ?? CAT_COLORS.unknown
  const summary = event.summary ?? ''

  return (
    <div
      className={`ev${event.flagged ? ' fl' : ''}${event._fresh ? ' fresh' : ''}`}
      style={event.flagged ? undefined : { borderLeftColor: color }}
      onClick={() => onClick(event)}
    >
      <span className="ev-t">{fmtTime(event.timestamp)}</span>
      <span className="ev-s" title={event.session_id}>{fmtSess(event.session_id)}</span>
      <span className="ev-tool">
        <span className="dot" style={{ background: color }} />
        {event.tool}
      </span>
      <span className="ev-sum" title={summary}>{summary}</span>
      <span className="ev-flag">{event.flagged ? '⚠' : ''}</span>
    </div>
  )
})

// ── EventFeed ─────────────────────────────────────────────────────────────────

export default function Feed({ events, total, offset, onLoadMore, onEventClick }) {
  const hasMore = offset < total

  return (
    <div id="feed-wrap">
      <div className="tbl-hdr">
        <span>Time</span>
        <span>Session</span>
        <span>Tool</span>
        <span>Summary</span>
        <span />
      </div>

      <div id="feed">
        {events.length === 0 ? (
          <div className="empty">
            <strong>No events yet</strong>
            <p>Use Claude Code — events appear here in real-time.</p>
          </div>
        ) : (
          events.map((ev, i) => (
            <EventRow
              key={ev.id != null ? String(ev.id) : `ws-${ev.timestamp}-${ev.tool}-${i}`}
              event={ev}
              onClick={onEventClick}
            />
          ))
        )}
      </div>

      {hasMore && (
        <div id="more-wrap">
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={onLoadMore}>
            Load more ({(total - offset).toLocaleString()} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
