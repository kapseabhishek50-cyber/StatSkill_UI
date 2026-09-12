import { useState } from 'react';
import { ChevronLeft, ChevronRight, Send, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Card, ErrorNote } from './ui.jsx';
import { levelLabel } from '../lib/format.js';

export default function QuizRunner({ attempt, onSubmit, submitting, error }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState({});

  const questions = attempt.questions ?? [];
  const question = questions[index];
  const totalAnswered = Object.keys(chosen).filter((k) => chosen[k] !== null && chosen[k] !== undefined).length;
  const currentQuestionAnswered = question ? chosen[question._id] !== undefined && chosen[question._id] !== null : false;
  const isLast = index === questions.length - 1;

  if (!question) return null;

  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <div className="space-y-5">
      {/* Question Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">{attempt.title ?? attempt.competency?.name}</h1>
          <p className="mt-0.5 text-xs text-ink-2">
            {attempt.targetLevel !== undefined && attempt.targetLevel !== null
              ? <>Level {attempt.targetLevel} · {levelLabel(attempt.targetLevel)} • 70% accuracy needed</>
              : <>{questions.length} questions • 70% accuracy needed to pass</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum text-sm text-ink-2 font-medium">
            Question {index + 1} / {questions.length}
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-pill bg-surface-2 text-ink-muted">
            {totalAnswered}/{questions.length} answered
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-pill bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-pill bg-primary transition-all duration-300"
          style={{ width: `${(totalAnswered / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-light text-primary text-xs font-bold border border-primary-border">
              Q
            </span>
            <p className="text-base text-ink leading-relaxed">{question.stem}</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">Select one answer</legend>
            {options.map((option, optionIndex) => {
              const optionId = String(option._id ?? optionIndex);
              const selected = chosen[question._id] === optionId;
              return (
                <label
                  key={optionId}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-all ${
                    selected
                      ? 'border-transparent bg-primary-light text-ink font-medium'
                      : 'border-hairline text-ink-2 hover:bg-surface-2'
                  }`}
                  style={
                    selected
                      ? { boxShadow: 'inset 3px 0 0 var(--primary)', backgroundColor: 'var(--primary-light)' }
                      : {}
                  }
                >
                  <input
                    type="radio"
                    name={question._id}
                    className="sr-only"
                    checked={selected}
                    onChange={() => setChosen({ ...chosen, [question._id]: optionId })}
                  />
                  <span className="tnum shrink-0 text-xs font-bold text-ink-muted" aria-hidden="true">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {option.explanation && (
                    <HelpCircle size={14} className="text-ink-muted shrink-0" />
                  )}
                </label>
              );
            })}
          </fieldset>
        </div>
      </Card>

      <ErrorNote error={error} />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn btn-quiet"
          disabled={index === 0 || submitting}
          onClick={() => setIndex((current) => current - 1)}
        >
          <ChevronLeft size={15} />
          Previous
        </button>

        {isLast ? (
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            disabled={!currentQuestionAnswered || submitting}
            onClick={() =>
              onSubmit(
                questions.map((item) => ({
                  question: item._id,
                  option: chosen[item._id] ?? null,
                })),
              )
            }
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Scoring…
              </>
            ) : (
              'Submit Answers'
            )}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            disabled={!currentQuestionAnswered || submitting}
            onClick={() => setIndex((current) => current + 1)}
          >
            Next
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Incomplete Warning */}
      {isLast && totalAnswered < questions.length && (
        <p className="text-center text-xs text-ink-muted">
          {questions.length - totalAnswered} question
          {questions.length - totalAnswered === 1 ? '' : 's'} still unanswered.
        </p>
      )}
    </div>
  );
}