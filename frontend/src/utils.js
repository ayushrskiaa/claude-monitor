export function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return (ts || '').slice(11, 19)
  }
}

export function fmtSess(id) {
  return (id || '').slice(0, 8)
}

export function fmtNum(n) {
  return (n ?? 0).toLocaleString()
}
