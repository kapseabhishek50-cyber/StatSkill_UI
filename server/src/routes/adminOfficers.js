import { Router } from 'express';
import { User, UserCompetency, QuizResult, LearningProgress } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { computeGaps, roleReadiness } from '../services/gapEngine.js';
import { currentLevelMap } from '../services/assessmentScoring.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

/**
 * List all active officers with readiness and gap counts.
 *
 * Supports query filters:
 *   ?department=<ObjectId>  narrow to one division
 *   ?search=<string>        name or email substring
 */
router.get(
  '/',
  audit('admin.officers.read'),
  asyncHandler(async (req, res) => {
    const filter = { role: 'learner', isActive: true };
    if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.search) {
      const escapedSearch = String(req.query.search).slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const users = await User.find(filter).populate('department').populate({
      path: 'jobRole',
      populate: { path: 'requirements.competency' },
    });

    const officers = await Promise.all(
      users.map(async (user) => {
        const levels = await currentLevelMap(user._id);
        let readiness = 0;
        let gapCount = 0;

        if (user.jobRole?.requirements) {
          const gaps = computeGaps({
            requirements: user.jobRole.requirements,
            currentLevels: levels,
            departmentPriority: user.department?.priority ?? 0.5,
          });
          readiness = roleReadiness(gaps);
          gapCount = gaps.filter((g) => g.gap > 0).length;
        }

        return {
          ...user.toPublic(),
          department: user.department,
          jobRole: user.jobRole,
          readiness,
          gapCount,
        };
      }),
    );

    res.json({ officers });
  }),
);

/**
 * Detailed view of a single officer: competencies, gaps, quiz history,
 * learning progress. Used by the admin officer detail panel.
 */
router.get(
  '/:id',
  audit('admin.officers.detail'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).populate('department').populate({
      path: 'jobRole',
      populate: { path: 'requirements.competency' },
    });

    if (!user) {
      res.status(404).json({ error: { message: 'Officer not found.' } });
      return;
    }

    const competencies = await UserCompetency.find({ user: user._id }).populate('competency');
    const levels = await currentLevelMap(user._id);

    let gaps = [];
    if (user.jobRole?.requirements) {
      gaps = computeGaps({
        requirements: user.jobRole.requirements,
        currentLevels: levels,
        departmentPriority: user.department?.priority ?? 0.5,
      });
    }

    const quizHistory = await QuizResult.find({ user: user._id })
      .populate('competency')
      .sort({ createdAt: -1 })
      .limit(20);

    const learningProgress = await LearningProgress.find({ user: user._id }).populate('course');

    res.json({
      officer: user.toPublic(),
      department: user.department,
      jobRole: user.jobRole,
      competencies,
      gaps,
      quizHistory,
      learningProgress,
    });
  }),
);

export default router;
