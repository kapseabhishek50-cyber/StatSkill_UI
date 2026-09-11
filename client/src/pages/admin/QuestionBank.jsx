import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Filter, GraduationCap } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading, Badge } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api } from '../../lib/api.js';
import { levelText } from '../../lib/format.js';

export default function QuestionBank() {
  const [competency, setCompetency] = useState('');
  const [reviewStatus, setReviewStatus] = useState('all');
  const [level, setLevel] = useState('');
  const generate = useMutation(async () => api.post('/admin/questions/generate', {
    competency,
    targetLevel: Number(level),
    count: 10,
  }));

  const competenciesQuery = useApi('/competencies');
  
  const query = new URLSearchParams();
  if (competency) query.set('competency', competency);
  if (reviewStatus && reviewStatus !== 'all') query.set('reviewStatus', reviewStatus);
  if (level) query.set('level', level);
  const queryString = query.toString() ? `?${query.toString()}` : '';

  const { data, loading, error, refetch } = useApi(`/admin/questions${queryString}`, {
    deps: [competency, reviewStatus, level],
  });

  const updateStatus = useMutation(async ({ id, status }) => {
    await api.patch(`/admin/questions/${id}`, { reviewStatus: status });
  });

  const handleStatusChange = async (id, status) => {
    try {
      await updateStatus.run({ id, status });
      refetch();
    } catch (err) {
      // Error handled by mutation hook
    }
  };

  const handleGenerate = async () => {
    try {
      await generate.run();
      refetch();
    } catch (_error) {
      // Error is displayed by the mutation hook.
    }
  };

  const questions = data?.questions ?? [];
  const compList = competenciesQuery.data?.competencies ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Question bank</h1>
        <p className="mt-1 text-sm text-ink-2">Review and validate AI-generated assessment questions.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
        <div>
          <label htmlFor="competency" className="label">Competency</label>
          <select
            id="competency"
            className="field mt-1 w-64"
            value={competency}
            onChange={(e) => setCompetency(e.target.value)}
          >
            <option value="">All competencies</option>
            {compList.map((comp) => (
              <option key={comp._id} value={comp._id}>
                {comp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reviewStatus" className="label">Review Status</label>
          <select
            id="reviewStatus"
            className="field mt-1 w-48"
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label htmlFor="level" className="label">Target Level</label>
          <select
            id="level"
            className="field mt-1 w-32"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <option key={lvl} value={lvl}>Level {lvl}</option>
            ))}
          </select>
        </div>
      </div>

      <ErrorNote error={error || updateStatus.error || generate.error || competenciesQuery.error} onRetry={error || updateStatus.error || generate.error ? refetch : competenciesQuery.refetch} />

      <div className="flex items-center justify-between rounded-card border border-hairline bg-surface px-4 py-3">
        <p className="text-xs text-ink-2">Generate a validated batch for the selected competency and level.</p>
        <button type="button" className="btn-primary text-xs" disabled={!competency || !level || generate.loading} onClick={handleGenerate}>
          {generate.loading ? 'Generating…' : 'Generate 10 questions'}
        </button>
      </div>

      {loading ? (
        <Card><Loading label="Loading questions" /></Card>
      ) : questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((q) => {
            let statusBand = 'low'; // Default good
            if (q.reviewStatus === 'pending') statusBand = 'moderate';
            if (q.reviewStatus === 'rejected') statusBand = 'critical';

            return (
              <Card key={q._id} className="relative">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <GraduationCap size={16} className="text-ink-muted" />
                      {q.competency?.name || 'Unknown Competency'}
                      <span className="text-xs font-normal text-ink-2 ml-2">
                        {levelText(q.level)}
                      </span>
                    </h3>
                  </div>
                  <Badge band={statusBand}>{q.reviewStatus}</Badge>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-ink">{q.stem}</p>
                  
                  <div className="space-y-2">
                    {q.options?.map((opt, i) => {
                      const isCorrect = i === q.correctIndex;
                      return (
                        <div 
                          key={i}
                          className={`flex items-start gap-2 p-2 rounded-button text-[13px] duration-200 ${
                            isCorrect ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 size={16} className="mt-0.5 text-[var(--status-good)] shrink-0" />
                          ) : (
                            <div className="w-4 h-4 mt-0.5 border border-hairline rounded-full shrink-0" />
                          )}
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-4 p-3 rounded-button bg-plane border border-hairline text-[13px] text-ink-2">
                      <strong className="text-ink text-xs uppercase block mb-1">Explanation</strong>
                      {q.explanation}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-hairline mt-4">
                    <div className="flex gap-6 text-xs text-ink-muted">
                      <span>Served: {q.stats?.served || 0} times</span>
                      <span>Correct: {q.stats?.correct || 0} times</span>
                      <span>
                        Accuracy:{' '}
                        {q.stats?.served > 0 
                          ? Math.round((q.stats.correct / q.stats.served) * 100) + '%'
                          : '—'}
                      </span>
                    </div>

                    {q.reviewStatus === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-quiet !text-[13px] !text-critical hover:!bg-red-50"
                          onClick={() => handleStatusChange(q._id, 'rejected')}
                          disabled={updateStatus.loading}
                        >
                          <XCircle size={15} />
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary !text-[13px]"
                          onClick={() => handleStatusChange(q._id, 'approved')}
                          disabled={updateStatus.loading}
                        >
                          <CheckCircle2 size={15} />
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty>No questions match your filters. Questions are generated when learners start quizzes.</Empty>
        </Card>
      )}
    </div>
  );
}
