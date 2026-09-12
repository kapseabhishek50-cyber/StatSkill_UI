import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { unauthorized, notFound } from '../utils/errors';
import { skillGapService } from '../services/skillGap/skillGap.service';
import { competencyService } from '../services/competency/competency.service';
import { recommendationJob } from '../jobs/recommendation.job';
import { audit } from '../middleware/audit.middleware';
import { buildUserProfileText } from '../services/recommendation/semantic.service';

const PROFILE_FIELDS = [
  'name',
  'designation',
  'department',
  'organization',
  'experience',
  'education',
  'preferredLanguage',
  'avatar',
  'interests',
  'learningGoals',
] as const;

export const profileController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id).select('-passwordHash -refreshTokens');
    if (!user) throw unauthorized();
    const competencies = await competencyService.getUserCompetencies(req.user!.id);
    sendSuccess(res, { user, competencies }, 'Profile');
  }),

  /** GET /api/profile/learning-profile — the semantic profile used by the recommender. */
  getLearningProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw unauthorized();
    const gaps = await skillGapService.listForUser(req.user!.id);
    const { Enrollment } = await import('../models/Enrollment');
    const { Course } = await import('../models/Course');
    const completed = await Enrollment.find({ userId: user._id, status: 'COMPLETED' }).populate('courseId', 'title');
    const titles = completed.map((e) => (e.courseId as unknown as { title?: string }).title ?? '');
    sendSuccess(
      res,
      {
        learningProfileText: buildUserProfileText(user, gaps, titles),
        openGaps: gaps.filter((g) => g.gap > 0).slice(0, 8),
        completedCourses: titles,
      },
      'Learning profile'
    );
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const updates: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const user = await User.findByIdAndUpdate(req.user!.id, { $set: updates }, { new: true }).select('-passwordHash -refreshTokens');
    if (!user) throw notFound('User not found');
    // Role-relevant profile fields changed → gaps/recs may shift.
    if (updates.designation || updates.department || updates.experience) {
      await skillGapService.recalculateForUser(req.user!.id);
      recommendationJob.enqueue(req.user!.id);
    }
    void audit(req, 'USER_UPDATED', 'user', req.user!.id, { fields: Object.keys(updates) });
    sendSuccess(res, { user }, 'Profile updated');
  }),
};
