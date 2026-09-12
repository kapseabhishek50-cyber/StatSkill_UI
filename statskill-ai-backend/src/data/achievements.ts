/** Achievement catalogue (prompt §22) — rules are evaluated by achievement.service. */
export interface AchievementSeed {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: 'LEARNING' | 'STREAK' | 'QUIZ' | 'COMMUNITY' | 'SKILL';
  xpReward: number;
  rule: { type: string; threshold: number };
}

export const ACHIEVEMENT_SEED: AchievementSeed[] = [
  {
    code: 'FIRST_ASSESSMENT',
    title: 'Self-Aware Starter',
    description: 'Complete your first competency assessment.',
    icon: '🧭',
    category: 'LEARNING',
    xpReward: 50,
    rule: { type: 'ASSESSMENTS_COMPLETED', threshold: 1 },
  },
  {
    code: 'FIRST_COURSE',
    title: 'Course Beginnings',
    description: 'Complete your first course.',
    icon: '🎓',
    category: 'LEARNING',
    xpReward: 100,
    rule: { type: 'COURSES_COMPLETED', threshold: 1 },
  },
  {
    code: 'SEVEN_DAY_STREAK',
    title: 'Week of Momentum',
    description: 'Reach a 7-day learning streak.',
    icon: '🔥',
    category: 'STREAK',
    xpReward: 100,
    rule: { type: 'STREAK_DAYS', threshold: 7 },
  },
  {
    code: 'THIRTY_DAY_STREAK',
    title: 'Unstoppable',
    description: 'Reach a 30-day learning streak.',
    icon: '🏅',
    category: 'STREAK',
    xpReward: 300,
    rule: { type: 'STREAK_DAYS', threshold: 30 },
  },
  {
    code: 'QUIZ_MASTER',
    title: 'Quiz Master',
    description: 'Complete 10 quizzes with an average score of 80%+.',
    icon: '🧠',
    category: 'QUIZ',
    xpReward: 150,
    rule: { type: 'QUIZ_AVG_SCORE', threshold: 80 },
  },
  {
    code: 'COURSE_EXPLORER',
    title: 'Course Explorer',
    description: 'Enroll in 5 different courses.',
    icon: '🗺️',
    category: 'LEARNING',
    xpReward: 80,
    rule: { type: 'ENROLLMENTS', threshold: 5 },
  },
  {
    code: 'SKILL_IMPROVER',
    title: 'Skill Improver',
    description: 'Raise any competency by 15 points or more from your baseline.',
    icon: '📈',
    category: 'SKILL',
    xpReward: 120,
    rule: { type: 'SKILL_IMPROVED', threshold: 15 },
  },
];
