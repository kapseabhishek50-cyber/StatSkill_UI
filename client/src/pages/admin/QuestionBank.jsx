import { useState } from 'react';
import { CheckCircle2, XCircle, GraduationCap, ChevronDown, Send, Archive } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading, Badge } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

const STATUS_BADGE = { DRAFT: 'moderate', PUBLISHED: 'low', ARCHIVED: null };

export default function QuestionBank() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [competencyCode, setCompetencyCode] = useState('');
  const [count, setCount] = useState(10);
  const [expanded, setExpanded] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reviewLoading, setReviewLoading] = useState(null);

  const competenciesQuery = useApi(endpoints.competencies);

  const query = new URLSearchParams();
  query.set('limit', '50');
  if (status && status !== 'all') query.set('status', status);
  if (search.trim()) query.set('q', search.trim());
  const queryString = `?${query.toString()}`;

  const { data, loading, error, refetch } = useApi(`${endpoints.adminQuestions}${queryString}`, {
    deps: [status, search],
  });

  const quizzes = data?.quizzes ?? [];
  const compList = competenciesQuery.data?.competencies ?? [];

  const generate = useMutation(async () => {
    const comp = compList.find((c) => c.code === competencyCode);
    return api.post(endpoints.trainerGenerateQuiz, {
      competencyCode,
      topic: comp?.name,
      count,
    });
  });

  const publish = useMutation(async (id) => api.post(endpoints.trainerPublishQuiz(id), {}));
  const archive = useMutation(async (id) => api.post(endpoints.trainerArchiveQuiz(id), {}));

  const handleGenerate = async () => {
    try {
      await generate.run();
      refetch();
    } catch (_error) {
      // Error is displayed by the mutation hook.
    }
  };

  const toggleExpand = async (quiz) => {
    const id = String(quiz._id);
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!reviews[id]) {
      setReviewLoading(id);
      try {
        const res = await api.get(`${endpoints.adminQuestions}/${id}/review`);
        setReviews((current) => ({ ...current, [id]: res }));
      } catch (err) {
        console.error('Failed to load quiz review', err);
      } finally {
        setReviewLoading(null);
      }
    }
  };

  const handleStatusAction = async (quiz, action) => {
    try {
      if (action === 'publish') await publish.run(String(quiz._id));
      else await archive.run(String(quiz._id));
      refetch();
    } catch (err) {
      // Error handled by mutation hook
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Question bank</h1>
        <p className="mt-1 text-sm text-ink-2">Review draft quizzes and publish validated assessments to learners.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select
            id="status"
            className="field mt-1 w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="search" className="label">Search</label>
          <input
            id="search"
            className="field mt-1 w-64"
            placeholder="Quiz title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ErrorNote
        error={error || generate.error || publish.error || archive.error || competenciesQuery.error}
        onRetry={refetch}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="competency" className="label">Competency</label>
            <select
              id="competency"
              className="field mt-1 w-64"
              value={competencyCode}
              onChange={(e) => setCompetencyCode(e.target.value)}
            >
              <option value="">Choose competency…</option>
              {compList.map((comp) => (
                <option key={comp._id} value={comp.code}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="count" className="label">Questions</label>
            <select
              id="count"
              className="field mt-1 w-28"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={!competencyCode || generate.loading}
          onClick={handleGenerate}
        >
          {generate.loading ? 'Generating…' : `Generate ${count} questions`}
        </button>
      </div>

      {generate.data && (
        <p className="text-xs text-ink-2">
          Draft quiz created — review it below, then publish.
        </p>
      )}

      {loading ? (
        <Card><Loading label="Loading quizzes" /></Card>
      ) : quizzes.length > 0 ? (
        <div className="space-y-4">
          {quizzes.map((quiz) => {
            const id = String(quiz._id);
            const isOpen = expanded === id;
            const review = reviews[id];
            return (
              <Card key={id} className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <GraduationCap size={16} className="text-ink-muted" />
                      {quiz.title}
                    </h3>
                    <p className="mt-1 text-xs text-ink-2">
                      {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                      {quiz.topics?.length ? ` · ${quiz.topics.slice(0, 3).join(', ')}` : ''}
                      {quiz.createdBy?.name ? ` · by ${quiz.createdBy.name}` : ''}
                      {quiz.attemptCount ? ` · ${quiz.attemptCount} attempt${quiz.attemptCount === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {STATUS_BADGE[quiz.status] ? (
                      <Badge band={STATUS_BADGE[quiz.status]}>{quiz.status}</Badge>
                    ) : (
                      <Badge>{quiz.status}</Badge>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet !text-xs"
                      onClick={() => toggleExpand(quiz)}
                    >
                      {isOpen ? 'Hide' : 'Review'}
                      <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-hairline pt-4">
                    {reviewLoading === id ? (
                      <Loading label="Loading questions" />
                    ) : review?.quiz?.questions?.length ? (
                      <div className="space-y-4">
                        {review.issues?.length > 0 && (
                          <p className="rounded-button bg-warning/10 border border-warning p-2.5 text-xs text-ink-2">
                            {review.issues.length} validation issue{review.issues.length === 1 ? '' : 's'} flagged — resolve before publishing.
                          </p>
                        )}
                        {review.quiz.questions.map((q, qi) => (
                          <div key={q.questionId ?? qi} className="rounded-card border border-hairline bg-surface p-4 space-y-2.5">
                            <p className="text-[13px] font-medium text-ink">
                              <span className="tnum text-ink-muted">Q{qi + 1} · </span>
                              {q.question}
                              {q.difficulty && (
                                <span className="ml-2 text-[11px] font-normal uppercase text-ink-muted">{q.difficulty}</span>
                              )}
                            </p>
                            <div className="space-y-1.5">
                              {(q.options ?? []).map((opt, i) => {
                                const isCorrect = i === q.correctAnswer;
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-start gap-2 p-2 rounded-button text-[13px] ${
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
                              <div className="p-3 rounded-button bg-plane border border-hairline text-[13px] text-ink-2">
                                <strong className="text-ink text-xs uppercase block mb-1">Explanation</strong>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty>No questions in this quiz.</Empty>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-hairline">
                      {quiz.status === 'DRAFT' && (
                        <button
                          type="button"
                          className="btn btn-primary !text-[13px]"
                          onClick={() => handleStatusAction(quiz, 'publish')}
                          disabled={publish.loading || archive.loading}
                        >
                          <Send size={15} />
                          Publish to learners
                        </button>
                      )}
                      {quiz.status === 'PUBLISHED' && (
                        <button
                          type="button"
                          className="btn btn-quiet !text-[13px]"
                          onClick={() => handleStatusAction(quiz, 'archive')}
                          disabled={publish.loading || archive.loading}
                        >
                          <Archive size={15} />
                          Archive
                        </button>
                      )}
                      {quiz.status === 'ARCHIVED' && (
                        <button
                          type="button"
                          className="btn btn-quiet !text-[13px]"
                          onClick={() => handleStatusAction(quiz, 'publish')}
                          disabled={publish.loading || archive.loading}
                        >
                          <Send size={15} />
                          Re-publish
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!isOpen && quiz.status === 'DRAFT' && (
                  <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-hairline">
                    <button
                      type="button"
                      className="btn btn-quiet !text-[13px] !text-critical"
                      onClick={() => handleStatusAction(quiz, 'archive')}
                      disabled={publish.loading || archive.loading}
                    >
                      <XCircle size={15} />
                      Archive
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary !text-[13px]"
                      onClick={() => handleStatusAction(quiz, 'publish')}
                      disabled={publish.loading || archive.loading}
                    >
                      <CheckCircle2 size={15} />
                      Publish
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty>No quizzes match your filters. Generate a draft above or ask a trainer to create one.</Empty>
        </Card>
      )}
    </div>
  );
}
