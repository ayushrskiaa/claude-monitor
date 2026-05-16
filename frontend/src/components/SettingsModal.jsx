import { useState } from 'react'

export default function SettingsModal({ onClose, onSave, onDisconnect }) {
  const [url, setUrl] = useState(localStorage.getItem('cam_url') ?? '')
  const [key, setKey] = useState(localStorage.getItem('cam_key') ?? '')

  function save() {
    url ? localStorage.setItem('cam_url', url) : localStorage.removeItem('cam_url')
    key ? localStorage.setItem('cam_key', key) : localStorage.removeItem('cam_key')
    onSave()
  }

  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-hdr">
          <span>Settings</span>
          <button className="modal-x" onClick={onClose}>&#215;</button>
        </div>
        <div className="set-form">
          <label>
            API URL
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:8765  (default: current origin)"
            />
            <small>
              Leave empty when the dashboard is served by the monitor server.
              Set this to your hosted server URL when deploying the frontend separately.
            </small>
          </label>
          <label>
            API Key
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="(none)"
            />
            <small>Matches api_key in config.json on the server.</small>
          </label>
          <button className="btn btn-p" onClick={save}>Save &amp; Reconnect</button>
          <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}
