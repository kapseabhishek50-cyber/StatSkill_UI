import { Table2, BarChart2 } from 'lucide-react';
import { useId, useState } from 'react';

/**
 * Wrapper every chart sits in.
 *
 * It exists to make the accessibility pass structural rather than per-chart: each
 * chart ships a table view of the same numbers, and the toggle lives here so no
 * chart can quietly ship without one. The legend slot is also here, because for
 * two or more series a legend is not optional.
 */
export default function ChartFrame({
  title,
  subtitle,
  legend,
  columns = [],
  rows = [],
  children,
  height = 260,
}) {
  const [view, setView] = useState('chart');
  const id = useId();

  return (
    <section className="card">
      <header className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink" id={`${id}-title`}>
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 rounded-md border border-hairline p-0.5" role="group" aria-label="View">
          {[
            { key: 'chart', icon: BarChart2, label: 'Chart' },
            { key: 'table', icon: Table2, label: 'Table' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`rounded px-2 py-1 text-xs ${
                view === key ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2'
              }`}
            >
              <Icon size={13} aria-hidden="true" className="inline" />
              <span className="ml-1 hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </header>

      {legend && view === 'chart' && <div className="mb-2">{legend}</div>}

      {view === 'chart' ? (
        <div style={{ height }} aria-labelledby={`${id}-title`}>
          {children}
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: height + 40 }}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-hairline text-ink-2">
                {columns.map((column) => (
                  <th key={column} className="py-2 pr-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink">
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-hairline last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-1.5 pr-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Shared legend row - a swatch plus the entity name, never colour alone. */
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: item.color, outline: '2px solid var(--surface-1)' }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
