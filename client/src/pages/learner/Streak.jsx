import {
  Flame,
  Zap,
  Award,
  Lock,
  CheckCircle2,
  Star,
  Trophy,
  Target
} from 'lucide-react';
import { Card } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Streak() {
  const { user } = useAuth();

  const currentStreak = user?.currentStreak ?? 7;
  const longestStreak = 21;
  const xp = user?.xp ?? 2480;
  const totalDays = 87;

  // 60-day activity simulation
  const days = Array.from({ length: 60 }).map((_, i) => {
    // Recent 7 days active, scattered activity before
    const isActive = i > 52 || (i % 3 === 0) || (i % 7 === 2);
    return { day: i + 1, active: isActive };
  });

  const badges = [
    {
      id: 'b1',
      title: 'First Assessment',
      desc: 'Completed initial competency evaluation',
      unlocked: true,
      icon: Target,
    },
    {
      id: 'b2',
      title: '7-Day Streak',
      desc: 'Maintained 7 consecutive days of active learning',
      unlocked: true,
      icon: Flame,
    },
    {
      id: 'b3',
      title: 'Quiz Master',
      desc: 'Scored 100% on 3 consecutive competency quizzes',
      unlocked: true,
      icon: Award,
    },
    {
      id: 'b4',
      title: 'Course Explorer',
      desc: 'Enrolled in 5+ official NSSTA training modules',
      unlocked: true,
      icon: Star,
    },
    {
      id: 'b5',
      title: 'Skill Improver',
      desc: 'Upgraded 3 competencies to Level 3 or higher',
      unlocked: false,
      req: 'Upgrade 1 more competency',
      icon: Zap,
    },
    {
      id: 'b6',
      title: '30-Day Champion',
      desc: 'Complete a full month of continuous capacity building',
      unlocked: false,
      req: '23 days remaining',
      icon: Trophy,
    },
  ];

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

      {/* ── Main Streak Banner ─────────────────────────────────── */}
      <div className="card-ai p-5 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-card bg-surface border border-hairline">
            <Flame size={30} className="text-streak" strokeWidth={1.8} />
          </div>

          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h2 className="tnum text-[26px] font-bold text-ink">{currentStreak} Days</h2>
              <span className="pill pill-warning text-[11px]">Active Streak</span>
            </div>
            <p className="text-[13px] font-medium text-ink-2">
              Complete a quick quiz or module today to keep the streak going.
            </p>
          </div>
        </div>

        {/* Weekly Day Indicators */}
        <div className="flex items-center gap-1.5 bg-surface p-2.5 rounded-card border border-hairline">
          {weekDays.map((d, idx) => (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-ink-muted">{d}</span>
              <div
                className={`grid h-8 w-8 place-items-center rounded-button text-xs font-bold transition-all duration-200 ${
                  idx < 5
                    ? 'bg-primary text-white'
                    : 'bg-plane text-ink-muted border border-hairline'
                }`}
              >
                {idx < 5 ? <CheckCircle2 size={15} /> : '•'}
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
          <p className="text-xs text-streak font-medium mt-1">Personal Best: 21 Days</p>
        </div>
        <div className="metric-tile">
          <span className="label">Longest Streak</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{longestStreak} Days</p>
          <p className="text-xs text-ink-muted mt-1">Set in Aug 2026</p>
        </div>
        <div className="metric-tile">
          <span className="label">Total XP</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{xp}</p>
          <p className="text-xs text-primary font-medium mt-1">Rank: Top 5% in Cadre</p>
        </div>
        <div className="metric-tile">
          <span className="label">Active Days</span>
          <p className="tnum text-[22px] font-bold text-ink mt-1.5">{totalDays}</p>
          <p className="text-xs text-good font-medium mt-1">82% Consistency</p>
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

        <div className="flex flex-wrap gap-1.5 pt-1">
          {days.map((d) => (
            <div
              key={d.day}
              title={`Day ${d.day}: ${d.active ? 'Activity recorded' : 'No activity'}`}
              className={`h-5 w-5 rounded transition-all duration-200 cursor-pointer ${
                d.active
                  ? 'bg-primary'
                  : 'bg-surface-2 border border-hairline'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Badges & Achievements Grid ──────────────────────────── */}
      <div className="space-y-3.5">
        <h3 className="text-h2 font-bold text-ink">Earned Badges & Milestones</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className={`card card-hover !p-5 flex items-start gap-3.5 transition-all duration-200 ${
                  b.unlocked
                    ? 'border-primary-border'
                    : 'opacity-70'
                }`}
              >
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-button ${
                    b.unlocked
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-ink-muted border border-hairline'
                  }`}
                >
                  {b.unlocked ? <Icon size={20} strokeWidth={1.8} /> : <Lock size={18} />}
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
                  {!b.unlocked && b.req && (
                    <p className="text-[11px] font-semibold text-primary pt-0.5">
                      Requirement: {b.req}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
