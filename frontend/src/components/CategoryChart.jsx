import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CAT_COLORS, CAT_LABELS } from '../constants'

const TOOLTIP_STYLE = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 6,
  fontSize: 11,
}

export default function CategoryChart({ data }) {
  if (!data?.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No data</div>
  }

  const chartData = data.map(d => ({
    name:  CAT_LABELS[d.category] ?? d.category,
    value: d.count,
    color: CAT_COLORS[d.category] ?? CAT_COLORS.unknown,
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={chartData}
          cx="40%"
          cy="50%"
          innerRadius={42}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="#21262d" strokeWidth={1} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [value.toLocaleString(), name]}
        />
        <Legend
          iconSize={7}
          iconType="circle"
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 10, color: '#8b949e' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
