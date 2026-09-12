import { IQuizQuestion } from '../../models/Quiz';

export interface ValidationIssue {
  index: number;
  questionId?: string;
  rule: string;
  message: string;
}

/**
 * Publish-time MCQ validation (prompt §25):
 * exactly 4 options, exactly 1 correct answer, non-empty question, explanation
 * present, valid difficulty, no duplicate questions, unique options.
 */
export const validateQuestions = (questions: IQuizQuestion[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seenQuestions = new Set<string>();

  questions.forEach((q, i) => {
    const add = (rule: string, message: string) => issues.push({ index: i, questionId: q.questionId, rule, message });

    if (!q.question || q.question.trim().length < 8) add('QUESTION_EMPTY', 'Question text is empty or too short');
    if (!Array.isArray(q.options) || q.options.length !== 4) add('OPTIONS_COUNT', 'Question must have exactly 4 options');
    else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) add('OPTIONS_UNIQUE', 'Options must be unique');
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) add('CORRECT_ANSWER_RANGE', 'correctAnswer must be an index 0-3 (exactly one)');
    if (!q.explanation || q.explanation.trim().length < 5) add('EXPLANATION_MISSING', 'Explanation is required');
    if (!['easy', 'medium', 'hard'].includes(q.difficulty)) add('DIFFICULTY_INVALID', 'Difficulty must be easy|medium|hard');
    if (q.options.some((o) => !o || !o.trim())) add('OPTION_EMPTY', 'Options must be non-empty');

    const key = q.question.trim().toLowerCase();
    if (seenQuestions.has(key)) add('DUPLICATE_QUESTION', 'Duplicate question in quiz');
    seenQuestions.add(key);
  });

  return issues;
};

export const isPublishable = (questions: IQuizQuestion[]): boolean => questions.length > 0 && validateQuestions(questions).length === 0;
