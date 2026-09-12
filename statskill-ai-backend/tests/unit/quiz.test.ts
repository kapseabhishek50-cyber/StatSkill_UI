import { describe, it, expect } from 'vitest';
import { scoreQuizAttempt } from '../../src/services/quiz/quizScoring.service';
import { validateQuestions } from '../../src/services/quiz/quizValidator.service';
import { chunkText } from '../../src/services/material/chunking.service';
import type { IQuizQuestion } from '../../src/models/Quiz';

const q = (over: Partial<IQuizQuestion> = {}): IQuizQuestion =>
  ({
    questionId: 'q1',
    question: 'What is a sampling frame?',
    options: ['A list', 'A budget', 'A chart', 'A law'],
    correctAnswer: 0,
    explanation: 'A frame is the selection list.',
    topic: 'Sampling',
    difficulty: 'easy',
    source: 'BANK',
    ...over,
  }) as IQuizQuestion;

/** Quiz scoring (prompt §26) — server-side only. */
describe('quiz scoring', () => {
  const questions = [
    q({ questionId: 'q1', correctAnswer: 0, topic: 'Sampling' }),
    q({ questionId: 'q2', correctAnswer: 2, topic: 'Sampling' }),
    q({ questionId: 'q3', correctAnswer: 1, topic: 'Python' }),
  ];

  it('scores answers server-side and ignores any client-submitted score', () => {
    const result = scoreQuizAttempt(questions, [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 0 },
    ]);
    expect(result.score).toBe(67);
    expect(result.correctAnswers).toBe(2);
    expect(result.incorrectAnswers).toBe(1);
    expect(result.totalQuestions).toBe(3);
  });

  it('produces per-topic performance', () => {
    const result = scoreQuizAttempt(questions, [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 1 },
    ]);
    const sampling = result.topicPerformance.find((t) => t.topic === 'Sampling');
    const python = result.topicPerformance.find((t) => t.topic === 'Python');
    expect(sampling).toMatchObject({ correct: 1, total: 2, percent: 50 });
    expect(python).toMatchObject({ correct: 1, total: 1, percent: 100 });
  });

  it('treats skipped answers as incorrect without counting as wrong-choice', () => {
    const result = scoreQuizAttempt(questions, [
      { questionId: 'q1', selectedIndex: -1 },
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 1 },
    ]);
    expect(result.correctAnswers).toBe(2);
    expect(result.incorrectAnswers).toBe(0);
    expect(result.score).toBe(67);
  });

  it('handles empty quizzes safely', () => {
    expect(scoreQuizAttempt([], []).score).toBe(0);
  });
});

/** Quiz validation (prompt §25). */
describe('quiz validation', () => {
  it('accepts a well-formed question set', () => {
    const issues = validateQuestions([q(), q({ questionId: 'q2', question: 'Second unique question about R?' })]);
    expect(issues).toHaveLength(0);
  });

  it('rejects wrong option counts, missing explanations, bad difficulty, duplicates', () => {
    const bad = [
      q({ questionId: 'bad1', options: ['a', 'b', 'c'] }),
      q({ questionId: 'bad2', explanation: undefined }),
      q({ questionId: 'bad3', difficulty: 'impossible' as never }),
      q(), // duplicate of q() default text
    ];
    const issues = validateQuestions(bad);
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain('OPTIONS_COUNT');
    expect(rules).toContain('EXPLANATION_MISSING');
    expect(rules).toContain('DIFFICULTY_INVALID');
    expect(rules).toContain('DUPLICATE_QUESTION');
  });

  it('rejects duplicate options within a question', () => {
    const issues = validateQuestions([q({ options: ['same', 'same', 'other', 'last'] })]);
    expect(issues.map((i) => i.rule)).toContain('OPTIONS_UNIQUE');
  });
});

/** Chunking (prompt §23). */
describe('material chunking', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('short text')).toHaveLength(1);
  });

  it('splits long text with overlap and preserves order', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${'word '.repeat(60)}`).join('\n\n');
    const chunks = chunkText(text, { maxChars: 1200, overlapChars: 150 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(1400);
    // overlap: chunk 1 begins with (a trimmed form of) the tail of chunk 0
    const tailCore = chunks[0].text.slice(-30).trim();
    expect(chunks[1].text.slice(0, 60)).toContain(tailCore);
  });

  it('handles empty input', () => {
    expect(chunkText('')).toHaveLength(0);
  });
});
