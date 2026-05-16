import { useState, useEffect } from 'react'
import { CATEGORIES, CAT_LABELS } from '../constants'

export default function FilterBar({ sessions, activeFilters, onApply }) {
  const [local, setLocal] = useState({ session_id: '', category: '', flagged: '', search: '' })

  // Sync local state when filters are reset externally
  useEffect(() => {
    if (Object.keys(activeFilters).length === 0) {
      setLocal({ session_id: '', category: '', flagged: '', search: '' })
    }
  }, [activeFilters])

  function set(key, val) { setLocal(p => ({ ...p, [key]: val })) }

  function apply() {
    const f = {}
    if (local.session_id)   f.session_id = local.session_id
    if (local.category)     f.category   = local.category
    if (local.flagged)      f.flagged    = local.flagged === 'true'
    if (local.search.trim()) f.search    = local.search.trim()
    onApply(f)
  }

  function reset() {
    setLocal({ session_id: '', category: '', flagged: '', search: '' })
    onApply({})
  }

  const hasActive = Object.keys(activeFilters).length > 0

  return (
    <div id="filters">
      <select value={local.session_id} onChange={e => set('session_id', e.target.value)}>
        <option value="">All Sessions</option>
        {sessions.map(s => (
          <option key={s.session_id} value={s.session_id}>
            {s.session_id.slice(0, 8)} ({s.event_count})
          </option>
        ))}
      </select>

      <select value={local.category} onChange={e => set('category', e.target.value)}>
        <option value="">All Categories</option>
        {CATEGORIES.map(c => (
          <option key={c} value={c}>{CAT_LABELS[c]}</option>
        ))}
      </select>

      <select value={local.flagged} onChange={e => set('flagged', e.target.value)}>
        <option value="">All</option>
        <option value="true">Flagged Only</option>
      </select>

      <input
        id="f-search"
        type="text"
        placeholder="Search…"
        value={local.search}
        onChange={e => set('search', e.target.value)}
        onKeyDown={e => e.key === 'Enter' && apply()}
      />

      <button className="btn btn-p btn-sm" onClick={apply}>Apply</button>
      <button className="btn btn-sm" onClick={reset}>Reset</button>
      {hasActive && <span className="f-count">filters active</span>}
    </div>
  )
}
