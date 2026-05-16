export default function TopTools({ data }) {
  if (!data?.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No data</div>
  }
  const max = data[0].count

  return (
    <div>
      {data.map(t => (
        <div key={t.tool} className="tool-row">
          <span style={{ minWidth: 78, fontSize: 12 }}>{t.tool}</span>
          <div className="tool-bar-wrap">
            <div className="tool-bar" style={{ width: `${Math.round(t.count / max * 100)}%` }} />
          </div>
          <span className="tool-cnt">{t.count}</span>
        </div>
      ))}
    </div>
  )
}
