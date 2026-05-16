import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

const TOOLTIP_STYLE = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 6,
  fontSize: 11,
}

function parseHour(raw) {
  try {
    return new Date(raw).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return raw
  }
}

export default function TimelineChart({ data }) {
  if (!data?.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No data in last 24 h</div>
  }

  const chartData = data.map(d => ({ hour: parseHour(d.hour), count: d.count }))

  return (
    <ResponsiveContainer width="100%" height={155}>
      <BarChart data={chartData} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
        <XAxis
          dataKey="hour"
          tick={{ fill: '#8b949e', fontSize: 9 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: '#8b949e', fontSize: 9 }} allowDecimals={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={v => [v, 'Events']}
        />
        <Bar dataKey="count" fill="#6366f1" opacity={0.8} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
