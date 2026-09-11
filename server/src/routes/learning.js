import { Router } from 'express';
import { z } from 'zod';
import { Course, LearningProgress } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { recordActivity, XP_REWARDS } from '../services/streakService.js';

/**
 * Course enrolment and progress.
 *
 * Completing a course does not raise a competency level - only a quiz does. That
 * separation is the point of the loop: attendance is not evidence, and a platform
 * that treats it as evidence produces a workforce that looks trained on paper.
 */

const router = Router();

const courseRef = z.object({
  course: z.string().regex(/^[a-f\d]{24}$/i, 'Not a course id.'),
  percentComplete: z.number().min(0).max(100).optional(),
  timeSpentMinutes: z.number().min(0).max(10000).optional(),
});

router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const progress = await LearningProgress.find({ user: req.user._id })
      .populate({
        path: 'course',
        select: 'code title provider url durationHours rating competencies',
        populate: { path: 'competencies.competency', select: 'code name' },
      })
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .lean();
    res.json({ progress });
  }),
);

router.post(
  '/enroll',
  asyncHandler(async (req, res) => {
    const parsed = courseRef.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Pick a course to enrol in.');

    const course = await Course.findById(parsed.data.course).select('_id isActive').lean();
    if (!course) throw new HttpError(404, 'Unknown course.');
    if (!course.isActive) throw new HttpError(409, 'That course is no longer offered.');

    const now = new Date();
    // Idempotent: pressing Enrol twice must not reset progress to zero.
    let progress = await LearningProgress.findOne({ user: req.user._id, course: course._id });
    const isNewEnrollment = !progress;
    if (progress) {
      progress.lastActivityAt = now;
      await progress.save();
    } else {
      progress = await LearningProgress.create({
        user: req.user._id,
        course: course._id,
        status: 'in_progress',
        startedAt: now,
        lastActivityAt: now,
      });
    }

    if (isNewEnrollment) await Course.updateOne({ _id: course._id }, { $inc: { enrolments: 1 } });

    res.status(201).json({ progress });
  }),
);

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const parsed = courseRef.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Pick a course to mark complete.');

    const course = await Course.findById(parsed.data.course).select('_id isActive').lean();
    if (!course) throw new HttpError(404, 'Unknown course.');
    if (!course.isActive) throw new HttpError(409, 'That course is no longer offered.');

    const now = new Date();
    const progress = await LearningProgress.findOneAndUpdate(
      { user: req.user._id, course: parsed.data.course },
      {
        $set: {
          status: 'completed',
          percentComplete: 100,
          completedAt: now,
          lastActivityAt: now,
          ...(parsed.data.timeSpentMinutes ? { timeSpentMinutes: parsed.data.timeSpentMinutes } : {}),
        },
        $setOnInsert: { startedAt: now },
      },
      { new: true, upsert: true },
    ).populate('course', 'code title competencies');

    const gamification = await recordActivity(req.user._id, {
      activityType: 'course_completed',
      detail: `Completed ${course.title || 'Course'}`,
      xp: XP_REWARDS.LESSON_COMPLETED * 2,
      minutes: parsed.data.timeSpentMinutes || 60,
    });

    res.json({
      progress,
      gamification,
      // Said plainly, so nobody mistakes completion for a level.
      note: 'Completion recorded. Take the competency quiz to have the level updated.',
    });
  }),
);

/** Partial progress, for a provider callback or a manual nudge. */
router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const parsed = courseRef.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Send a course and a percentage.');

    const { course, percentComplete = 0, timeSpentMinutes } = parsed.data;
    const courseRecord = await Course.findById(course).select('_id isActive').lean();
    if (!courseRecord) throw new HttpError(404, 'Unknown course.');
    if (!courseRecord.isActive) throw new HttpError(409, 'That course is no longer offered.');

    const now = new Date();

    const progress = await LearningProgress.findOneAndUpdate(
      { user: req.user._id, course },
      {
        $set: {
          percentComplete,
          status: percentComplete >= 100 ? 'completed' : 'in_progress',
          lastActivityAt: now,
          ...(percentComplete >= 100 ? { completedAt: now } : {}),
          ...(timeSpentMinutes ? { timeSpentMinutes } : {}),
        },
        $setOnInsert: { startedAt: now },
      },
      { new: true, upsert: true },
    );

    res.json({ progress });
  }),
);

export default router;
