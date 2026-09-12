import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Sparkles, CheckCircle2, Users, ArrowRight } from 'lucide-react';
import { Card, Loading, ErrorNote, Empty } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';
import { materialToRow } from '../../lib/adapters.js';

export default function TrainerDashboard() {
  const analyticsApi = useApi(endpoints.trainerAnalytics);
  const materialsApi = useApi(endpoints.trainerMaterials);
  const quizzesApi = useApi(endpoints.trainerQuizzes);
  const [weaknesses, setWeaknesses] = useState([]);
  const [passRate, setPassRate] = useState(null);

  const quizzes = useMemo(() => {
    const full = quizzesApi.data?.items ?? quizzesApi.data?.quizzes ?? [];
    if (full.length) return full;
    return analyticsApi.data?.quizzes ?? [];
  }, [quizzesApi.data, analyticsApi.data]);

  // Per-quiz results feed the weakness radar (weakest topics first).
  useEffect(() => {
    let live = true;
    const withAttempts = quizzes.filter((q) => Number(q.attemptCount ?? q.attempts ?? 0) > 0);
    if (!withAttempts.length) {
      setWeaknesses([]);
      setPassRate(null);
      return () => { live = false; };
    }
    Promise.all(
      withAttempts.map((q) =>
        api.get(endpoints.trainerQuizResults(String(q._id ?? q.id))).catch(() => null),
      ),
    ).then((results) => {
      if (!live) return;
      const topicAgg = new Map();
      let passed = 0;
      let total = 0;
      for (const res of results) {
        if (!res) continue;
        for (const attempt of res.attempts ?? []) {
          total += 1;
          if (Number(attempt.score) >= 70) passed += 1;
        }
        for (const t of res.topicWeaknesses ?? []) {
          const cur = topicAgg.get(t.topic) ?? { correct: 0, total: 0, attempts: 0 };
          cur.correct += Math.round(((t.percent ?? 0) / 100) * (res.attempts?.length ?? 0));
          cur.total += res.attempts?.length ?? 0;
          cur.attempts += res.attempts?.length ?? 0;
          topicAgg.set(t.topic, cur);
        }
      }
      setPassRate(total ? Math.round((passed / total) * 100) : null);
      setWeaknesses(
        [...topicAgg.entries()]
          .map(([topic, v]) => ({
            competency: topic,
            category: 'quiz topics',
            avgScorePercent: v.total ? Math.round((v.correct / v.total) * 100) : 0,
            attempts: v.attempts,
          }))
          .sort((a, b) => a.avgScorePercent - b.avgScorePercent)
          .slice(0, 8),
      );
    });
    return () => { live = false; };
  }, [quizzes]);

  if (analyticsApi.loading || materialsApi.loading) {
    return <Loading label="Loading Trainer portal" />;
  }

  const materials = (materialsApi.data?.items ?? materialsApi.data?.materials ?? []).map(materialToRow);
  const totalQuestions = quizzes.reduce((sum, q) => sum + Number(q.questions?.length ?? q.questionCount ?? 0), 0);
  const totalEvaluations = quizzes.reduce((sum, q) => sum + Number(q.attemptCount ?? q.attempts ?? 0), 0);
  const overview = {
    publishedMaterials: materials.length,
    totalQuestions,
    totalEvaluations,
    averagePassRate: passRate === null ? '—' : `${passRate}%`,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-ink">Trainer & Assessment Portal</h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Curriculum authoring, AI-assisted question generation, and learner weakness evaluation.
          </p>
        </div>
        <Link
          to="/trainer/generator"
          className="btn btn-primary !text-xs"
        >
          <Sparkles size={16} />
          <span>Generate Quiz from Material</span>
        </Link>
      </div>

      <ErrorNote error={analyticsApi.error || materialsApi.error} />

      {/* KPI Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-tile !p-4">
          <div className="flex items-center justify-between">
            <span className="label">Training Documents</span>
            <FileText size={16} className="text-primary" />
          </div>
          <p className="tnum mt-1.5 text-[22px] font-bold text-ink">{overview.publishedMaterials}</p>
          <p className="mt-1 text-xs text-ink-2">PDF, DOCX & PPTX modules</p>
        </div>

        <div className="metric-tile !p-4">
          <div className="flex items-center justify-between">
            <span className="label">Question Bank Items</span>
            <Sparkles size={16} className="text-good" />
          </div>
          <p className="tnum mt-1.5 text-[22px] font-bold text-ink">{overview.totalQuestions}</p>
          <p className="mt-1 text-xs text-ink-2">Across {quizzes.length} quizzes</p>
        </div>

        <div className="metric-tile !p-4">
          <div className="flex items-center justify-between">
            <span className="label">Evaluations Conducted</span>
            <Users size={16} className="text-primary" />
          </div>
          <p className="tnum mt-1.5 text-[22px] font-bold text-ink">{overview.totalEvaluations}</p>
          <p className="mt-1 text-xs text-ink-2">Official competency attempts</p>
        </div>

        <div className="metric-tile !p-4">
          <div className="flex items-center justify-between">
            <span className="label">Assessment Pass Rate</span>
            <CheckCircle2 size={16} className="text-primary" />
          </div>
          <p className="tnum mt-1.5 text-[22px] font-bold text-ink">{overview.averagePassRate}</p>
          <p className="mt-1 text-xs text-ink-2">Passing threshold: 70%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Weakness Radar / Table */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title="Batch Weakness Radar"
            subtitle="Quiz topics with the lowest average scores, requiring curriculum intervention."
          >
            {weaknesses.length === 0 ? (
              <div className="pt-2">
                <Empty title="No attempts yet" description="Weaknesses appear here once learners attempt your quizzes." />
              </div>
            ) : (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-ink-2">
                      <th className="py-2.5 pr-3 font-medium">Competency Area</th>
                      <th className="py-2.5 pr-3 font-medium">Domain</th>
                      <th className="py-2.5 pr-3 font-medium text-right">Avg Score</th>
                      <th className="py-2.5 font-medium text-right">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-ink">
                    {weaknesses.map((w, i) => (
                      <tr key={i} className="hover:bg-plane transition-colors duration-200">
                        <td className="py-2.5 pr-3 font-semibold">{w.competency}</td>
                        <td className="py-2.5 pr-3 uppercase text-[10px] text-ink-muted">{w.category}</td>
                        <td className="py-2.5 pr-3 text-right">
                          <span
                            className={`pill ${
                              w.avgScorePercent < 60
                                ? 'pill-danger'
                                : 'pill-warning'
                            }`}
                          >
                            {w.avgScorePercent}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-ink-2">{w.attempts || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Uploaded Materials & Action Cards */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Uploaded Curriculum Materials" subtitle="Source documents used for question generation.">
            {materials.length === 0 ? (
              <Empty>No training materials uploaded yet.</Empty>
            ) : (
              <div className="space-y-2.5 pt-1">
                {materials.slice(0, 4).map((m) => (
                  <div
                    key={m._id}
                    className="flex items-center justify-between rounded-button border border-hairline p-3 hover:bg-plane transition-colors duration-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate">{m.title}</p>
                        <p className="text-[11px] text-ink-muted uppercase">{m.fileType} · {m.textLength?.toLocaleString()} chars</p>
                      </div>
                    </div>
                    <span className={`tnum text-[11px] font-bold shrink-0 ${m.status === 'READY' ? 'text-good' : 'text-warning'}`}>
                      {m.status || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-3 border-t border-hairline mt-3">
              <Link
                to="/trainer/generator"
                className="flex items-center justify-between text-xs font-semibold text-primary hover:underline"
              >
                <span>Upload a new module (.pdf, .pptx, .docx, .txt)</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
