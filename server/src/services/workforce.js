import { Department, JobRole, User, UserCompetency } from '../models/index.js';
import { computeGaps, roleReadiness } from './gapEngine.js';
import { priorityBand } from '../config/competency.js';

/**
 * Workforce roll-up for the admin analytics.
 *
 * The aggregation runs in application code rather than as a Mongo pipeline. That
 * is a deliberate trade: expressing the priority formula in aggregation operators
 * would mean maintaining it in two languages, and the day the two disagree the
 * dashboard and the learner's own path start telling different stories. At
 * ministry-division scale - thousands of officers, not millions - one pass over
 * the competency records is cheap enough that correctness wins.
 *
 * Every figure returned is an aggregate. No officer is named, and nothing here
 * carries a user id out to the client.
 */

/** One pass: every profiled officer's gap rows, scored the same way as their own path. */
export async function rollup() {
  const [learners, departments, roles, records] = await Promise.all([
    User.find({ role: 'learner', isActive: true }).select('_id department jobRole').lean(),
    Department.find().select('_id code name priority').lean(),
    JobRole.find().populate('requirements.competency', 'code name category futureDemand').lean(),
    UserCompetency.find().select('user competency currentLevel').lean(),
  ]);

  const levelsByUser = new Map();
  for (const record of records) {
    const key = String(record.user);
    if (!levelsByUser.has(key)) levelsByUser.set(key, new Map());
    levelsByUser.get(key).set(String(record.competency), record.currentLevel);
  }

  const roleById = new Map(roles.map((role) => [String(role._id), role]));
  const departmentById = new Map(departments.map((department) => [String(department._id), department]));

  const officers = [];
  for (const learner of learners) {
    const role = roleById.get(String(learner.jobRole));
    const currentLevels = levelsByUser.get(String(learner._id));

    // "Profiled" means a role to measure against and at least one recorded level.
    // Counting untouched accounts would make every division look worse than it is.
    if (!role || !currentLevels?.size) continue;

    const department = departmentById.get(String(learner.department)) ?? null;
    const rows = computeGaps({
      requirements: role.requirements ?? [],
      currentLevels,
      departmentPriority: department?.priority ?? 0.5,
    });

    officers.push({
      departmentId: department ? String(department._id) : null,
      rows,
      readiness: roleReadiness(rows),
      hasOpenGap: rows.some((row) => row.gap > 0),
    });
  }

  return { officers, departments };
}

/** Division x competency mean gap. */
export function buildHeatmap({ officers, departments }) {
  const competencies = new Map();
  const totals = new Map(); // "deptId:competencyId" -> { sum, count }

  for (const officer of officers) {
    if (!officer.departmentId) continue;
    for (const row of officer.rows) {
      const competency = row.competency;
      if (!competency?._id) continue;
      const competencyId = String(competency._id);
      competencies.set(competencyId, {
        id: competencyId,
        code: competency.code,
        name: competency.name,
        category: competency.category,
      });

      const key = `${officer.departmentId}:${competencyId}`;
      const entry = totals.get(key) ?? { sum: 0, count: 0 };
      entry.sum += row.gap;
      entry.count += 1;
      totals.set(key, entry);
    }
  }

  const used = new Set(officers.map((officer) => officer.departmentId));
  const cells = [...totals.entries()].map(([key, entry]) => {
    const [departmentId, competencyId] = key.split(':');
    return {
      departmentId,
      competencyId,
      meanGap: Number((entry.sum / entry.count).toFixed(4)),
      officers: entry.count,
    };
  });

  return {
    departments: departments
      .filter((department) => used.has(String(department._id)))
      .map((department) => ({ id: String(department._id), code: department.code, name: department.name })),
    competencies: [...competencies.values()].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
    cells,
  };
}

/**
 * Widest workforce gaps: mean priority per competency, optionally within one
 * division. Levels are means too, so a row reads "the division sits at 1.8 where
 * the roles need 3.4" rather than implying a single officer's position.
 */
export function buildGapRanking({ officers }, { departmentId = null, limit = 10 } = {}) {
  const buckets = new Map();

  for (const officer of officers) {
    if (departmentId && officer.departmentId !== departmentId) continue;
    for (const row of officer.rows) {
      if (row.gap <= 0) continue;
      const competencyId = row.competencyId;
      const bucket = buckets.get(competencyId) ?? {
        competency: row.competency,
        competencyId,
        priority: 0,
        currentLevel: 0,
        requiredLevel: 0,
        officers: 0,
        mandatory: false,
      };
      bucket.priority += row.priority;
      bucket.currentLevel += row.currentLevel;
      bucket.requiredLevel += row.requiredLevel;
      bucket.officers += 1;
      bucket.mandatory = bucket.mandatory || row.mandatory;
      buckets.set(competencyId, bucket);
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const priority = Number((bucket.priority / bucket.officers).toFixed(4));
      return {
        competencyId: bucket.competencyId,
        competency: bucket.competency,
        officers: bucket.officers,
        currentLevel: Number((bucket.currentLevel / bucket.officers).toFixed(1)),
        requiredLevel: Number((bucket.requiredLevel / bucket.officers).toFixed(1)),
        priority,
        band: priorityBand(priority),
        mandatory: bucket.mandatory,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}
