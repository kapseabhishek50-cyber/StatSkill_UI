import { Course, JobRole, Profile, Recommendation, User } from '../models/index.js';
import { computeGaps, openGaps, roleReadiness } from './gapEngine.js';
import { buildLearningPath } from './recommender.js';
import { currentLevelMap } from './assessmentScoring.js';
import { explainPath } from './llm/index.js';
import { PRIORITY_WEIGHTS } from '../config/competency.js';

/**
 * The pipeline, in one place.
 *
 *   requirements + recorded levels -> gaps -> priority -> courses -> narrative
 *
 * Both the read route and the recompute route call this, so a learner's path can
 * never differ depending on which one they hit. The narrative is generated last
 * and from the finished rows: prose describes the ranking, it never produces it.
 */

/** Loads the officer with everything the engine needs, populated once. */
async function loadContext(userId) {
  const user = await User.findById(userId).populate('department').lean();
  if (!user) return null;

  const jobRole = user.jobRole
    ? await JobRole.findById(user.jobRole).populate('requirements.competency').lean()
    : null;

  return { user, jobRole, department: user.department ?? null };
}

/**
 * Computes gaps, path and narrative. Pure read - nothing is stored.
 * @param {string} userId
 * @param {{ withNarrative?: boolean }} options
 */
export async function computePath(userId, { withNarrative = true } = {}) {
  const context = await loadContext(userId);
  if (!context) return null;

  const { user, jobRole, department } = context;
  const requirements = jobRole?.requirements ?? [];
  const currentLevels = await currentLevelMap(userId);

  const gaps = computeGaps({
    requirements,
    currentLevels,
    departmentPriority: department?.priority ?? 0.5,
  });

  const open = openGaps(gaps);

  // Only fetch courses that touch a competency the learner is actually short on.
  const competencyIds = open.map((row) => row.competencyId);
  const courses = competencyIds.length
    ? await Course.find({ isActive: true, 'competencies.competency': { $in: competencyIds } }).lean()
    : [];

  const path = buildLearningPath(open, courses);

  let narrative = null;
  if (withNarrative && open.length) {
    const result = await explainPath({ user, jobRole, gapRows: open });
    narrative = {
      summary: result.summary,
      reasoning: result.reasoning,
      llmSource: result.llmSource,
    };
  }

  return {
    jobRole: jobRole ? { _id: jobRole._id, code: jobRole.code, title: jobRole.title } : null,
    department: department
      ? { _id: department._id, code: department.code, name: department.name }
      : null,
    readiness: roleReadiness(gaps),
    gaps,
    path,
    narrative,
    llmSource: narrative?.llmSource ?? null,
    generatedAt: new Date(),
  };
}

/**
 * Computes and snapshots the path.
 *
 * The snapshot is what makes a recommendation auditable: it records the weights
 * and the inputs the engine saw, so a score can be re-derived months later even
 * if the framework has since been revised. Older snapshots stay, marked not
 * current, rather than being overwritten.
 */
export async function recomputeAndStore(userId, precomputed = null) {
  const result = precomputed ?? (await computePath(userId));
  if (!result) return null;

  // experienceYears lives on the Profile, not the User - recorded here so the
  // snapshot explains itself without a join.
  const profile = await Profile.findOne({ user: userId }).select('experienceYears').lean();

  await Recommendation.updateMany({ user: userId, isCurrent: true }, { $set: { isCurrent: false } });

  const stored = await Recommendation.create({
    user: userId,
    isCurrent: true,
    inputs: {
      jobRole: result.jobRole?._id,
      department: result.department?._id,
      experienceYears: profile?.experienceYears,
      weights: PRIORITY_WEIGHTS,
    },
    items: result.path.map((item) => ({
      competency: item.competencyId,
      currentLevel: item.currentLevel,
      requiredLevel: item.requiredLevel,
      gap: item.gap,
      priority: item.priority,
      band: item.band,
      mandatory: item.mandatory,
      courses: item.courses.map((entry) => ({
        course: entry.course,
        matchScore: entry.matchScore,
        reason: entry.reason,
      })),
    })),
    narrative: result.narrative?.summary,
    llmSource: result.narrative?.llmSource ?? 'mock',
  });

  return { ...result, recommendationId: stored._id };
}

/**
 * What a snapshot is *of*: the competencies, their levels and their ranking.
 * Timestamps and course match scores are excluded, so re-reading the same page
 * does not manufacture a new "change" in the audit trail.
 *
 * The two sides carry the competency differently - a stored item holds an id in
 * `competency`, a computed row holds the populated document there and the id in
 * `competencyId` - so the id is normalised before comparison. Reading the wrong
 * one stringifies a document and every read looks like a change.
 */
function fingerprint(items) {
  return items
    .map((item) => {
      const id = item.competencyId ?? item.competency?._id ?? item.competency;
      return `${id}:${item.currentLevel}>${item.requiredLevel}:${item.band}`;
    })
    .join('|');
}

/**
 * Read path. Computes fresh - gap arithmetic is cheap and the officer should see
 * the effect of a level recorded a minute ago - and writes a new snapshot only
 * when the ranking actually differs from the current one. The narrative comes
 * back from the LLM cache unchanged while the numbers are unchanged, so a page
 * refresh neither reshuffles the path nor spends a model call.
 */
export async function currentPath(userId) {
  const result = await computePath(userId);
  if (!result) return null;

  const current = await Recommendation.findOne({ user: userId, isCurrent: true }).lean();

  if (!current || fingerprint(current.items ?? []) !== fingerprint(result.path)) {
    return recomputeAndStore(userId, result);
  }

  return { ...result, recommendationId: current._id };
}
