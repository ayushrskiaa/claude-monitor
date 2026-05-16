import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, apiBase } from './api'
import Header from './components/Header'
import StatsRow from './components/StatsRow'
import FilterBar from './components/FilterBar'
import Feed from './components/Feed'
import SidePanel from './components/SidePanel'
import DetailModal from './components/DetailModal'
import SettingsModal from './components/SettingsModal'
import ConnectScreen from './components/ConnectScreen'

const PAGE = 100

function matchesFilters(ev, filters) {
  if (filters.session_id && ev.session_id !== filters.session_id) return false
  if (filters.category   && ev.category   !== filters.category)   return false
  if (filters.flagged !== undefined && Boolean(ev.flagged) !== filters.flagged) return false
  if (filters.search) {
    const q = filters.search.toLowerCase()
    if (!(ev.summary    || '').toLowerCase().includes(q) &&
        !(ev.tool       || '').toLowerCase().includes(q) &&
        !(ev.session_id || '').toLowerCase().includes(q)) return false
  }
  return true
}

export default function App() {
  // Gate: show ConnectScreen until user has saved server URL + API key
  const [connected,    setConnected]    = useState(
    !!(localStorage.getItem('cam_url') && localStorage.getItem('cam_key'))
  )

  const [events,       setEvents]       = useState([])
  const [stats,        setStats]        = useState(null)
  const [sessions,     setSessions]     = useState([])
  const [wsStatus,     setWsStatus]     = useState('connecting')
  const [filters,      setFilters]      = useState({})
  const [offset,       setOffset]       = useState(0)
  const [total,        setTotal]        = useState(0)
  const [detailEvent,  setDetailEvent]  = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // increment to trigger WS reconnect when settings change
  const [settingsVer,  setSettingsVer]  = useState(0)

  const seenIds       = useRef(new Set())
  const filtersRef    = useRef(filters)
  const statsTimer    = useRef(null)

  useEffect(() => { filtersRef.current = filters }, [filters])

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        apiFetch('/api/stats'),
        apiFetch('/api/sessions'),
      ])
      setStats(s)
      setSessions(d.sessions || [])
    } catch (err) {
      console.error('loadStats:', err)
    }
  }, [])

  const loadEvents = useCallback(async (off, replace) => {
    try {
      const data = await apiFetch('/api/events', { limit: PAGE, offset: off, ...filtersRef.current })
      setTotal(data.total)
      if (replace) {
        seenIds.current = new Set(data.events.map(e => e.id).filter(Boolean))
        setEvents(data.events)
        setOffset(data.events.length)
      } else {
        const fresh = data.events.filter(e => !seenIds.current.has(e.id))
        fresh.forEach(e => e.id && seenIds.current.add(e.id))
        setEvents(prev => [...prev, ...fresh])
        setOffset(off + fresh.length)
      }
    } catch (err) {
      console.error('loadEvents:', err)
    }
  }, [])  // filters accessed via ref — no dep needed

  // Load on mount and filter changes
  useEffect(() => {
    loadStats()
    loadEvents(0, true)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stats refresh every 30s
  useEffect(() => {
    const id = setInterval(loadStats, 30_000)
    return () => clearInterval(id)
  }, [loadStats])

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let ws
    let reconnectTimer

    function connect() {
      const url = apiBase().replace(/^http/, 'ws') + '/ws'
      ws = new WebSocket(url)

      ws.onopen  = () => setWsStatus('live')
      ws.onerror = () => setWsStatus('error')
      ws.onclose = () => {
        setWsStatus('error')
        reconnectTimer = setTimeout(connect, 3000)
      }
      ws.onmessage = (msg) => {
        try {
          const { type, data: ev } = JSON.parse(msg.data)
          if (type !== 'event') return

          if (matchesFilters(ev, filtersRef.current)) {
            setEvents(prev => [{ ...ev, _fresh: true }, ...prev].slice(0, 500))
          }

          setStats(prev => prev ? {
            ...prev,
            total:   prev.total + 1,
            flagged: ev.flagged ? prev.flagged + 1 : prev.flagged,
          } : prev)

          if (ev.flagged) {
            clearTimeout(statsTimer.current)
            statsTimer.current = setTimeout(loadStats, 2000)
          }
        } catch {}
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      if (ws) { ws.onclose = null; ws.close() }
    }
  }, [settingsVer, loadStats]) // reconnect when settings change

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSettingsSave() {
    setSettingsOpen(false)
    setConnected(!!(localStorage.getItem('cam_url') && localStorage.getItem('cam_key')))
    setSettingsVer(v => v + 1)   // triggers WS reconnect
    loadStats()
    loadEvents(0, true)
  }

  function handleDisconnect() {
    localStorage.removeItem('cam_url')
    localStorage.removeItem('cam_key')
    setConnected(false)
    setSettingsOpen(false)
  }

  function handleExport(fmt) {
    Object.assign(document.createElement('a'), {
      href: `${apiBase()}/api/export?fmt=${fmt}`,
      download: `claude_events.${fmt}`,
    }).click()
  }

  if (!connected) {
    return <ConnectScreen onConnect={() => setConnected(true)} />
  }

  return (
    <>
      <Header
        wsStatus={wsStatus}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <StatsRow stats={stats} />
      <FilterBar
        sessions={sessions}
        activeFilters={filters}
        onApply={setFilters}
      />
      <div id="grid">
        <Feed
          events={events}
          total={total}
          offset={offset}
          onLoadMore={() => loadEvents(offset, false)}
          onEventClick={setDetailEvent}
        />
        <SidePanel stats={stats} onEventClick={setDetailEvent} />
      </div>
      {detailEvent  && <DetailModal  event={detailEvent} onClose={() => setDetailEvent(null)} />}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSave={handleSettingsSave}
          onDisconnect={handleDisconnect}
        />
      )}
    </>
  )
}
