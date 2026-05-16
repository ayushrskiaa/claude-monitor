export function apiBase() {
  return (localStorage.getItem('cam_url') || '').replace(/\/$/, '') || window.location.origin
}

export function apiHeaders() {
  const k = localStorage.getItem('cam_key') || ''
  return k ? { 'X-Api-Key': k } : {}
}

export async function apiFetch(path, params) {
  const u = new URL(apiBase() + path)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) u.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(u, { headers: apiHeaders() })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}
