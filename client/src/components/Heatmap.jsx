import { useState } from 'react';
import ChartFrame from './ChartFrame.jsx';
import { percent, seqStep } from '../lib/format.js';

/**
 * Skill heatmap: divisions down, competencies across, cell = mean normalised gap.
 *
 * Sequential single hue, five steps, lightest = near zero. Continuous magnitude is
 * exactly the job sequential colour does; a categorical palette here would imply
 * the columns were unrelated kinds rather than one ordered measure.
 *
 * Cells carry no number - at this density a label per cell is noise, and the
 * value is reachable two other ways (hover, and the table view ChartFrame
 * provides). Column headers are competency codes with the full name on hover, so
 * nothing is rotated 45 degrees.
 */
export default function Heatmap({ departments = [], competencies = [], cells = [], height = 340 }) {
  const [hover, setHover] = useState(null);

  const lookup = new Map(cells.map((cell) => [`${cell.departmentId}:${cell.competencyId}`, cell]));

  const columns = ['Division', ...competencies.map((competency) => competency.code ?? competency.name)];
  const tableRows = departments.map((department) => [
    department.name,
    ...competencies.map((competency) => {
      const cell = lookup.get(`${department.id}:${competency.id}`);
      return cell ? percent(cell.meanGap, 0) : '—';
    }),
  ]);

  return (
    <ChartFrame
      title="Skill heatmap"
      subtitle="Mean competency gap by division. Darker means a wider gap against role requirements."
      height={height}
      columns={columns}
      rows={tableRows}
      legend={<SeqLegend />}
    >
      <div className="relative h-full overflow-auto">
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface pr-2 text-left font-medium text-ink-muted">
                Division
              </th>
              {competencies.map((competency) => (
                <th
                  key={competency.id}
                  className="px-1 pb-1 text-center font-medium text-ink-muted"
                  title={competency.name}
                >
                  {competency.code ?? competency.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <th
                  className="sticky left-0 z-10 whitespace-nowrap bg-surface pr-2 text-left font-normal text-ink-2"
                  scope="row"
                >
                  {department.name}
                </th>
                {competencies.map((competency) => {
                  const cell = lookup.get(`${department.id}:${competency.id}`);
                  const step = seqStep(cell?.meanGap ?? 0);
                  return (
                    <td key={competency.id} className="p-0">
                      <div
                        className="h-7 min-w-[26px] rounded-[3px]"
                        style={{
                          background: step === 0 ? 'var(--surface-2)' : `var(--seq-${step})`,
                        }}
                        tabIndex={0}
                        role="img"
                        aria-label={`${department.name}, ${competency.name}: mean gap ${percent(
                          cell?.meanGap ?? 0,
                        )}`}
                        onMouseEnter={(event) =>
                          setHover({
                            department: department.name,
                            competency: competency.name,
                            cell,
                            x: event.clientX,
                            y: event.clientY,
                          })
                        }
                        onMouseMove={(event) =>
                          setHover((current) =>
                            current ? { ...current, x: event.clientX, y: event.clientY } : current,
                          )
                        }
                        onMouseLeave={() => setHover(null)}
                        onFocus={() =>
                          setHover({
                            department: department.name,
                            competency: competency.name,
                            cell,
                            x: null,
                            y: null,
                          })
                        }
                        onBlur={() => setHover(null)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {hover && <CellTooltip {...hover} />}
      </div>
    </ChartFrame>
  );
}

function CellTooltip({ department, competency, cell, x, y }) {
  const positioned = x !== null && y !== null;
  return (
    <div
      className="pointer-events-none z-20 rounded-md border border-hairline bg-surface p-2.5 text-xs shadow-card"
      style={
        positioned
          ? { position: 'fixed', left: x + 12, top: y + 12 }
          : { position: 'absolute', bottom: 8, left: 8 }
      }
      role="status"
    >
      <p className="font-medium text-ink">{competency}</p>
      <p className="mt-0.5 text-ink-2">{department}</p>
      <p className="tnum mt-1 text-ink-2">
        Mean gap {percent(cell?.meanGap ?? 0)} · {cell?.officers ?? 0} officers
      </p>
    </div>
  );
}

/** Five discrete steps with their band edges - the scale, not a colour parade. */
function SeqLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
      <span>No gap</span>
      <span className="h-3 w-4 rounded-[2px]" style={{ background: 'var(--surface-2)' }} />
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className="h-3 w-4 rounded-[2px]"
          style={{ background: `var(--seq-${step})` }}
        />
      ))}
      <span>Full gap</span>
    </div>
  );
}
