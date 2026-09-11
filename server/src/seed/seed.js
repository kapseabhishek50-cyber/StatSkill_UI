import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import {
  Assessment,
  AuditLog,
  Competency,
  Course,
  Department,
  JobRole,
  LearningProgress,
  Profile,
  Question,
  QuizResult,
  Recommendation,
  User,
  UserCompetency,
  StreakLog,
  DiscussionGroup,
  DiscussionMessage,
  LearningMaterial,
} from '../models/index.js';
import { MAX_LEVEL, MIN_LEVEL } from '../config/competency.js';
import {
  competencies,
  courses,
  demoUsers,
  departments,
  divisionProfiles,
  jobRoles,
  officerRoster,
  discussionGroups,
} from './data.js';

function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampLevel = (level) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(level)));

async function wipe() {
  const models = [
    User,
    Profile,
    Department,
    JobRole,
    Competency,
    UserCompetency,
    Assessment,
    Question,
    Course,
    Recommendation,
    QuizResult,
    LearningProgress,
    StreakLog,
    DiscussionGroup,
    DiscussionMessage,
    LearningMaterial,
  ];
  await Promise.all(models.map((model) => model.deleteMany({})));

  try {
    await AuditLog.collection.drop();
  } catch {
    // AuditLog never existed
  }
}

async function seedFramework() {
  const departmentDocs = await Department.insertMany(departments);
  const departmentByCode = new Map(departmentDocs.map((doc) => [doc.code, doc._id]));

  const competencyDocs = await Competency.insertMany(competencies);
  const competencyByCode = new Map(competencyDocs.map((doc) => [doc.code, doc._id]));
  const categoryByCode = new Map(competencies.map((row) => [row.code, row.category]));

  const roleDocs = await JobRole.insertMany(
    jobRoles.map((role) => ({
      ...role,
      department: departmentByCode.get(role.department),
      requirements: role.requirements.map((requirement) => ({
        ...requirement,
        competency: competencyByCode.get(requirement.competency),
      })),
    })),
  );
  const roleByCode = new Map(roleDocs.map((doc) => [doc.code, doc]));

  const courseDocs = await Course.insertMany(
    courses.map((course) => ({
      ...course,
      competencies: course.competencies.map((entry) => ({
        ...entry,
        competency: competencyByCode.get(entry.competency),
      })),
    })),
  );

  // Seed Discussion Groups
  const groupDocs = await DiscussionGroup.insertMany(discussionGroups);

  return { departmentByCode, competencyByCode, categoryByCode, roleByCode, courseDocs, groupDocs };
}

function levelsForOfficer({ role, profile, categoryByCode, competencyCodeById, next }) {
  const rows = [];

  for (const requirement of role.requirements) {
    if (next() < 0.08) continue;

    const code = competencyCodeById.get(String(requirement.competency));
    const offset = profile[categoryByCode.get(code)] ?? -1;
    const jitter = next() < 0.5 ? -1 : next() < 0.55 ? 1 : 0;
    const level = clampLevel(requirement.requiredLevel + offset + jitter * next());

    const roll = next();
    const evidence = roll < 0.45 ? 'self_reported' : roll < 0.85 ? 'assessment' : 'quiz';
    const confidence = evidence === 'self_reported' ? 0.4 : evidence === 'assessment' ? 0.75 : 0.9;

    rows.push({
      competency: requirement.competency,
      currentLevel: level,
      evidence,
      confidence,
      history: [{ level, evidence, at: new Date(), note: 'Seeded baseline.' }],
    });
  }

  return rows;
}

async function seedPeople({ departmentByCode, competencyByCode, categoryByCode, roleByCode, groupDocs }) {
  const competencyCodeById = new Map([...competencyByCode.entries()].map(([code, id]) => [String(id), code]));
  const users = [];
  const profiles = [];
  const levels = [];

  for (const demo of demoUsers) {
    const user = new User({
      email: demo.email,
      passwordHash: await bcrypt.hash(demo.password, 12),
      name: demo.name,
      role: demo.role,
      employeeId: demo.employeeId,
      department: departmentByCode.get(demo.department),
      jobRole: demo.jobRole ? roleByCode.get(demo.jobRole)?._id : undefined,
      xp: demo.xp || 0,
      currentStreak: demo.currentStreak || 0,
      longestStreak: demo.longestStreak || 0,
      learningHours: demo.learningHours || 0,
      badges: demo.badges || [],
      lastActiveDate: new Date(),
      isActive: true,
    });
    users.push(user);
    profiles.push({ user: user._id, ...demo.profile });

    for (const row of demo.levels) {
      levels.push({
        user: user._id,
        competency: competencyByCode.get(row.competency),
        currentLevel: row.currentLevel,
        evidence: row.evidence,
        confidence: row.confidence,
        history: [{ level: row.currentLevel, evidence: row.evidence, at: new Date(), note: 'Seeded baseline.' }],
      });
    }
  }

  const rosterHash = await bcrypt.hash('Officer@123', 12);
  const next = rng(20260905);
  let serial = 1;

  for (const group of officerRoster) {
    const role = roleByCode.get(group.jobRole);
    const profile = divisionProfiles[group.department] ?? {};

    for (const name of group.names) {
      const slug = name
        .toLowerCase()
        .replace(/^dr\.?\s+/, '')
        .replace(/[^a-z]+/g, '.')
        .replace(/^\.|\.$/g, '');

      const user = new User({
        email: `${slug}@mospi.gov.in`,
        passwordHash: rosterHash,
        name,
        role: 'learner',
        employeeId: `MOSPI/${group.jobRole}/${2000 + (serial % 24)}/${String(1000 + serial).slice(-4)}`,
        department: departmentByCode.get(group.department),
        jobRole: role._id,
        xp: Math.floor(next() * 300) + 50,
        currentStreak: Math.floor(next() * 6) + 1,
        learningHours: Math.floor(next() * 25) + 5,
        isActive: true,
      });

      users.push(user);
      profiles.push({
        user: user._id,
        designation: role.title,
        experienceYears: 3 + (serial % 18),
        postingLocation: 'Field Office',
      });

      const officerLevels = levelsForOfficer({
        role,
        profile,
        categoryByCode,
        competencyCodeById,
        next,
      });
      for (const row of officerLevels) {
        levels.push({ ...row, user: user._id });
      }

      serial += 1;
    }
  }

  await User.insertMany(users);
  await Profile.insertMany(profiles);
  await UserCompetency.insertMany(levels);

  // Seed sample messages for discussion groups
  const rahul = users.find((u) => u.email === 'rahul.sharma@mospi.gov.in');
  const prof = users.find((u) => u.email === 'trainer@nssta.gov.in');

  if (groupDocs?.length > 0 && rahul && prof) {
    const aimlGroup = groupDocs.find((g) => g.slug === 'ai-ml') || groupDocs[0];
    const pythonGroup = groupDocs.find((g) => g.slug === 'python-analytics') || groupDocs[1];

    await DiscussionMessage.insertMany([
      {
        group: aimlGroup._id,
        user: prof._id,
        authorName: prof.name,
        authorRole: 'trainer',
        content: 'Welcome everyone. In modern official statistics, machine learning models help classify informal sector records and detect survey outliers. What challenges have you faced with imputation?',
        isPinned: true,
      },
      {
        group: aimlGroup._id,
        user: rahul._id,
        authorName: rahul.name,
        authorRole: 'learner',
        content: 'In our NSS round tabulations, handling missing values in small sample strata often biases standard estimators. Can gradient boosting be safely defended under NQAF guidelines?',
      },
      {
        group: aimlGroup._id,
        user: null,
        authorName: 'StatSkill AI Co-pilot',
        authorRole: 'system',
        content: 'Under the National Quality Assurance Framework (NQAF), machine learning imputation (such as XGBoost or MissForest) is permissible provided the imputation rate, variance inflation factor, and method documentation are explicitly published in the metadata circular.',
        isAiGenerated: true,
      },
      {
        group: pythonGroup._id,
        user: rahul._id,
        authorName: rahul.name,
        authorRole: 'learner',
        content: 'Has anyone integrated python automation scripts directly into the monthly price index pipeline? Looking to replace manual spreadsheet validation.',
      },
    ]);

    // Seed 7 days of daily streak logs for Rahul Sharma
    const today = new Date();
    const streakLogs = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      streakLogs.push({
        user: rahul._id,
        dateString: dateStr,
        activityType: i % 2 === 0 ? 'quiz_completed' : 'lesson_completed',
        detail: i % 2 === 0 ? 'Completed Statistical Methodology quiz' : 'Studied Python for Official Statistics',
        xpEarned: i % 2 === 0 ? 35 : 15,
        minutesSpent: 30,
      });
    }
    await StreakLog.insertMany(streakLogs);
  }

  return { users, levels };
}

async function main() {
  const force = process.argv.includes('--force');
  if (env.isProd && !force) {
    console.error('[seed] NODE_ENV=production. Re-run with --force if you want to reset.');
    process.exit(1);
  }

  await connectDb();
  console.log('[seed] resetting collections');
  await wipe();

  const framework = await seedFramework();
  console.log(
    `[seed] framework: ${departments.length} divisions, ${competencies.length} competencies, ` +
      `${jobRoles.length} roles, ${courses.length} courses, ${discussionGroups.length} groups`,
  );

  const { users, levels } = await seedPeople(framework);
  console.log(`[seed] people: ${users.length} accounts, ${levels.length} competency records`);

  // Generate learning path for Rahul Sharma and Ananya Rao
  try {
    const { recomputeAndStore } = await import('../services/learningPath.js');
    const rahul = users.find((user) => user.email === 'rahul.sharma@mospi.gov.in');
    if (rahul) {
      const path = await recomputeAndStore(rahul._id);
      console.log(`[seed] Rahul Sharma learning path: ${path.path.length} courses, ${path.gaps.length} gap rows`);
    }
    const ananya = users.find((user) => user.email === 'officer@mospi.gov.in');
    if (ananya) {
      await recomputeAndStore(ananya._id);
    }
  } catch (error) {
    console.warn(`[seed] skipped learning path pre-calculation: ${error.message}`);
  }

  console.log('\n[seed] done. Demo Persona Credentials:');
  console.log('       Learner : rahul.sharma@mospi.gov.in  Officer@123 (Rahul Sharma - Statistical Officer)');
  console.log('       Learner : officer@mospi.gov.in       Officer@123 (Ananya Rao - Senior Statistical Officer)');
  console.log('       Trainer : trainer@nssta.gov.in       Trainer@123 (Prof. S. Mukherjee - Faculty NSSTA)');
  console.log('       Admin   : admin@mospi.gov.in         Admin@123   (Dr. Vikram Iyer - MoSPI DIID Joint Director)');

  await disconnectDb();
}

main().catch(async (error) => {
  console.error('[seed] failed:', error.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
