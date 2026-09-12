import { IQuizQuestion } from '../../models/Quiz';

export interface SubmittedAnswer {
  questionId: string;
  selectedIndex: number; // -1 = skipped
  timeTakenSeconds?: number;
}

export interface QuizScoreResult {
  score: number; // percent
  correctAnswers: number;
  incorrectAnswers: number;
  totalQuestions: number;
  topicPerformance: { topic: string; correct: number; total: number; percent: number }[];
}

/**
 * Server-side quiz scoring (prompt §26). The frontend-submitted score is NEVER
 * trusted — this pure function is the only scorer.
 */
export const scoreQuizAttempt = (questions: IQuizQuestion[], answers: SubmittedAnswer[]): QuizScoreResult => {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  let correct = 0;
  let incorrect = 0;
  const topicMap = new Map<string, { correct: number; total: number }>();

  for (const q of questions) {
    const selected = answerMap.get(q.questionId);
    const isCorrect = selected !== undefined && selected === q.correctAnswer;
    if (isCorrect) correct += 1;
    else if (selected !== undefined && selected >= 0) incorrect += 1;

    const topic = q.topic || 'General';
    const t = topicMap.get(topic) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (isCorrect) t.correct += 1;
    topicMap.set(topic, t);
  }

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    score,
    correctAnswers: correct,
    incorrectAnswers: incorrect,
    totalQuestions: total,
    topicPerformance: [...topicMap.entries()].map(([topic, t]) => ({
      topic,
      correct: t.correct,
      total: t.total,
      percent: t.total ? Math.round((t.correct / t.total) * 100) : 0,
    })),
  };
};
