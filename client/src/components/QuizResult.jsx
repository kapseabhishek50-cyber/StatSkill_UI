import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Trophy, Sparkles, ArrowRight, RotateCcw, BarChart2 } from 'lucide-react';
import { Card, Badge } from './ui.jsx';
import { levelLabel, percent } from '../lib/format.js';

export default function QuizResult({ result, onRetake }) {
  const { scoreRatio, passed, levelBefore, levelAfter, answers = [], feedback } = result;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const improved = levelAfter > levelBefore;

  const [tab, setTab] = useState('review'); // review | analytics

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Hero Score Card ──────────────────────────────────── */}
      <div className="card p-6 text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-navy flex items-center justify-center mb-3">
          <span className="tnum text-[22px] font-bold text-white">
            {percent(scoreRatio)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-1.5">
          {passed ? (
            <Trophy size={20} className="text-primary" />
          ) : (
            <XCircle size={20} className="text-critical" />
          )}
          <h1 className="text-h2 font-bold text-ink">
            {passed ? 'Excellent Work!' : 'Keep Practicing'}
          </h1>
        </div>

        <p className="text-[13px] text-ink-2">
          {correctCount} of {total} correct · {percent(scoreRatio)} accuracy · Pass mark 70%
        </p>

        {improved && (
          <div className="mt-3 inline-flex items-center gap-1.5 pill pill-success">
            <CheckCircle2 size={13} />
            Level {levelBefore} → {levelAfter} · {levelLabel(levelAfter)}
          </div>
        )}
      </div>

      {/* ── AI Feedback Card ──────────────────────────────────── */}
      {feedback && (
        <div className="card-ai p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
              AI Feedback
            </h2>
          </div>

          <p className="text-sm font-medium text-ink leading-relaxed">{feedback.summary}</p>

          {feedback.strengths?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-good uppercase tracking-wider mb-1.5">
                Strengths
              </h4>
              <ul className="space-y-1">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                    <CheckCircle2 size={14} className="text-good mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.focusAreas?.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-warning uppercase tracking-wider mb-1.5">
                Focus Areas
              </h4>
              <ul className="space-y-1">
                {feedback.focusAreas.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                    <XCircle size={14} className="text-warning mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.nextStep && (
            <p className="text-sm font-medium text-primary border-l-2 border-primary pl-3">
              {feedback.nextStep}
            </p>
          )}
        </div>
      )}

      {/* ── Tabs: Review / Analytics ──────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-hairline pb-3">
        <button
          onClick={() => setTab('review')}
          className={`pb-2 text-sm font-semibold transition-colors ${
            tab === 'review' ? 'text-primary border-b-2 border-primary' : 'text-ink-2 hover:text-ink'
          }`}
        >
          Question Review
        </button>
        <button
          onClick={() => setTab('analytics')}
          className={`pb-2 text-sm font-semibold transition-colors ${
            tab === 'analytics' ? 'text-primary border-b-2 border-primary' : 'text-ink-2 hover:text-ink'
          }`}
        >
          Topic Analytics
        </button>
      </div>

      {/* ── Review Tab ────────────────────────────────────────── */}
      {tab === 'review' && (
        <div className="space-y-3">
          {answers.map((answer, index) => (
            <div
              key={answer.question ?? index}
              className="card card-hover !p-4 flex items-start gap-3"
              style={{ borderLeft: `3px solid ${answer.isCorrect ? 'var(--status-good)' : 'var(--status-critical)'}` }}
            >
              {answer.isCorrect ? (
                <CheckCircle2 size={18} className="text-good mt-0.5 shrink-0" />
              ) : (
                <XCircle size={18} className="text-critical mt-0.5 shrink-0" />
              )}
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-ink">{answer.stem}</p>
                <p className="text-xs text-ink-2">
                  Your answer: <span className={answer.isCorrect ? 'text-good' : 'text-critical'}>{answer.chosen ?? 'no answer'}</span>
                </p>
                {!answer.isCorrect && (
                  <p className="text-xs text-ink-muted">Correct: {answer.correct}</p>
                )}
                {answer.explanation && (
                  <p className="text-xs text-ink-2 mt-1 p-2 bg-surface-2 rounded-lg leading-relaxed">
                    {answer.explanation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics Tab (placeholder) ─────────────────────────── */}
      {tab === 'analytics' && (
        <Card>
          <div className="flex items-center gap-3 justify-center py-8">
            <BarChart2 size={40} className="text-primary opacity-40" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-ink">Topic Performance</p>
              <p className="text-xs text-ink-muted mt-1">Breakdown by subtopic</p>
              <p className="text-xs text-primary mt-3 hover:underline cursor-pointer">
                See full analytics in profile →
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-hairline">
        <button
          type="button"
          className="btn btn-quiet w-full sm:w-auto"
          onClick={onRetake}
        >
          <RotateCcw size={16} />
          {passed ? 'Attempt another competency' : 'Retake this quiz'}
        </button>

        <Link
          to="/path"
          className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
        >
          Back to your path
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}