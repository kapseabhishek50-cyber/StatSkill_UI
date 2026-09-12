import { env } from './env';
import { logger } from '../utils/logger';

const log = logger;

/** XP rules — configurable via env (prompt §21). Login is NOT a learning activity. */
export const XP_RULES = {
  LESSON_COMPLETED: env.XP_LESSON_COMPLETED,
  QUIZ_COMPLETED: env.XP_QUIZ_COMPLETED,
  QUIZ_HIGH_SCORE_BONUS: env.XP_QUIZ_HIGH_SCORE,
  QUIZ_HIGH_SCORE_THRESHOLD: env.XP_QUIZ_HIGH_SCORE_THRESHOLD,
  STREAK_MILESTONE_BONUS: env.XP_STREAK_MILESTONE,
  DISCUSSION_HELPFUL: env.XP_DISCUSSION_HELPFUL,
  COURSE_COMPLETED: env.XP_COURSE_COMPLETED,
  ASSESSMENT_COMPLETED: env.XP_ASSESSMENT_COMPLETED,
} as const;

export type XPActivityType = keyof typeof XP_RULES;

/** Streak day milestones that grant bonus XP + notification. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export const xpForQuiz = (scorePercent: number): number => {
  let xp = XP_RULES.QUIZ_COMPLETED;
  if (scorePercent >= XP_RULES.QUIZ_HIGH_SCORE_THRESHOLD) xp += XP_RULES.QUIZ_HIGH_SCORE_BONUS;
  return xp;
};

/** Level curve: level n requires 100 * n^2 XP. */
export const levelForXp = (xp: number): number => Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);

export const xpForLevel = (level: number): number => 100 * (level - 1) ** 2;

export const logXp = (userId: string, activity: string, xp: number) =>
  log.info({ userId, activity, xp }, 'XP awarded');
