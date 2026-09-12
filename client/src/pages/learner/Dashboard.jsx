import { useMemo } from 'react';
import {
  ArrowRight,
  Flame,
  Zap,
  Clock,
  Sparkles,
  Play,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Route as RouteIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CompetencyMeter from '../../components/CompetencyMeter.jsx';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { CountUp, Reveal, Tilt3DCard } from '../../components/fx/index.js';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { endpoints } from '../../lib/index.js';
import {
  enrollmentStats,
  enrollmentToItem,
  gapToRow,
  narrativeFromGaps,
  readinessFromGaps,
} from '../../lib/adapters.js';

const CARD_IMAGES = [
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gapsApi = useApi(endpoints.skillGaps);
  const requirementsApi = useApi(endpoints.myRequirements);
  const mine = useApi(endpoints.myCompetencies);
  const myLearning = useApi(endpoints.myLearning);

  const mandatoryIds = useMemo(
    () =>
      new Set(
        (requirementsApi.data?.requirements ?? [])
          .filter((entry) => entry.mandatory)
          .map((entry) => String(entry.competency?._id ?? entry.competency)),
      ),
    [requirementsApi.data],
  );

  const gaps = useMemo(
    () => (gapsApi.data?.skillGaps ?? []).map((gap) => gapToRow(gap, mandatoryIds)),
    [gapsApi.data, mandatoryIds],
  );
  const openGaps = gaps.filter((row) => row.gap > 0);
  const readiness = useMemo(() => readinessFromGaps(gapsApi.data?.skillGaps ?? []), [gapsApi.data]);
  const narrative = useMemo(() => narrativeFromGaps(gapsApi.data?.skillGaps ?? []), [gapsApi.data]);

  const held = mine.data?.competencies ?? [];
  const enrollments = useMemo(
    () => (myLearning.data?.items ?? []).map(enrollmentToItem),
    [myLearning.data],
  );
  const stats = useMemo(() => enrollmentStats(enrollments), [enrollments]);

  if (gapsApi.loading) return <Loading label="Analyzing your learning profile & gaps" />;

  const role = requirementsApi.data?.role;

  if (gapsApi.error?.status === 404 || (!requirementsApi.loading && !role)) {
    return (
      <div className="space-y-5 max-w-3xl animate-enter">
        <div>
          <h1 className="text-h1 font-bold text-ink">Welcome, {user?.name?.split(' ')[0] ?? 'Learner'}</h1>
          <p className="mt-1 text-[13px] text-ink-2">Complete your role setup to unlock personalized AI recommendations.</p>
        </div>
        <Card title="Set up your Statistical Profile" subtitle="Assign your designation. StatSkill AI uses it to automatically map your role's competency requirements.">
          <Link to="/profile" className="btn btn-primary inline-flex items-center gap-2">
            Open Profile Setup <ArrowRight size={15} />
          </Link>
        </Card>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] ?? 'Learner';

  return (
    <div className="space-y-6">
      {/* ── 1. Welcome & Headline Section ────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 animate-enter">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">
            Good morning, {firstName}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            You&apos;re making great progress. Keep your learning streak alive today.
          </p>
        </div>

        <button
          onClick={() => navigate('/assistant')}
          className="btn btn-primary self-start md:self-auto flex items-center gap-2"
        >
          <Sparkles size={15} />
          Ask StatSkill AI
        </button>
      </div>

      <ErrorNote
        error={gapsApi.error ?? mine.error ?? myLearning.error}
        onRetry={gapsApi.error ? gapsApi.refetch : mine.error ? mine.refetch : myLearning.refetch}
      />

      {/* ── 2. Four Metric Tiles — 3D tilt + count-up, staggered on scroll ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: '1200px' }}>
        {/* Streak */}
        <Reveal variant="flip-3d" delay={0}>
        <Tilt3DCard max={8} className="metric-tile h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="label">Current Streak</span>
            <span className="icon-chip"><Flame size={16} strokeWidth={1.8} /></span>
          </div>
          <p className="tnum mt-2 text-[26px] font-bold tracking-tight text-ink"><CountUp end={user?.currentStreak ?? 0} /> <span className="text-[13px] font-medium text-ink-muted">days</span></p>
          <p className="mt-1.5 text-xs font-semibold text-streak">
            Keep learning today
          </p>
        </Tilt3DCard>
        </Reveal>

        {/* XP */}
        <Reveal variant="flip-3d" delay={90}>
        <Tilt3DCard max={8} className="metric-tile h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="label">Experience Points</span>
            <span className="icon-chip"><Zap size={16} strokeWidth={1.8} /></span>
          </div>
          <p className="tnum mt-2 text-[26px] font-bold tracking-tight text-ink"><CountUp end={user?.xp ?? 0} /></p>
          <p className="mt-1.5 text-xs font-semibold text-primary">
            Level {user?.level ?? 1} · earn more daily
          </p>
        </Tilt3DCard>
        </Reveal>

        {/* Learning Hours */}
        <Reveal variant="flip-3d" delay={180}>
        <Tilt3DCard max={8} className="metric-tile h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="label">Learning Hours</span>
            <span className="icon-chip"><Clock size={16} strokeWidth={1.8} /></span>
          </div>
          <p className="tnum mt-2 text-[26px] font-bold tracking-tight text-ink"><CountUp end={stats.totalHours} decimals={1} /><span className="text-[13px] font-medium text-ink-muted">h</span></p>
          <p className="mt-1.5 text-xs font-medium text-ink-muted">
            Across {stats.total} enrolled course{stats.total === 1 ? '' : 's'}
          </p>
        </Tilt3DCard>
        </Reveal>

        {/* Role Readiness */}
        <Reveal variant="flip-3d" delay={270}>
        <Tilt3DCard max={8} className="metric-tile h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="label">Role Readiness</span>
            <span className="icon-chip"><TrendingUp size={16} strokeWidth={1.8} /></span>
          </div>
          <p className="tnum mt-2 text-[26px] font-bold tracking-tight text-ink">
            <CountUp end={Math.round(readiness * 100)} suffix="%" />
          </p>
          <p className="mt-1.5 text-xs font-semibold text-good flex items-center gap-1">
            <CheckCircle2 size={12} /> Target: 80%+ required
          </p>
        </Tilt3DCard>
        </Reveal>
      </div>

      {/* ── 3. Learning Insight Banner ────────────────────────── */}
      {narrative?.summary && (
        <div className="card-ai p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-enter-2">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                Learning Insight
              </h2>
            </div>
            <p className="text-[13px] font-medium text-ink leading-relaxed">
              &ldquo;{narrative.summary}&rdquo;
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/path" className="btn btn-primary !text-xs">
              View Learning Path
            </Link>
            <Link to="/assistant" className="btn btn-quiet !text-xs">
              Ask AI
            </Link>
          </div>
        </div>
      )}

      {/* ── 4. Continue Learning ─────────────────────────────────── */}
      <section className="space-y-3.5 animate-enter-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-h2 font-bold text-ink">Continue Learning</h2>
            <p className="text-xs text-ink-muted">Pick up right where you left off</p>
          </div>
          <Link to="/my-learning" className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5">
            View All Courses <ChevronRight size={14} />
          </Link>
        </div>

        {enrollments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.slice(0, 3).map((item, index) => (
              <div key={item._id} className="course-card group">
                <div className="relative h-36 w-full overflow-hidden bg-surface-3">
                  <img
                    src={item.course?.imageUrl || CARD_IMAGES[index % CARD_IMAGES.length]}
                    alt={item.course?.title}
                    className="course-card-image h-full w-full object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,59,120,0) 40%, rgba(6,59,120,0.55) 100%)' }} />
                  <span className={`absolute top-2.5 left-2.5 pill text-[11px] ${item.status === 'completed' ? 'pill-success !bg-white' : 'pill-ai'}`}>
                    {item.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                  <span className="absolute bottom-2.5 right-3 text-[11px] font-medium text-white/90">
                    {item.course?.durationHours ?? 4}h total
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">{item.course?.provider}</span>
                    <h3 className="text-[14px] font-bold text-ink group-hover:text-primary transition-colors duration-200">
                      {item.course?.title}
                    </h3>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-ink-2 font-medium">
                      <span>Progress</span>
                      <span className="tnum text-primary font-bold">{item.progressPct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${item.progressPct}%` }} />
                    </div>
                  </div>

                  <a
                    href={item.course?.externalUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary w-full !text-xs justify-center"
                  >
                    <Play size={13} />
                    {item.status === 'completed' ? 'Review Course' : 'Continue Learning'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <Empty
              title="No enrolled courses yet"
              description="Your personalized learning path has courses matched to your widest gaps."
              action={
                <Link to="/path" className="btn btn-primary !text-xs inline-flex items-center gap-2">
                  <RouteIcon size={14} /> View Learning Path
                </Link>
              }
            />
          </Card>
        )}
      </section>

      {/* ── 5. Priority Skill Gaps & Competency Breakdown ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-enter-3">
        {/* Left 7 cols: Ranked High Impact Skill Gaps */}
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h2 font-bold text-ink">Your Top Skill Gaps</h2>
              <p className="text-xs text-ink-muted">Calculated against your official role requirements</p>
            </div>
            <Link to="/assessment" className="btn btn-quiet !text-xs shrink-0">
              Re-take Assessment
            </Link>
          </div>

          <div className="space-y-2.5">
            {openGaps.length > 0 ? (
              openGaps.slice(0, 4).map((item, idx) => (
                <div
                  key={item.competencyId}
                  className="card card-hover !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-button bg-plane border border-hairline text-[13px] font-bold text-ink-2">
                      0{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[13px] font-bold text-ink">{item.name}</h4>
                        {item.mandatory && (
                          <span className="pill pill-danger text-[10px]">Mandatory</span>
                        )}
                      </div>
                      <p className="tnum text-xs text-ink-muted mt-0.5">
                        Current: Level {item.currentLevel} · Required: Level {item.requiredLevel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pl-11 sm:pl-0">
                    <div className="text-right hidden sm:block">
                      <span className="tnum text-xs font-bold text-critical">-{item.gap} Level Gap</span>
                      <p className="text-[11px] text-ink-muted capitalize">Priority: {item.band}</p>
                    </div>
                    <Link
                      to={`/quiz/${item.competencyId}`}
                      className="btn btn-primary !text-xs shrink-0"
                    >
                      Improve Skill →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <Card>
                <Empty
                  title="No Open Skill Gaps"
                  description="You meet or exceed all current requirements for your role!"
                />
              </Card>
            )}
          </div>
        </div>

        {/* Right 5 cols: Live Competency Record Meter */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h2 font-bold text-ink">Competency Profile</h2>
              <p className="text-xs text-ink-muted">0–5 Level Scale</p>
            </div>
            <Link to="/progress" className="text-xs font-semibold text-primary hover:underline">
              Full Analytics
            </Link>
          </div>

          <div className="card !p-5 space-y-3.5">
            {held.length > 0 ? (
              held.slice(0, 6).map((entry) => {
                const requirement = gaps.find((row) => row.competencyId === String(entry.competency?._id));
                return (
                  <CompetencyMeter
                    key={entry.competency?._id ?? entry.competency}
                    name={entry.competency?.name}
                    category={entry.competency?.category}
                    currentLevel={entry.currentLevel}
                    requiredLevel={requirement?.requiredLevel ?? null}
                  />
                );
              })
            ) : (
              <Empty
                title="No Competency Records"
                description="Start with your initial self-assessment to populate your profile."
                action={
                  <Link to="/assessment" className="btn btn-primary !text-xs">
                    Start Assessment
                  </Link>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
