import { IAssessment } from '../../models/Assessment';
import { SubmittedAnswer } from '../quiz/quizScoring.service';

export interface CompetencyScoreLine {
  competencyId: string;
  competencyCode?: string;
  correct: number;
  total: number;
  scorePercent: number;
  previousScore?: number;
  newScore?: number;
}

export interface AssessmentScoreResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  competencyResults: CompetencyScoreLine[];
  perQuestion: { questionId: string; isCorrect: boolean }[];
}

/** Deterministic assessment scoring (prompt §6): answers → per-competency %. */
export const scoreAssessment = (assessment: IAssessment, answers: SubmittedAnswer[]): AssessmentScoreResult => {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const compMap = new Map<string, CompetencyScoreLine>();
  let correctCount = 0;
  const perQuestion: { questionId: string; isCorrect: boolean }[] = [];

  for (const q of assessment.questions) {
    const selected = answerMap.get(q.questionId);
    const isCorrect = selected !== undefined && selected === q.correctAnswer;
    if (isCorrect) correctCount += 1;
    perQuestion.push({ questionId: q.questionId, isCorrect });

    const key = String(q.competencyId);
    const line = compMap.get(key) ?? {
      competencyId: key,
      competencyCode: q.competencyCode,
      correct: 0,
      total: 0,
      scorePercent: 0,
    };
    line.total += 1;
    if (isCorrect) line.correct += 1;
    line.scorePercent = line.total ? Math.round((line.correct / line.total) * 100) : 0;
    compMap.set(key, line);
  }

  return {
    score: assessment.questions.length ? Math.round((correctCount / assessment.questions.length) * 100) : 0,
    correctCount,
    totalQuestions: assessment.questions.length,
    competencyResults: [...compMap.values()],
    perQuestion,
  };
};
