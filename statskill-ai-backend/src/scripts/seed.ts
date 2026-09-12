/**
 * Development/demo seed (prompt §50-51). NEVER run in production — the
 * production system uses real configured data providers and database data.
 *
 * Seeds: competency taxonomy, roles, achievements, demo users (incl. Rahul
 * Sharma), the demo course catalogue (with embeddings), skill gaps for the
 * demo learner, communities, and an initial recommendation set.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Competency } from '../models/Competency';
import { Role } from '../models/Role';
import { Achievement } from '../models/Achievement';
import { User } from '../models/User';
import { UserCompetency } from '../models/UserCompetency';
import { SkillGap } from '../models/SkillGap';
import { Course } from '../models/Course';
import { CourseEmbedding } from '../models/CourseEmbedding';
import { Enrollment } from '../models/Enrollment';
import { LearningActivity } from '../models/LearningActivity';
import { LearningPath } from '../models/LearningPath';
import { Community } from '../models/Community';
import { CommunityMember } from '../models/CommunityMember';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Recommendation } from '../models/Recommendation';
import { Streak } from '../models/Streak';
import { Quiz } from '../models/Quiz';
import { QuizAttempt } from '../models/QuizAttempt';
import { Material } from '../models/Material';
import { MaterialChunk } from '../models/MaterialChunk';
import { Assessment } from '../models/Assessment';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { AuditLog } from '../models/AuditLog';
import { UserProfileEmbedding } from '../models/UserProfileEmbedding';
import { COMPETENCY_TAXONOMY } from '../data/competencyTaxonomy';
import { ROLE_SEED } from '../data/roles';
import { ACHIEVEMENT_SEED } from '../data/achievements';
import { MOCK_COURSES } from '../data/mockCourses';
import { hashPassword } from '../services/auth/password.service';
import { skillGapService } from '../services/skillGap/skillGap.service';
import { ensureCourseEmbedding } from '../services/recommendation/semantic.service';
import { recommendationService } from '../services/recommendation/recommendation.service';

const log = logger;

const DEMO_PASSWORD = 'Demo@123';

const seed = async (): Promise<void> => {
  if (env.isProduction) {
    throw new Error('Refusing to seed demo data in production');
  }
  await connectDatabase();
  log.info('Clearing existing collections…');
  await Promise.all([
    Competency.deleteMany({}), Role.deleteMany({}), Achievement.deleteMany({}), User.deleteMany({}),
    UserCompetency.deleteMany({}), SkillGap.deleteMany({}), Course.deleteMany({}), CourseEmbedding.deleteMany({}),
    Enrollment.deleteMany({}), LearningActivity.deleteMany({}), LearningPath.deleteMany({}),
    Community.deleteMany({}), CommunityMember.deleteMany({}), Message.deleteMany({}),
    Notification.deleteMany({}), Recommendation.deleteMany({}), Streak.deleteMany({}),
    Quiz.deleteMany({}), QuizAttempt.deleteMany({}), Material.deleteMany({}), MaterialChunk.deleteMany({}),
    Assessment.deleteMany({}), AssessmentAttempt.deleteMany({}), AuditLog.deleteMany({}),
    UserProfileEmbedding.deleteMany({}),
  ]);

  // ---------- 1. Competency taxonomy ----------
  await Competency.insertMany(COMPETENCY_TAXONOMY.map((c) => ({ ...c })));
  log.info(`Competencies: ${COMPETENCY_TAXONOMY.length}`);

  // ---------- 2. Roles with requirement matrices ----------
  const comps = await Competency.find({});
  const compByCode = new Map(comps.map((c) => [c.code, c]));
  await Role.insertMany(
    ROLE_SEED.map((r) => ({
      name: r.name,
      code: r.code,
      description: r.description,
      department: r.department,
      requirements: Object.entries(r.requirements)
        .map(([code, score]) => ({
          competencyId: compByCode.get(code)?._id,
          requiredScore: score,
          weight: r.weights?.[code] ?? 1,
        }))
        .filter((x) => x.competencyId),
    }))
  );
  log.info(`Roles: ${ROLE_SEED.length}`);

  // ---------- 3. Achievements ----------
  await Achievement.insertMany(ACHIEVEMENT_SEED);
  log.info(`Achievements: ${ACHIEVEMENT_SEED.length}`);

  // ---------- 4. Demo courses (embed the catalogue) ----------
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const c of MOCK_COURSES) {
    await Course.create({ ...c, syncStatus: 'OK', lastSyncedAt: new Date() });
  }
  log.info(`Courses: ${MOCK_COURSES.length}`);

  // ---------- 5. Demo users ----------
  const rahul = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul.sharma@mospi.gov.in',
    passwordHash,
    employeeId: 'MOSPI-0001',
    role: 'LEARNER',
    designation: 'Statistical Officer',
    department: 'National Statistical Office',
    organization: 'MoSPI',
    experience: 5,
    education: 'M.Sc. Statistics',
    interests: ['machine learning', 'data analytics', 'official statistics'],
    learningGoals: ['Apply AI/ML to survey data', 'Automate statistical reporting'],
  });
  const trainer = await User.create({
    name: 'Priya Nair',
    email: 'priya.nair@nssta.gov.in',
    passwordHash,
    employeeId: 'NSSTA-0001',
    role: 'TRAINER',
    designation: 'Training Officer',
    department: 'NSSTA',
    organization: 'NSSTA',
    experience: 9,
  });
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@mospi.gov.in',
    passwordHash,
    employeeId: 'MOSPI-0000',
    role: 'ADMIN',
    designation: 'System Administrator',
    department: 'MoSPI',
    organization: 'MoSPI',
    experience: 12,
  });
  log.info('Users: rahul.sharma@mospi.gov.in / priya.nair@nssta.gov.in / admin@mospi.gov.in');

  // ---------- 6. Demo competency profile for Rahul (prompt §51) ----------
  const profileScores: Record<string, number> = {
    SURVEY_DESIGN: 82,
    SAMPLING: 80,
    DATA_QUALITY: 75,
    NATIONAL_ACCOUNTS: 70,
    PRICE_STATISTICS: 68,
    LABOUR_STATISTICS: 72,
    SDG_INDICATORS: 66,
    PYTHON: 42,
    SQL: 65,
    DATA_VISUALIZATION: 55,
    AI_ML: 25,
    GIS: 35,
    COMMUNICATION: 70,
    ETHICS: 78,
    CYBERSECURITY: 45,
    DATA_PRIVACY: 50,
  };
  const role = await Role.findOne({ code: 'STATISTICAL_OFFICER' });
  const requirements = new Map<string, number>();
  for (const req of role?.requirements ?? []) {
    const code = comps.find((c) => String(c._id) === String(req.competencyId))?.code;
    if (code) requirements.set(code, req.requiredScore);
  }
  for (const [code, current] of Object.entries(profileScores)) {
    const comp = compByCode.get(code);
    if (!comp) continue;
    await UserCompetency.create({
      userId: rahul._id,
      competencyId: comp._id,
      currentScore: current,
      requiredScore: requirements.get(code) ?? comp.defaultRequiredScore,
      confidence: 0.8,
      initialScore: current,
      source: 'ASSESSMENT',
      lastAssessedAt: new Date(Date.now() - 86400000),
    });
  }
  // Competencies not in the demo profile are measured at their requirement level
  // so the seeded gaps stay focused on the §51 profile (AI/ML is THE critical gap).
  for (const comp of comps) {
    if (profileScores[comp.code] !== undefined) continue;
    const required = requirements.get(comp.code) ?? comp.defaultRequiredScore;
    await UserCompetency.create({
      userId: rahul._id,
      competencyId: comp._id,
      currentScore: required,
      requiredScore: required,
      confidence: 0.5,
      initialScore: required,
      source: 'SEED',
      lastAssessedAt: new Date(Date.now() - 86400000),
    });
  }
  log.info(`Demo competency profile for Rahul: ${comps.length} competencies measured`);

  // ---------- 7. Skill gaps + course embeddings + initial recommendations ----------
  const gaps = await skillGapService.recalculateForUser(String(rahul._id));
  const openGaps = gaps.filter((g) => g.gap > 0);
  log.info(`Skill gaps for Rahul: ${openGaps.length} open (top: ${openGaps[0]?.competencyCode} gap ${openGaps[0]?.gap})`);

  const courses = await Course.find({});
  for (const course of courses) {
    await ensureCourseEmbedding(course, true);
  }
  log.info(`Course embeddings generated: ${courses.length}`);

  const recommendations = await recommendationService.refreshForUser(String(rahul._id), { useAI: false });
  log.info(`Initial recommendations for Rahul:`);
  recommendations.forEach((r, i) => log.info(`  ${i + 1}. ${r.skillName ?? r.skillCode} → match ${r.matchScore} (${r.reasonSource} reason)`));

  // ---------- 8. Demo communities ----------
  const communitySeeds = [
    { name: 'AI in Official Statistics', description: 'Discuss ML/AI applications in statistical workflows.', category: 'Technology' },
    { name: 'Survey Methodologists', description: 'Survey design, sampling weights and field operations.', category: 'Statistical Methods' },
    { name: 'Data Visualization Guild', description: 'Dashboards, charts and statistical communication.', category: 'Skills' },
  ];
  for (const seedData of communitySeeds) {
    const community = await Community.create({ ...seedData, createdBy: trainer._id, membersCount: 0 });
    await CommunityMember.create({ communityId: community._id, userId: trainer._id, role: 'MODERATOR' });
    await CommunityMember.create({ communityId: community._id, userId: rahul._id });
    await Message.create({ communityId: community._id, userId: trainer._id, content: `Welcome to ${community.name}! Introduce yourself and share what you're learning.` });
    await Message.create({ communityId: community._id, userId: rahul._id, content: 'Hi everyone! Working on closing my AI/ML gap this quarter.' });
    community.membersCount = 2;
    await community.save();
  }
  log.info(`Communities: ${communitySeeds.length}`);

  // ---------- 9. Welcome notifications ----------
  await Notification.insertMany([
    { userId: rahul._id, type: 'SYSTEM', title: 'Welcome to StatSkill AI', body: 'Your assessment is complete — check your personalised recommendations.' },
    { userId: rahul._id, type: 'COURSE_RECOMMENDED', title: 'New recommendations ready', body: 'Machine Learning for Statistical Analysis matches your biggest skill gap.', data: { skillCode: 'AI_ML' } },
  ]);

  log.info('✅ Seed complete.');
  log.info(`   Demo logins (password: ${DEMO_PASSWORD}):`);
  log.info('   • rahul.sharma@mospi.gov.in  (LEARNER — Statistical Officer)');
  log.info('   • priya.nair@nssta.gov.in    (TRAINER)');
  log.info('   • admin@mospi.gov.in         (ADMIN)');
};

seed()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    log.error({ err: err.message, stack: err.stack }, 'Seed failed');
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
