import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GraduationCap, Trophy, Clock, Zap, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';
import QuizResult from '../../components/QuizResult.jsx';
import QuizRunner from '../../components/QuizRunner.jsx';
import { Badge, Card, Empty, ErrorNote, Loading, StatTile } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints, formatDate, levelLabel, percent } from '../../lib/index.js';

export default function Quiz() {
  const { competencyId } = useParams();
  const navigate = useNavigate();
  const path = useApi(endpoints.recommendations);
  const history = useApi(endpoints.quizHistory);
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);

  const start = useMutation(async ({ competency, targetLevel }) => {
    const payload = await api.post(endpoints.quizStart, { competency, targetLevel });
    setResult(null);
    setAttempt(payload);
    return payload;
  });

  const submit = useMutation(async (answers) => {
    const payload = await api.post(endpoints.quizSubmit, { attemptId: attempt.attemptId, answers });
    setResult(payload.result);
    setAttempt(null);
    path.refetch();
    history.refetch();
    return payload;
  });

  if (result) {
    return (
      <QuizResult
        result={result}
        onRetake={() => {
          setResult(null);
          navigate('/quiz');
        }}
      />
    );
  }

  if (attempt) {
    return (
      <QuizRunner
        attempt={attempt}
        onSubmit={(answers) => submit.run(answers)}
        submitting={submit.loading}
        error={submit.error}
      />
    );
  }

  if (path.loading) return <Loading label="Loading your competencies" />;

  const items = path.data?.path ?? [];
  const preselected = competencyId ? items.filter((item) => item.competencyId === competencyId) : items;
  const choices = preselected.length ? preselected : items;
  const results = history.data?.results ?? [];

  const pastQuizzes = results.filter((r) => r.passed || r.scorePct);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-ink">
          Competency Quizzes
        </h1>
        <p className="mt-0.5 max-w-2xl text-[13px] text-ink-2">
          A quiz is how a level gets recorded. Clearing one at 70% replaces a self-rating with an
          assessed level and recomputes your path; falling short leaves your record unchanged.
        </p>
      </div>

      <ErrorNote error={path.error ?? start.error} onRetry={path.refetch} />

      {!choices.length && (
        <Card>
          <Empty>
            No competencies to test yet. Complete the self-assessment first.
          </Empty>
        </Card>
      )}

      {/* ── Quick Stats ──────────────────────────────────── */}
      {pastQuizzes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Quizzes Taken" value={results.length} icon={Trophy} />
          <StatTile
            label="Best Accuracy"
            value={`${Math.max(...results.map((r) => r.scoreRatio * 100)).toFixed(0)}%`}
            icon={BarChart3}
          />
          <StatTile label="Levels Passed" value={results.filter((r) => r.passed).length} icon={Trophy} />
          <StatTile label="Avg Score" value={`${(results.reduce((acc, r) => acc + r.scoreRatio, 0) / results.length * 100).toFixed(0)}%`} icon={Zap} />
        </div>
      )}

      {/* ── Competency Quiz Cards ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {choices.map((item) => {
          const level = Math.min(item.currentLevel + 1, item.requiredLevel);
          return (
            <Card key={item.competencyId} className="card-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-bold text-ink">{item.competency?.name}</h2>
                    <Badge band={item.band} />
                  </div>
                  <p className="text-xs text-ink-2">
                    Current Level {item.currentLevel} · Role needs Level {item.requiredLevel}
                  </p>
                  {item.explanation && (
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">{item.explanation}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="pill pill-primary">
                    Next: Level {level}
                  </span>
                  <span className="text-xs text-ink-muted">{levelLabel(level)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-hairline">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Clock size={14} /> ~30 min
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <BarChart3 size={14} /> 70% pass
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary !text-xs flex items-center gap-2"
                  disabled={start.loading}
                  onClick={() => start.run({ competency: item.competencyId, targetLevel: level })}
                >
                  <Sparkles size={14} />
                  {start.loading ? 'Preparing questions…' : `Start Level ${level} Quiz`}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Past Attempts Table ──────────────────────────── */}
      {results.length > 0 && (
        <Card title="Past Attempts">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-2">
                  <th className="py-3 pr-4 font-semibold">Competency</th>
                  <th className="py-3 pr-4 font-semibold">Level</th>
                  <th className="py-3 pr-4 font-semibold">Score</th>
                  <th className="py-3 pr-4 font-semibold">Outcome</th>
                  <th className="py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {results.map((entry) => (
                  <tr key={entry._id} className="border-b border-hairline last:border-0">
                    <td className="py-3 pr-4 font-medium">{entry.competency?.name ?? '—'}</td>
                    <td className="py-3 pr-4">{entry.targetLevel}</td>
                    <td className="py-3 pr-4 font-bold text-primary">{percent(entry.scoreRatio)}</td>
                    <td className="py-3 pr-4">
                      {entry.passed ? (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--status-good)' }}>
                          <CheckCircle2 size={14} />
                          {entry.levelBefore} → {entry.levelAfter}
                        </span>
                      ) : (
                        <span className="text-ink-muted">Not recorded</span>
                      )}
                    </td>
                    <td className="py-3">{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}