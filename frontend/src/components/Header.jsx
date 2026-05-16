import { useState, useRef, useEffect } from 'react'

export default function Header({ wsStatus, onExport, onOpenSettings }) {
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (!ddRef.current?.contains(e.target)) setDdOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const dotClass = `ws-dot ${wsStatus === 'live' ? 'live' : wsStatus === 'error' ? 'error' : ''}`
  const label    = wsStatus === 'live' ? 'Live' : wsStatus === 'error' ? 'Disconnected' : 'Connecting…'

  return (
    <div id="hdr">
      <div className="hdr-l">
        <span className={dotClass} />
        <h1>Claude Access Monitor</h1>
        <span id="ws-lbl">{label}</span>
      </div>
      <div className="hdr-r">
        <div className="dd" ref={ddRef}>
          <button className="btn btn-sm" onClick={() => setDdOpen(v => !v)}>
            Export &#9660;
          </button>
          {ddOpen && (
            <div className="dd-menu">
              <a href="#" onClick={e => { e.preventDefault(); onExport('jsonl'); setDdOpen(false) }}>
                Download JSONL
              </a>
              <a href="#" onClick={e => { e.preventDefault(); onExport('csv'); setDdOpen(false) }}>
                Download CSV
              </a>
            </div>
          )}
        </div>
        <button className="btn btn-sm" onClick={onOpenSettings}>&#9881; Settings</button>
      </div>
    </div>
  )
}
