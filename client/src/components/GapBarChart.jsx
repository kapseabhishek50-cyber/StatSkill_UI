import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartFrame from './ChartFrame.jsx';

export default function GapBarChart({
  rows = [],
  title,
  subtitle,
  height = 300,
  maxBars = 8,
}) {
  const data = rows.slice(0, maxBars).map((r) => ({
    name: r.name || r.competency?.name || 'Competency',
    priority: Number(r.priorityScore ?? r.gap ?? 0),
    gap: r.gap ?? 0,
    current: r.currentLevel ?? 0,
    required: r.requiredLevel ?? 0,
  }));

  return (
    <ChartFrame title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gridline)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--text-secondary)"
            fontSize={12}
            tickLine={false}
            width={140}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="card p-3 shadow-card-hover border border-hairline bg-surface text-xs space-y-1">
                    <p className="font-bold text-ink">{item.name}</p>
                    <p className="text-primary font-semibold">Priority Score: {item.priority.toFixed(2)}</p>
                    <p className="text-ink-muted">Current: Level {item.current} → Target: Level {item.required}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="priority" radius={[0, 6, 6, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 0 ? 'var(--primary)' : 'var(--accent)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
