import { Activity, Database, Users, BookOpen, GraduationCap, Landmark, MessageSquare, RefreshCw } from 'lucide-react';
import { CountUp, Reveal, Tilt3DCard } from '../fx/index.js';

/**
 * Platform numbers, read from the database on every page load and counted
 * up on scroll. When the API is unreachable the bundled snapshot is shown
 * and the badge says so — no fake "live" claim, no error either.
 */
export default function LiveStatsBand({ data, live, updatedAt }) {
  const stats = data?.stats ?? {};
  const cards = [
    { icon: Users, label: 'Officers onboarded', value: stats.officers ?? 0, suffix: '' },
    { icon: GraduationCap, label: 'Competencies mapped', value: stats.competencies ?? 0, suffix: '' },
    { icon: BookOpen, label: 'Courses in catalogue', value: stats.courses ?? 0, suffix: '' },
    { icon: Landmark, label: 'Departments & cadres', value: (stats.departments ?? 0) + (stats.jobRoles ?? 0), suffix: '' },
    { icon: Activity, label: 'Quizzes recorded', value: stats.quizzes ?? 0, suffix: '' },
    { icon: MessageSquare, label: 'Learning communities', value: stats.communities ?? 0, suffix: '' },
  ];

  const refreshedAt = updatedAt
    ? updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <section id="explore" className="relative scroll-mt-24 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="eyebrow">
              <Database size={13} />
              Platform pulse
            </span>
            <h2 className="mt-4 text-hero-mobile sm:text-[2rem] font-bold tracking-tight text-ink">
              The numbers you see are the numbers in the database.
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">
              This page fetches its statistics from the StatSkill API every time you open it — nothing on it is
              hard-coded copy.
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-pill border border-hairline bg-surface px-3.5 py-2">
            {live ? (
              <>
                <span className="live-dot" />
                <span className="text-xs font-semibold text-ink">LIVE · reading from MongoDB</span>
              </>
            ) : (
              <>
                <span className="live-dot live-dot-off" />
                <span className="text-xs font-semibold text-ink">Demo snapshot · API offline</span>
              </>
            )}
            {refreshedAt && (
              <span className="flex items-center gap-1 border-l border-hairline pl-2.5 text-[11px] text-ink-muted">
                <RefreshCw size={11} />
                <span className="tnum">{refreshedAt}</span>
              </span>
            )}
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {cards.map((card, index) => (
            <Reveal key={card.label} variant="flip-3d" delay={index * 90}>
              <Tilt3DCard max={11} className="h-full rounded-card-lg border border-hairline bg-surface p-5 shadow-card">
                <span className="icon-chip !w-9 !h-9">
                  <card.icon size={16} strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-[28px] font-bold leading-none tracking-tight text-ink">
                  <CountUp end={card.value} suffix={card.suffix} duration={1800} delay={index * 120} />
                </p>
                <p className="mt-2 text-[11.5px] font-medium leading-snug text-ink-muted">{card.label}</p>
              </Tilt3DCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
