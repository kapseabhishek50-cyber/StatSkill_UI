import { User, IUser } from '../../models/User';
import { skillGapService } from '../skillGap/skillGap.service';
import { Enrollment } from '../../models/Enrollment';
import { QuizAttempt } from '../../models/QuizAttempt';
import { LearningPath } from '../../models/LearningPath';
import { Recommendation } from '../../models/Recommendation';
import { Streak } from '../../models/Streak';

/**
 * Builds the compact, factual user context handed to the LLM (prompt §28).
 * Everything here is backend-computed ground truth.
 */
export const buildAssistantContext = async (user: IUser): Promise<Record<string, unknown>> => {
  const [gaps, enrollments, recentAttempts, activePath, topRecs, streak] = await Promise.all([
    skillGapService.listForUser(String(user._id)),
    Enrollment.find({ userId: user._id }).populate('courseId', 'title status progress'),
    QuizAttempt.find({ userId: user._id }).sort({ submittedAt: -1 }).limit(5),
    LearningPath.findOne({ userId: user._id, status: 'ACTIVE' }),
    Recommendation.find({ userId: user._id, status: 'ACTIVE' }).sort({ matchScore: -1 }).limit(3),
    Streak.findOne({ userId: user._id }),
  ]);

  const topSkillGaps = gaps
    .filter((g) => g.gap > 0)
    .slice(0, 5)
    .map((g) => ({
      name: g.competencyName,
      code: g.competencyCode,
      current: g.currentScore,
      required: g.requiredScore,
      gap: g.gap,
      priority: g.priority,
    }));

  const nextRecommendedCourse = topRecs[0]
    ? {
        title: (topRecs[0].courseId as unknown as { title?: string })?.title ?? 'a recommended course',
        matchScore: topRecs[0].matchScore,
        reason: topRecs[0].reason,
      }
    : undefined;

  return {
    name: user.name,
    role: user.designation,
    department: user.department,
    organization: user.organization,
    experienceYears: user.experience,
    interests: user.interests ?? [],
    xp: user.xp,
    level: user.level,
    topSkillGaps,
    enrolledCourses: enrollments.map((e) => ({
      title: (e.courseId as unknown as { title?: string })?.title ?? 'Unknown course',
      progress: e.progress,
      status: e.status,
    })),
    recentQuizScores: recentAttempts.map((a) => ({ score: a.score, submittedAt: a.submittedAt })),
    activeLearningPath: activePath
      ? { title: activePath.title, progress: activePath.progress, currentStep: activePath.currentStep }
      : null,
    topRecommendedCourses: topRecs.map((r) => ({
      title: (r.courseId as unknown as { title?: string })?.title,
      matchScore: r.matchScore,
      reason: r.reason,
    })),
    streak: streak ? { current: streak.currentStreak, longest: streak.longestStreak } : null,
    nextRecommendedCourse,
  };
};
