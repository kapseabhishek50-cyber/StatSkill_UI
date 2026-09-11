import {
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import CompetencyMeter from '../../components/CompetencyMeter.jsx';
import { Card, Empty, ErrorNote, Loading, StatTile } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { endpoints, formatDate, levelLabel } from '../../lib/index.js';

export default function Progress() {
  const mine = useApi(endpoints.myCompetencies);
  const quizzes = useApi(endpoints.quizHistory);
  const path = useApi(endpoints.recommendations);

  if (mine.loading || quizzes.loading || path.loading) {
    return <Loading label="Compiling verified competency analytics" />;
  }

  const held = mine.data?.competencies ?? [];
  const results = quizzes.data?.results ?? [];
  const gaps = path.data?.gaps ?? [];

  const passedQuizzes = results.filter((r) => r.passed);
  const totalVerifiedLevels = passedQuizzes.length;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-ink">
          Competency Progress & Analytics
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Real-time record of all verified skills, historical improvements, and assessment milestones.
        </p>
      </div>

      {/* ── Stat Tiles ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Skills Tracked"
          value={held.length}
          hint="Across MoSPI domains"
          icon={ShieldCheck}
        />
        <StatTile
          label="Levels Verified"
          value={totalVerifiedLevels}
          delta={totalVerifiedLevels > 0 ? `+${totalVerifiedLevels} this year` : null}
          icon={Award}
        />
        <StatTile
          label="Quizzes Cleared"
          value={passedQuizzes.length}
          hint={`${results.length} total attempts`}
          icon={CheckCircle2}
        />
        <StatTile
          label="Average Mastery"
          value={held.length ? (held.reduce((acc, c) => acc + c.currentLevel, 0) / held.length).toFixed(1) : '0.0'}
          hint="Out of 5.0 scale"
          icon={Zap}
        />
      </div>

      {/* ── Competencies Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 font-bold text-ink">Verified Competency Records</h2>
            <span className="text-xs text-ink-muted">{held.length} competencies registered</span>
          </div>

          <div className="card !p-5 space-y-4">
            {held.map((entry) => {
              const req = gaps.find((g) => g.competencyId === String(entry.competency?._id));
              return (
                <div key={entry.competency?._id ?? entry.competency} className="space-y-1">
                  <CompetencyMeter
                    name={entry.competency?.name}
                    category={entry.competency?.category}
                    currentLevel={entry.currentLevel}
                    requiredLevel={req?.requiredLevel ?? null}
                  />
                  {entry.lastAssessmentAt && (
                    <p className="text-[11px] text-ink-muted">
                      Last validated via quiz on {formatDate(entry.lastAssessmentAt)}
                    </p>
                  )}
                </div>
              );
            })}

            {held.length === 0 && (
              <Empty
                title="No Competencies Found"
                description="Complete your initial role assessment to start tracking skill progress."
              />
            )}
          </div>
        </div>

        {/* Recent Improvements Timeline */}
        <div className="lg:col-span-5 space-y-3.5">
          <h2 className="text-h2 font-bold text-ink">Recent Improvements</h2>

          <div className="card !p-5 space-y-3.5">
            {passedQuizzes.slice(0, 5).map((q) => (
              <div key={q._id} className="flex items-start gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0">
                <div className="icon-chip mt-0.5">
                  <ArrowUpRight size={16} />
                </div>
                <div className="space-y-0.5 flex-1">
                  <p className="text-[13px] font-bold text-ink">{q.competency?.name || 'Skill Assessment'}</p>
                  <p className="text-xs text-ink-2">
                    Advanced to Level {q.targetLevel} · Score: {q.scorePct}%
                  </p>
                  <p className="text-[11px] text-ink-muted">{formatDate(q.createdAt)}</p>
                </div>
              </div>
            ))}

            {passedQuizzes.length === 0 && (
              <Empty
                title="No Quiz Records Yet"
                description="Pass your first competency quiz to see verified level increments here."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
