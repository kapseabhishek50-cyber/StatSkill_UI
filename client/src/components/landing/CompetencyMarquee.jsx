import Marquee from '../fx/Marquee.jsx';

/**
 * The competency framework, sliding past as a ticker.
 * Items come from /api/stats/public — live names when the DB is up.
 */
export default function CompetencyMarquee({ competencies = [] }) {
  const items = competencies.length
    ? competencies
    : [{ code: 'FRAMEWORK', name: 'MoSPI Competency Framework', category: 'domain' }];

  return (
    <div className="border-y border-hairline bg-surface py-4">
      <div className="mx-auto mb-2.5 max-w-7xl px-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Live from the framework · competencies in the platform
        </p>
      </div>
      <Marquee duration={42}>
        {items.map((item) => (
          <span
            key={item.code}
            className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary-bright)' }} />
            {item.name}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{item.category}</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
