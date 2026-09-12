import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock, Sparkles, Trophy, Zap } from 'lucide-react';
import QuizResult from '../../components/QuizResult.jsx';
import QuizRunner from '../../components/QuizRunner.jsx';
import { Badge, Card, Empty, ErrorNote, Loading, StatTile } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints, formatDate, percent } from '../../lib/index.js';
import { attemptToRow, priorityToBand, quizSubmitToResult, quizToAttempt, scoreToLevel } from '../../lib/adapters.js';

export default function Quiz() {
  const { competencyId } = useParams();
  const navigate = useNavigate();
  const quizzesApi = useApi(endpoints.quizList);
  const gapsApi = useApi(endpoints.skillGaps);
  const history = useApi(endpoints.quizHistory);
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);

  const gapByCompetency = useMemo(() => {
    const map = new Map();
    for (const gap of gapsApi.data?.skillGaps ?? []) {
      map.set(String(gap.competencyId), gap);
    }
    return map;
  }, [gapsApi.data]);

  const start = useMutation(async (quizId) => {
    const payload = await api.get(endpoints.quizDetail(quizId));
    const quiz = payload?.quiz ?? payload;
    setResult(null);
    setAttempt(quizToAttempt(quiz));
    return quiz;
  });

  const submit = useMutation(async (answers) => {
    const payload = await api.post(endpoints.quizSubmit(attempt.quizId), {
      answers: answers.map((answer) => ({
        questionId: answer.question,
        selectedIndex: answer.option === null || answer.option === undefined ? -1 : Number(answer.option),
      })),
    });
    setResult(quizSubmitToResult(payload));
    setAttempt(null);
    gapsApi.refetch();
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

  if (quizzesApi.loading) return <Loading label="Loading published quizzes" />;

  const all = quizzesApi.data?.items ?? [];
  // Quizzes matched to the officer's open gaps float to the top; a deep link
  // (/quiz/:competencyId) filters to that competency's quizzes first.
  const withMatches = all.map((quiz) => {
    const matched = (quiz.competencyIds ?? [])
      .map((id) => gapByCompetency.get(String(id)))
      .find(Boolean);
    return { quiz, matched };
  });
  const preselected = competencyId
    ? withMatches.filter(({ quiz }) => (quiz.competencyIds ?? []).map(String).includes(String(competencyId)))
    : [];
  const choices = (preselected.length ? preselected : withMatches).sort(
    (a, b) => Number(Boolean(b.matched)) - Number(Boolean(a.matched)),
  );
  const results = (history.data?.attempts ?? []).map(attemptToRow);

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

      <ErrorNote error={quizzesApi.error ?? start.error} onRetry={quizzesApi.refetch} />

      {!choices.length && (
        <Card>
          <Empty>
            No published quizzes yet. Trainers publish them from the question bank.
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

      {/* ── Quiz Cards ─────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {choices.map(({ quiz, matched }) => (
          <Card key={quiz._id ?? quiz.id} className="card-hover">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[15px] font-bold text-ink">{quiz.title}</h2>
                  {matched && <Badge band={priorityToBand(matched.priority)} />}
                </div>
                <p className="text-xs text-ink-2">
                  {(quiz.topics ?? []).slice(0, 3).join(' · ') || 'General'} · {quiz.questionCount ?? quiz.questions?.length ?? 0} questions
                </p>
                {matched && (
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Matches your {matched.competencyName} gap (Level {scoreToLevel(matched.currentScore)} → needs {scoreToLevel(matched.requiredScore)}).
                  </p>
                )}
              </div>
              {matched ? (
                <div className="flex flex-col items-end gap-2">
                  <span className="pill pill-ai">
                    Gap match
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-hairline">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Clock size={14} /> ~{quiz.durationMinutes ?? 10} min
                </span>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <BarChart3 size={14} /> 70% pass
                </span>
              </div>

              <button
                type="button"
                className="btn btn-primary !text-xs flex items-center gap-2"
                disabled={start.loading}
                onClick={() => start.run(quiz._id ?? quiz.id)}
              >
                <Sparkles size={14} />
                {start.loading ? 'Preparing questions…' : 'Start Quiz'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Past Attempts Table ──────────────────────────── */}
      {results.length > 0 && (
        <Card title="Past Attempts">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-2">
                  <th className="py-3 pr-4 font-semibold">Quiz</th>
                  <th className="py-3 pr-4 font-semibold">Score</th>
                  <th className="py-3 pr-4 font-semibold">Outcome</th>
                  <th className="py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {results.map((entry) => (
                  <tr key={entry._id} className="border-b border-hairline last:border-0">
                    <td className="py-3 pr-4 font-medium">{entry.quizTitle}</td>
                    <td className="py-3 pr-4 font-bold text-primary">{percent(entry.scoreRatio)}</td>
                    <td className="py-3 pr-4">
                      {entry.passed ? (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--status-good)' }}>
                          <CheckCircle2 size={14} />
                          Passed
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
