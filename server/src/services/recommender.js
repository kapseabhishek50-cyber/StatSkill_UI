import { MAX_LEVEL } from '../config/competency.js';

/**
 * Course matching.
 *
 * Skill-tag overlap plus a level-fit term - no embeddings, no vector store.
 * That is a deliberate prototype choice: with a few hundred courses this ranks
 * as well as semantic search and every score is explainable to a reviewer. The
 * seam for embeddings is `semanticBoost` below: give it a real cosine score
 * later and nothing else in the pipeline changes.
 */

const LEVEL_FIT = {
  /** Course lands inside the learner's actual gap window - ideal. */
  inWindow: 1,
  /** One level beyond the requirement - useful, slightly over-specified. */
  above: 0.6,
  /** At or below what the learner already has - revision at best. */
  below: 0.15,
};

/**
 * How well a course's target level fits a learner sitting at `currentLevel`
 * and needing `requiredLevel`. The window is the next level up to the
 * requirement: recommending a level-2 primer to someone already at 3 is the
 * most common way naive matching embarrasses itself.
 */
export function levelFit({ courseTargetLevel, currentLevel, requiredLevel }) {
  if (courseTargetLevel > currentLevel && courseTargetLevel <= requiredLevel) return LEVEL_FIT.inWindow;
  if (courseTargetLevel > requiredLevel && courseTargetLevel <= Math.min(MAX_LEVEL, requiredLevel + 1)) {
    return LEVEL_FIT.above;
  }
  return LEVEL_FIT.below;
}

/**
 * Ranks courses for one gap row.
 *
 * matchScore = priority x weight x levelFit x (1 + qualityBoost + semanticBoost)
 *
 * `priority` comes straight from the gap engine, so the ordering of the learning
 * path and the ordering of courses inside it agree by construction.
 */
export function rankCoursesForGap(gapRow, courses, { semanticScores = new Map(), limit = 3 } = {}) {
  const scored = [];

  for (const course of courses) {
    const entry = course.competencies?.find(
      (c) => String(c.competency?._id ?? c.competency) === gapRow.competencyId,
    );
    if (!entry) continue;

    const fit = levelFit({
      courseTargetLevel: entry.targetLevel,
      currentLevel: gapRow.currentLevel,
      requiredLevel: gapRow.requiredLevel,
    });
    if (fit === LEVEL_FIT.below) continue;

    // Rating and uptake break ties only - never outrank a better level fit.
    const qualityBoost = (course.rating ?? 0) / 25;
    const semanticBoost = (semanticScores.get(String(course._id)) ?? 0) * 0.2;

    const matchScore =
      gapRow.priority * (entry.weight ?? 1) * fit * (1 + qualityBoost + semanticBoost);

    scored.push({
      course,
      matchScore: Number(matchScore.toFixed(4)),
      reason: buildReason(gapRow, entry, fit),
    });
  }

  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

function buildReason(gapRow, entry, fit) {
  const name = gapRow.competency?.name ?? 'this competency';
  const target = entry.targetLevel;
  if (fit === LEVEL_FIT.inWindow) {
    return `Takes ${name} to level ${target}, inside your level ${gapRow.currentLevel} to ${gapRow.requiredLevel} gap.`;
  }
  return `Covers ${name} at level ${target}, just beyond your role requirement of ${gapRow.requiredLevel}.`;
}

/**
 * Builds the ordered learning path: one entry per open gap, each with its top
 * courses. Courses already recommended earlier in the path are down-weighted so
 * a single broad course does not fill every slot.
 */
export function buildLearningPath(gapRows, courses, { coursesPerGap = 3, maxGaps = 8 } = {}) {
  const seen = new Set();
  const path = [];

  for (const row of gapRows.slice(0, maxGaps)) {
    const ranked = rankCoursesForGap(row, courses, { limit: coursesPerGap + 2 })
      .map((item) => ({
        ...item,
        matchScore: seen.has(String(item.course._id))
          ? Number((item.matchScore * 0.5).toFixed(4))
          : item.matchScore,
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, coursesPerGap);

    ranked.forEach((item) => seen.add(String(item.course._id)));

    path.push({
      competency: row.competency,
      competencyId: row.competencyId,
      currentLevel: row.currentLevel,
      requiredLevel: row.requiredLevel,
      gap: row.gap,
      priority: row.priority,
      band: row.band,
      mandatory: row.mandatory,
      explanation: row.explanation,
      courses: ranked.map((item) => ({
        course: item.course._id,
        courseDetail: item.course,
        matchScore: item.matchScore,
        reason: item.reason,
      })),
    });
  }

  return path;
}
