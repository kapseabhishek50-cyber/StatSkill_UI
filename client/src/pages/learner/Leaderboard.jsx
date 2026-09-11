import { useState } from 'react';
import { Trophy, Flame, Zap, Search } from 'lucide-react';
import { Card, Loading, ErrorNote, Empty } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { endpoints } from '../../lib/index.js';

const RANK_BADGE = ['bg-navy text-white', 'bg-primary text-white', 'bg-primary-light text-primary border border-primary-border'];

export default function Leaderboard() {
  const [search, setSearch] = useState('');
  const leaderboardApi = useApi(endpoints.gamificationLeaderboard);

  if (leaderboardApi.loading) return <Loading label="Loading statistical capacity leaderboard" />;

  const leaders = leaderboardApi.data?.leaderboard ?? [];
  const filtered = leaders.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.department.toLowerCase().includes(search.toLowerCase()) ||
      l.employeeId.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="icon-chip">
            <Trophy size={16} strokeWidth={1.8} />
          </span>
          <h1 className="text-h1 font-bold text-ink">Workforce Capacity Leaderboard</h1>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-2">
          Recognizing verified learning hours, quiz completions, and active capacity building across MoSPI and State DES directorates.
        </p>
      </div>

      <ErrorNote error={leaderboardApi.error} onRetry={leaderboardApi.refetch} />

      {/* Top 3 Podium Cards */}
      {leaders.length >= 3 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Rank 2 */}
          <div className="card card-hover !p-5 text-center">
            <div className={`tnum mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-bold ${RANK_BADGE[1]}`}>
              2
            </div>
            <h4 className="mt-2.5 text-[13px] font-semibold text-ink truncate">{leaders[1].name}</h4>
            <p className="text-xs text-ink-2 truncate">{leaders[1].department}</p>
            <div className="tnum mt-2.5 inline-flex items-center gap-1.5 pill pill-neutral">
              <Zap size={12} className="text-primary" />
              {leaders[1].xp} XP
            </div>
          </div>

          {/* Rank 1 */}
          <div className="card card-hover !p-5 text-center border-primary-border sm:-translate-y-1" style={{ background: 'var(--primary-light)' }}>
            <div className={`tnum mx-auto flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${RANK_BADGE[0]}`}>
              1
            </div>
            <h4 className="mt-2.5 text-sm font-bold text-ink truncate">{leaders[0].name}</h4>
            <p className="text-xs text-ink-2 truncate">{leaders[0].department}</p>
            <div className="tnum mt-2.5 inline-flex items-center gap-1.5 pill pill-ai">
              <Zap size={12} />
              {leaders[0].xp} XP
            </div>
          </div>

          {/* Rank 3 */}
          <div className="card card-hover !p-5 text-center">
            <div className={`tnum mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-bold ${RANK_BADGE[2]}`}>
              3
            </div>
            <h4 className="mt-2.5 text-[13px] font-semibold text-ink truncate">{leaders[2].name}</h4>
            <p className="text-xs text-ink-2 truncate">{leaders[2].department}</p>
            <div className="tnum mt-2.5 inline-flex items-center gap-1.5 pill pill-neutral">
              <Zap size={12} className="text-primary" />
              {leaders[2].xp} XP
            </div>
          </div>
        </div>
      )}

      {/* Standings Table */}
      <Card
        title="Official Standings"
        action={
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-2.5 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search officer or division..."
              className="field w-full pl-8 !text-xs"
            />
          </div>
        }
      >
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-enterprise w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-2">
                  <th className="py-2.5 pr-3 font-medium">Rank</th>
                  <th className="py-2.5 pr-3 font-medium">Official</th>
                  <th className="py-2.5 pr-3 font-medium">Division</th>
                  <th className="py-2.5 pr-3 font-medium">Job Role</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Streak</th>
                  <th className="py-2.5 pr-3 font-medium text-right">Hours</th>
                  <th className="py-2.5 font-medium text-right">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-ink">
                {filtered.map((officer) => (
                  <tr
                    key={officer.id}
                    className={`transition-colors duration-200 ${
                      officer.isCurrentUser ? 'bg-primary-light font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      {officer.rank <= 3 ? (
                        <span className={`tnum inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${RANK_BADGE[officer.rank - 1]}`}>
                          {officer.rank}
                        </span>
                      ) : (
                        <span className="tnum text-ink-2">#{officer.rank}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold">{officer.name}</p>
                      <p className="text-[11px] text-ink-muted">{officer.employeeId}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-2">{officer.department}</td>
                    <td className="py-2.5 pr-3 text-ink-2">{officer.jobRole}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="tnum inline-flex items-center gap-1 font-semibold text-streak">
                        <Flame size={12} /> {officer.currentStreak}d
                      </span>
                    </td>
                    <td className="tnum py-2.5 pr-3 text-right text-ink-2">{officer.learningHours}h</td>
                    <td className="tnum py-2.5 text-right font-bold text-primary">{officer.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No results" description="No officers match your search." />
        )}
      </Card>
    </div>
  );
}
