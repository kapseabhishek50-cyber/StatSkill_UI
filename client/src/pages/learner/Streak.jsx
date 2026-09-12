import {
  Flame,
  Zap,
  Award,
  Lock,
  CheckCircle2,
  Trophy,
} from 'lucide-react';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { endpoints, formatDate } from '../../lib/index.js';
import { achievementsToBadges, activityToHeatmap } from '../../lib/adapters.js';

export default function Streak() {
  const { user } = useAuth();
  const streakApi = useApi(endpoints.gamificationStreak);
  const badgesApi = useApi(endpoints.gamificationBadges);
  const allBadgesApi = useApi(endpoints.achievementsAll);
  const activityApi = useApi(endpoints.activity);

  if (streakApi.loading) return <Loading label="Loading your streak & badges" />;

  const streak = streakApi.data?.streak ?? {};
  const currentStreak = streak.currentStreak ?? user?.currentStreak ?? 0;
  const longestStreak = streak.longestStreak ?? 0;
  const totalDays = streak.totalLearningDays ?? 0;
  const xp = user?.xp ?? 0;

  const cells = activityToHeatmap(activityApi.data?.activities ?? [], 60);
  const activeCells = cells.filter((c) => c.active);
  const consistency = cells.length ? Math.round((activeCells.length / cells.length) * 100) : 0;

  const badges = achievementsToBadges(
    allBadgesApi.data?.achievements ?? [],
    badgesApi.data?.unlocked ?? [],
  );

  // This week's day indicators, Monday-first.
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const activeDays = new Set(cells.filter((c) => c.active).map((c) => c.day));
  const weekCells = weekDays.map((label, idx) => {
    const date = new Date(today);
    date.setDate(date.getDate() - mondayOffset + idx);
    const key = date.toISOString().slice(0, 10);
    const isFuture = idx > mondayOffset;
    return { label, done: !isFuture && activeDays.has(key), isFuture };
  });

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-ink">
          Streaks & Gamification
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Daily consistency rewards, learning momentum, and career milestone badges.
        </p>
      </div>

      <ErrorNote error={streakApi.error ?? badgesApi.error} onRetry={streakApi.refetch} />

      {/* ── Main Streak Banner ─────────────────────────────────── */}
      <div className="card-ai p-5 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-card bg-surface border border-hairline">
            <Flame size={30} className="text-streak" strokeWidth={1.8} />
          </div>

          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h2 className="tnum text-[26px] font-bold text-ink">{currentStreak} Days</h2>
              <span className="pill pill-warning text-[11px]">{currentStreak > 0 ? 'Active Streak' : 'Start Today'}</span>
            </div>
            <p className="text-[13px] font-medium text-ink-2">
              Complete a quick quiz or module today to keep the streak going.
            </p>
          </div>
        </div>

        {/* Weekly Day Indicators */}
        <div className="flex items-center gap-1.5 bg-surface p-2.5 rounded-card border border-hairline">
          {weekCells.map((d) => (
            <div key={d.label} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-ink-muted">{d.label}</span>
              <div
                className={`grid h-8 w-8 place-items-center rounded-button text-xs font-bold transition-all duration-200 ${
                  d.done
                    ? 'bg-primary text-white'
                    : 'bg-plane text-ink-muted border border-hairline'
                }`}
              >
                {d.done ? <CheckCircle2 size={15} /> : '•'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Overview ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-tile">
          <span className="label">Current Streak</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{currentStreak} Days</p>
          <p className="text-xs text-streak font-medium mt-1">Personal Best: {longestStreak} Days</p>
        </div>
        <div className="metric-tile">
          <span className="label">Longest Streak</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{longestStreak} Days</p>
          <p className="text-xs text-ink-muted mt-1">
            {streak.lastActivityDate ? `Last active ${formatDate(streak.lastActivityDate)}` : 'No activity yet'}
          </p>
        </div>
        <div className="metric-tile">
          <span className="label">Total XP</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{xp}</p>
          <p className="text-xs text-primary font-medium mt-1">Level {user?.level ?? 1}</p>
        </div>
        <div className="metric-tile">
          <span className="label">Active Days</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{totalDays}</p>
          <p className="text-xs text-good font-medium mt-1">{consistency}% last 60 days</p>
        </div>
      </div>

      {/* ── 60-Day Activity Heatmap ─────────────────────────────── */}
      <div className="card !p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-card-title font-semibold text-ink">60-Day Activity Map</h3>
            <p className="text-xs text-ink-muted">Visual record of daily learning activity</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-surface-2 border border-hairline" />
            <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--seq-2)' }} />
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>More</span>
          </div>
        </div>

        {activityApi.loading ? (
          <Loading label="Loading activity" />
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {cells.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.active ? `${d.count} learning event${d.count === 1 ? '' : 's'}` : 'No activity'}`}
                className={`h-5 w-5 rounded transition-all duration-200 cursor-pointer ${
                  d.active
                    ? 'bg-primary'
                    : 'bg-surface-2 border border-hairline'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Badges & Achievements Grid ──────────────────────────── */}
      <div className="space-y-3.5">
        <h3 className="text-h2 font-bold text-ink">Earned Badges & Milestones</h3>

        {badges.length === 0 ? (
          <Card>
            <Empty title="No badges yet" description="Badges unlock as you assess, learn, and keep streaks." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`card card-hover !p-5 flex items-start gap-3.5 transition-all duration-200 ${
                  b.unlocked
                    ? 'border-primary-border'
                    : 'opacity-70'
                }`}
              >
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-button text-xl ${
                    b.unlocked
                      ? 'bg-primary-light border border-primary-border'
                      : 'bg-surface-2 text-ink-muted border border-hairline grayscale opacity-60'
                  }`}
                >
                  {b.unlocked ? <span aria-hidden="true">{b.icon}</span> : <Lock size={18} />}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[13px] font-bold text-ink">{b.title}</h4>
                    {b.unlocked ? (
                      <span className="pill pill-success text-[10px]">Unlocked</span>
                    ) : (
                      <span className="pill pill-neutral text-[10px]">Locked</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-2 leading-relaxed">{b.desc}</p>
                  {b.unlocked && b.xpReward > 0 && (
                    <p className="text-[11px] font-semibold text-primary pt-0.5 flex items-center gap-1">
                      <Zap size={11} /> +{b.xpReward} XP
                    </p>
                  )}
                  {!b.unlocked && b.req && (
                    <p className="text-[11px] font-semibold text-primary pt-0.5">
                      {b.req}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {badges.some((b) => b.unlocked) && (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Trophy size={13} className="text-primary" />
          <Award size={13} className="text-good" />
          {badges.filter((b) => b.unlocked).length} of {badges.length} badges unlocked — attempt quizzes and courses to earn more.
        </div>
      )}
    </div>
  );
}
