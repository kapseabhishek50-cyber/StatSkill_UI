import { useState } from 'react';
import { Users } from 'lucide-react';
import GapBarChart from '../../components/GapBarChart.jsx';
import Heatmap from '../../components/Heatmap.jsx';
import { Card, Empty, ErrorNote, Loading, StatTile } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { endpoints, percent } from '../../lib/index.js';

/**
 * Workforce analytics.
 *
 * Every figure here is aggregate. Individual officers are not listed and not
 * linkable: an administrator's legitimate question is "where is this division
 * weak", and answering it does not require naming anyone. The API enforces the
 * role on each of these routes and records the read in the audit log.
 */
export default function AdminDashboard() {
  const [division, setDivision] = useState('');
  const overview = useApi(endpoints.adminOverview);
  const heatmap = useApi(endpoints.adminHeatmap);
  const gaps = useApi(`${endpoints.adminGaps}${division ? `?department=${division}` : ''}`, {
    deps: [division],
  });

  if (overview.loading) return <Loading label="Aggregating workforce data" />;

  const stats = overview.data ?? {};
  const divisions = heatmap.data?.departments ?? [];
  const rows = gaps.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Workforce analytics</h1>
        <p className="mt-1 text-sm text-ink-2">
          Aggregate competency position across divisions. Figures are means over officers with a
          recorded competency profile.
        </p>
      </div>

      <ErrorNote error={overview.error ?? heatmap.error ?? gaps.error} onRetry={overview.error ? overview.refetch : heatmap.error ? heatmap.refetch : gaps.refetch} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Officers profiled"
          value={stats.officers ?? 0}
          hint={`${stats.divisions ?? 0} divisions`}
        />
        <StatTile
          label="Mean role readiness"
          value={percent(stats.meanReadiness)}
          hint="Weighted by how central each competency is to the role"
        />
        <StatTile
          label="Officers with open gaps"
          value={stats.officersWithGaps ?? 0}
          hint={
            stats.officers
              ? `${percent((stats.officersWithGaps ?? 0) / stats.officers)} of those profiled`
              : undefined
          }
        />
        <StatTile
          label="Quizzes taken"
          value={stats.quizzesTaken ?? 0}
          hint={`${stats.coursesEnrolled ?? 0} course enrolments`}
        />
      </div>

      {/* Filters sit in one row above the charts, never inside them. */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
        <div>
          <label htmlFor="division" className="label">
            Division
          </label>
          <select
            id="division"
            className="field mt-1 w-64"
            value={division}
            onChange={(event) => setDivision(event.target.value)}
          >
            <option value="">All divisions</option>
            {divisions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <p className="flex items-center gap-1.5 pb-2 text-xs text-ink-muted">
          <Users size={13} aria-hidden="true" />
          Aggregate view · no individual records
        </p>
      </div>

      {heatmap.loading ? (
        <Card>
          <Loading label="Building heatmap" />
        </Card>
      ) : heatmap.data?.cells?.length ? (
        <Heatmap
          departments={heatmap.data.departments}
          competencies={heatmap.data.competencies}
          cells={heatmap.data.cells}
          height={Math.max(240, (heatmap.data.departments?.length ?? 0) * 34 + 60)}
        />
      ) : (
        <Card title="Skill heatmap">
          <Empty>No competency records yet. Seed the database or ask officers to self-assess.</Empty>
        </Card>
      )}

      {rows.length > 0 ? (
        <GapBarChart
          rows={rows}
          title="Widest workforce gaps"
          subtitle={
            division
              ? 'Mean priority within the selected division, highest first.'
              : 'Mean priority across all divisions, highest first.'
          }
          height={Math.max(240, rows.slice(0, 10).length * 34 + 60)}
        />
      ) : (
        <Card title="Widest workforce gaps">
          {gaps.loading ? <Loading /> : <Empty>Nothing to rank for this selection.</Empty>}
        </Card>
      )}
    </div>
  );
}
