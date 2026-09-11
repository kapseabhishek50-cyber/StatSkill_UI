import { useState } from 'react';
import { ArrowLeft, ChevronRight, Search, Users } from 'lucide-react';
import CompetencyMeter from '../../components/CompetencyMeter.jsx';
import { Badge, Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { endpoints, formatDate, percent } from '../../lib/index.js';

/**
 * Officer directory for administrators.
 *
 * Lists all active learner accounts with their readiness and gap counts,
 * and drills into a detail view showing competencies, gaps, quiz history,
 * and learning progress. Individual-level data is audit-logged server-side.
 */
export default function Officers() {
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const heatmap = useApi(endpoints.adminHeatmap);
  const divisions = heatmap.data?.departments ?? [];

  const query = new URLSearchParams();
  if (department) query.set('department', department);
  if (search) query.set('search', search);
  const queryString = query.toString() ? `?${query.toString()}` : '';

  const listApi = useApi(`${endpoints.adminOfficers}${queryString}`, {
    deps: [department, search],
    enabled: !selectedOfficer,
  });

  const detailApi = useApi(`${endpoints.adminOfficers}/${selectedOfficer}`, {
    enabled: !!selectedOfficer,
    deps: [selectedOfficer],
  });

  // ── Detail view ────────────────────────────────────────────────────────
  if (selectedOfficer) {
    if (detailApi.loading) return <Loading label="Loading officer profile" />;

    const d = detailApi.data;
    const competencies = d?.competencies ?? [];
    const gaps = (d?.gaps ?? []).filter((g) => g.gap > 0);
    const quizzes = d?.quizHistory ?? [];
    const progress = d?.learningProgress ?? [];

    return (
      <div className="space-y-5">
        <div>
          <button
            type="button"
            className="mb-4 flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            onClick={() => setSelectedOfficer(null)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to directory
          </button>
          <h1 className="text-xl font-semibold text-ink">{d?.officer?.name ?? 'Officer profile'}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {d?.jobRole?.title ?? '—'}
            {d?.department?.name ? ` · ${d.department.name}` : ''}
            {' · '}
            {d?.officer?.email}
          </p>
        </div>

        <ErrorNote error={detailApi.error} onRetry={detailApi.refetch} />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-1">
            <Card title="Open gaps">
              {gaps.length > 0 ? (
                <ul className="space-y-3">
                  {gaps.map((gap) => (
                    <li
                      key={gap.competencyId ?? gap.competency?._id}
                      className="flex items-start justify-between gap-2 border-t border-hairline pt-3 first:border-0 first:pt-0"
                    >
                      <div>
                        <p className="text-sm text-ink">
                          {gap.competency?.name ?? gap.competencyName ?? '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Level {gap.currentLevel} → needs {gap.requiredLevel}
                        </p>
                      </div>
                      <Badge band={gap.band ?? gap.priorityBand} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No open gaps. Ready for role.</Empty>
              )}
            </Card>

            <Card title="Learning progress">
              {progress.length > 0 ? (
                <ul className="space-y-3">
                  {progress.map((p) => (
                    <li
                      key={String(p.course?._id ?? p._id)}
                      className="border-t border-hairline pt-3 first:border-0 first:pt-0"
                    >
                      <p className="text-sm text-ink">{p.course?.title ?? '—'}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {p.status === 'completed' ? 'Completed' : `${p.percentComplete ?? 0}% complete`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No enrolled courses.</Empty>
              )}
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <Card title="Competency record" subtitle="Current level against the requirement for this officer's role">
              {competencies.length > 0 ? (
                <div className="space-y-4">
                  {competencies.map((comp) => {
                    const gap = (d?.gaps ?? []).find(
                      (g) =>
                        String(g.competencyId ?? g.competency?._id) ===
                        String(comp.competency?._id ?? comp.competency),
                    );
                    return (
                      <CompetencyMeter
                        key={String(comp.competency?._id ?? comp.competency)}
                        name={comp.competency?.name ?? '—'}
                        currentLevel={comp.currentLevel}
                        requiredLevel={gap?.requiredLevel ?? null}
                        category={comp.competency?.category}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty>No competencies recorded yet.</Empty>
              )}
            </Card>

            <Card title="Quiz history">
              {quizzes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-hairline text-ink-2">
                        <th className="py-2 pr-3 font-medium">Competency</th>
                        <th className="py-2 pr-3 font-medium">Level</th>
                        <th className="py-2 pr-3 font-medium">Score</th>
                        <th className="py-2 pr-3 font-medium">Outcome</th>
                        <th className="py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink">
                      {quizzes.map((q) => (
                        <tr key={String(q._id)} className="border-b border-hairline last:border-0">
                          <td className="py-2 pr-3">{q.competency?.name ?? '—'}</td>
                          <td className="py-2 pr-3">{q.targetLevel}</td>
                          <td className="py-2 pr-3">{percent(q.scoreRatio)}</td>
                          <td className="py-2 pr-3">
                            {q.passed ? (
                              <span style={{ color: 'var(--delta-up)' }}>
                                Recorded {q.levelBefore} → {q.levelAfter}
                              </span>
                            ) : (
                              <span className="text-ink-2">Not recorded</span>
                            )}
                          </td>
                          <td className="py-2">{formatDate(q.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No quizzes taken.</Empty>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  const officers = listApi.data?.officers ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Officer directory</h1>
        <p className="mt-1 text-sm text-ink-2">
          View individual officers, their readiness, and open gaps. Reads are audit-logged.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
        <div>
          <label htmlFor="search" className="label">
            Search
          </label>
          <div className="relative mt-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-ink-muted" aria-hidden="true" />
            <input
              id="search"
              type="text"
              placeholder="Name or email…"
              className="field w-64 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="department" className="label">
            Department
          </label>
          <select
            id="department"
            className="field mt-1 w-64"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <p className="flex items-center gap-1.5 pb-2 text-xs text-ink-muted">
          <Users size={13} aria-hidden="true" />
          {officers.length} officer{officers.length === 1 ? '' : 's'}
        </p>
      </div>

      <ErrorNote error={listApi.error} onRetry={listApi.refetch} />

      <Card>
        {listApi.loading ? (
          <Loading label="Loading officers" />
        ) : officers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-2">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Department</th>
                  <th className="py-2 pr-3 font-medium">Job Role</th>
                  <th className="py-2 pr-3 font-medium text-right">Readiness</th>
                  <th className="py-2 pr-3 font-medium text-right">Gaps</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="text-ink">
                {officers.map((officer) => (
                  <tr
                    key={officer.id ?? officer._id}
                    className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-surface-2"
                    onClick={() => setSelectedOfficer(officer.id ?? officer._id)}
                  >
                    <td className="py-2 pr-3 font-medium">{officer.name}</td>
                    <td className="py-2 pr-3">{officer.email}</td>
                    <td className="py-2 pr-3">{officer.department?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{officer.jobRole?.title ?? '—'}</td>
                    <td className="tnum py-2 pr-3 text-right">{percent(officer.readiness)}</td>
                    <td className="tnum py-2 pr-3 text-right">{officer.gapCount}</td>
                    <td className="py-2 text-right">
                      <ChevronRight size={14} className="inline text-ink-muted" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No officers found matching your criteria.</Empty>
        )}
      </Card>
    </div>
  );
}
