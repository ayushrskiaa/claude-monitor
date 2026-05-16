import { fmtTime } from '../utils'

export default function DetailModal({ event, onClose }) {
  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>{event.tool} &mdash; {fmtTime(event.timestamp)}</span>
          <button className="modal-x" onClick={onClose}>&#215;</button>
        </div>
        <pre className="det-json">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  )
}
