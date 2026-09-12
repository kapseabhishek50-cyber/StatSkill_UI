import { Schema, model, models, Model, Document } from 'mongoose';

export type AchievementRuleType =
  | 'ASSESSMENTS_COMPLETED'
  | 'COURSES_COMPLETED'
  | 'STREAK_DAYS'
  | 'QUIZZES_COMPLETED'
  | 'QUIZ_AVG_SCORE'
  | 'ENROLLMENTS'
  | 'SKILL_IMPROVED'
  | 'DISCUSSION_MESSAGES';

export interface IAchievement extends Document {
  code: string; // e.g. FIRST_ASSESSMENT
  title: string;
  description: string;
  icon?: string;
  category: 'LEARNING' | 'STREAK' | 'QUIZ' | 'COMMUNITY' | 'SKILL';
  xpReward: number;
  rule: { type: AchievementRuleType; threshold: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const achievementSchema = new Schema<IAchievement>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    category: { type: String, enum: ['LEARNING', 'STREAK', 'QUIZ', 'COMMUNITY', 'SKILL'], default: 'LEARNING' },
    xpReward: { type: Number, default: 50 },
    rule: {
      type: { type: String, enum: ['ASSESSMENTS_COMPLETED', 'COURSES_COMPLETED', 'STREAK_DAYS', 'QUIZZES_COMPLETED', 'QUIZ_AVG_SCORE', 'ENROLLMENTS', 'SKILL_IMPROVED', 'DISCUSSION_MESSAGES'], required: true },
      threshold: { type: Number, required: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Achievement: Model<IAchievement> = models.Achievement || model<IAchievement>('Achievement', achievementSchema);
export default Achievement;
