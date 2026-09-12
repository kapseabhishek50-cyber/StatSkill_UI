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
import { QUESTION_BANK } from '../data/questionBank';
import { hashPassword } from '../services/auth/password.service';
import { skillGapService } from '../services/skillGap/skillGap.service';
import { ensureCourseEmbedding } from '../services/recommendation/semantic.service';
import { recommendationService } from '../services/recommendation/recommendation.service';
import { levelForXp } from '../config/gamification';
import { UserAchievement } from '../models/UserAchievement';

const log = logger;

// Matches the one-click demo personas on the sign-in screen.
const LEARNER_PASSWORD = 'Officer@123';
const TRAINER_PASSWORD = 'Trainer@123';
const ADMIN_PASSWORD = 'Admin@123';

export const seed = async (): Promise<void> => {
  if (env.isProduction) {
    throw new Error('Refusing to seed demo data in production');
  }
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
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
  const learnerHash = await hashPassword(LEARNER_PASSWORD);
  const trainerHash = await hashPassword(TRAINER_PASSWORD);
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  for (const c of MOCK_COURSES) {
    await Course.create({ ...c, syncStatus: 'OK', lastSyncedAt: new Date() });
  }
  log.info(`Courses: ${MOCK_COURSES.length}`);

  // ---------- 5. Demo users ----------
  const rahulXp = 1240;
  const rahul = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul.sharma@mospi.gov.in',
    passwordHash: learnerHash,
    employeeId: 'MOSPI-0001',
    role: 'LEARNER',
    designation: 'Statistical Officer',
    cadre: 'Indian Statistical Service',
    department: 'National Statistical Office',
    postingLocation: 'New Delhi',
    organization: 'MoSPI',
    experience: 5,
    education: 'M.Sc. Statistics',
    qualifications: ['M.Sc. Statistics', 'PG Diploma in Data Analytics'],
    interests: ['machine learning', 'data analytics', 'official statistics'],
    learningGoals: ['Apply AI/ML to survey data', 'Automate statistical reporting'],
    xp: rahulXp,
    level: levelForXp(rahulXp),
  });
  const trainer = await User.create({
    name: 'Prof. S. Mukherjee',
    email: 'trainer@nssta.gov.in',
    passwordHash: trainerHash,
    employeeId: 'NSSTA-0001',
    role: 'TRAINER',
    designation: 'Training Officer',
    department: 'NSSTA',
    organization: 'NSSTA',
    experience: 9,
  });
  const admin = await User.create({
    name: 'Dr. Vikram Iyer',
    email: 'admin@mospi.gov.in',
    passwordHash: adminHash,
    employeeId: 'MOSPI-0000',
    role: 'ADMIN',
    designation: 'System Administrator',
    department: 'MoSPI',
    organization: 'MoSPI',
    experience: 12,
  });
  // A few more learners so the leaderboard, heatmap and officer directory
  // have realistic depth.
  const extraLearners = [
    { name: 'Anjali Deshmukh', email: 'anjali.deshmukh@mospi.gov.in', employeeId: 'MOSPI-0002', designation: 'Statistical Officer', department: 'Survey Division', experience: 4, xp: 860 },
    { name: 'Vikram Singh', email: 'vikram.singh@des.mh.gov.in', employeeId: 'DESMH-0114', designation: 'Data Scientist (Official Statistics)', department: 'State DES Maharashtra', experience: 6, xp: 1530 },
    { name: 'Meera Krishnan', email: 'meera.krishnan@mospi.gov.in', employeeId: 'MOSPI-0003', designation: 'Statistical Officer', department: 'National Statistical Office', experience: 3, xp: 420 },
    { name: 'Arjun Patil', email: 'arjun.patil@mospi.gov.in', employeeId: 'MOSPI-0004', designation: 'IT Officer (Statistical Systems)', department: 'National Statistical Office', experience: 7, xp: 675 },
  ];
  const learnerDocs = [rahul];
  for (const l of extraLearners) {
    learnerDocs.push(
      await User.create({
        ...l,
        passwordHash: learnerHash,
        role: 'LEARNER',
        organization: 'MoSPI',
        level: levelForXp(l.xp),
      })
    );
  }
  log.info('Users: rahul.sharma@mospi.gov.in / trainer@nssta.gov.in / admin@mospi.gov.in (+4 learners)');

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
  const requirementsFor = async (designation: string): Promise<Map<string, number>> => {
    const map = new Map<string, number>();
    const role =
      (await Role.findOne({ name: designation })) ??
      (await Role.findOne({ name: new RegExp(designation.split(' ')[0], 'i') }));
    for (const req of role?.requirements ?? []) {
      const code = comps.find((c) => String(c._id) === String(req.competencyId))?.code;
      if (code) map.set(code, req.requiredScore);
    }
    return map;
  };
  const seedProfile = async (userId: unknown, scores: Record<string, number>, designation: string) => {
    const requirements = await requirementsFor(designation);
    for (const [code, current] of Object.entries(scores)) {
      const comp = compByCode.get(code);
      if (!comp) continue;
      await UserCompetency.create({
        userId,
        competencyId: comp._id,
        currentScore: current,
        requiredScore: requirements.get(code) ?? comp.defaultRequiredScore,
        confidence: 0.8,
        initialScore: current,
        source: 'ASSESSMENT',
        lastAssessedAt: new Date(Date.now() - 86400000),
      });
    }
    // Competencies outside the demo profile are measured at requirement level
    // so seeded gaps stay focused (AI/ML is THE critical gap for Rahul).
    for (const comp of comps) {
      if (scores[comp.code] !== undefined) continue;
      const required = requirements.get(comp.code) ?? comp.defaultRequiredScore;
      await UserCompetency.create({
        userId,
        competencyId: comp._id,
        currentScore: required,
        requiredScore: required,
        confidence: 0.5,
        initialScore: required,
        source: 'SEED',
        lastAssessedAt: new Date(Date.now() - 86400000),
      });
    }
  };
  await seedProfile(rahul._id, profileScores, 'Statistical Officer');
  log.info(`Demo competency profile for Rahul: ${comps.length} competencies measured`);

  const otherProfiles: Record<string, Record<string, number>> = {
    'Anjali Deshmukh': { SURVEY_DESIGN: 78, SAMPLING: 74, DATA_QUALITY: 70, PYTHON: 55, SQL: 60, DATA_VISUALIZATION: 62, AI_ML: 30, GIS: 40, COMMUNICATION: 72, ETHICS: 80 },
    'Vikram Singh': { PYTHON: 88, AI_ML: 82, SQL: 80, DATA_VISUALIZATION: 75, SAMPLING: 55, DATA_QUALITY: 68, CLOUD: 70, APIS: 65, ETHICS: 62 },
    'Meera Krishnan': { SURVEY_DESIGN: 58, SAMPLING: 52, DATA_QUALITY: 60, PYTHON: 35, SQL: 48, COMMUNICATION: 66, ETHICS: 70, PRICE_STATISTICS: 55 },
    'Arjun Patil': { SQL: 82, APIS: 76, CYBERSECURITY: 72, CLOUD: 68, PYTHON: 60, DATA_PRIVACY: 66, SAMPLING: 40, DATA_QUALITY: 58 },
  };
  for (const doc of learnerDocs.slice(1)) {
    await seedProfile(doc._id, otherProfiles[doc.name] ?? {}, doc.designation ?? '');
    await skillGapService.recalculateForUser(String(doc._id));
  }
  log.info('Competency profiles seeded for extra learners');

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
    for (const member of learnerDocs) {
      await CommunityMember.create({ communityId: community._id, userId: member._id });
    }
    await Message.create({ communityId: community._id, userId: trainer._id, content: `Welcome to ${community.name}! Introduce yourself and share what you're learning.` });
    await Message.create({ communityId: community._id, userId: rahul._id, content: 'Hi everyone! Working on closing my AI/ML gap this quarter.' });
    community.membersCount = 1 + learnerDocs.length;
    await community.save();
  }
  log.info(`Communities: ${communitySeeds.length}`);

  // ---------- 9. Published quizzes from the curated bank ----------
  const bankByCode = new Map<string, typeof QUESTION_BANK>();
  for (const q of QUESTION_BANK) {
    if (!bankByCode.has(q.competencyCode)) bankByCode.set(q.competencyCode, []);
    bankByCode.get(q.competencyCode)!.push(q);
  }
  let published = 0;
  let drafts = 0;
  for (const [code, items] of bankByCode) {
    const comp = compByCode.get(code);
    const topic = comp?.name ?? code;
    const questions = items.map((b, i) => ({
      questionId: `seed-${code.toLowerCase()}-${i + 1}`,
      question: b.question,
      options: [...b.options],
      correctAnswer: b.correctAnswer,
      explanation: b.explanation,
      topic,
      competencyId: comp?._id,
      difficulty: b.difficulty,
      source: 'BANK' as const,
    }));
    // Rich banks publish straight away; thin ones stay drafts for the question-bank demo.
    const status = items.length >= 3 ? 'PUBLISHED' : 'DRAFT';
    await Quiz.create({
      title: `${topic} — Practice Quiz`,
      description: `Curated ${topic} questions for ${comp?.category?.toLowerCase().replace(/_/g, ' ') ?? 'general'} competency practice.`,
      createdBy: trainer._id,
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
      questions,
      durationMinutes: Math.max(5, questions.length * 2),
      attemptCount: 0,
    });
    if (status === 'PUBLISHED') published += 1;
    else drafts += 1;
  }
  log.info(`Quizzes seeded: ${published} published, ${drafts} drafts`);

  // ---------- 10. Enrollments, streaks, achievements, activity history ----------
  const allCourses = await Course.find({}).sort({ title: 1 });
  if (allCourses.length >= 2) {
    const [first, second] = allCourses;
    const moduleCount = Math.max(1, first.modules.length);
    await Enrollment.create({
      userId: rahul._id,
      courseId: first._id,
      status: 'ACTIVE',
      progress: Math.round((Math.min(2, moduleCount) / moduleCount) * 100),
      timeSpentMinutes: 195,
      currentModule: Math.min(2, moduleCount - 1),
      modulesCompleted: Array.from({ length: Math.min(2, moduleCount) }, (_, i) => i),
    });
    await Enrollment.create({
      userId: rahul._id,
      courseId: second._id,
      status: 'COMPLETED',
      progress: 100,
      timeSpentMinutes: 320,
      modulesCompleted: second.modules.map((_, i) => i),
      completedAt: new Date(Date.now() - 6 * 86400000),
    });
    await Enrollment.create({ userId: learnerDocs[2]._id, courseId: first._id, status: 'ACTIVE', progress: 20, timeSpentMinutes: 45 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const streakSeeds: Record<string, { current: number; longest: number; days: number; lastOffset: number; milestone: number }> = {
    'Rahul Sharma': { current: 7, longest: 12, days: 24, lastOffset: 0, milestone: 7 },
    'Anjali Deshmukh': { current: 3, longest: 6, days: 11, lastOffset: 0, milestone: 0 },
    'Vikram Singh': { current: 4, longest: 9, days: 15, lastOffset: 0, milestone: 0 },
    'Meera Krishnan': { current: 2, longest: 5, days: 8, lastOffset: 0, milestone: 0 },
    'Arjun Patil': { current: 3, longest: 7, days: 10, lastOffset: 5, milestone: 0 },
  };
  for (const doc of learnerDocs) {
    const s = streakSeeds[doc.name] ?? { current: 1, longest: 1, days: 1, lastOffset: 0, milestone: 0 };
    await Streak.create({
      userId: doc._id,
      currentStreak: s.current,
      longestStreak: s.longest,
      totalLearningDays: s.days,
      lastActivityDate: new Date(today.getTime() - s.lastOffset * 86400000),
      lastMilestone: s.milestone,
    });
  }
  const achievements = await Achievement.find({});
  const achByCode = new Map(achievements.map((a) => [a.code, a]));
  const unlock = async (userId: unknown, code: string, daysAgo: number) => {
    const a = achByCode.get(code);
    if (!a) return;
    await UserAchievement.create({ userId, achievementId: a._id, progress: 100, isNotified: true, unlockedAt: new Date(Date.now() - daysAgo * 86400000) });
  };
  await unlock(rahul._id, 'FIRST_ASSESSMENT', 20);
  await unlock(rahul._id, 'FIRST_COURSE', 6);
  await unlock(rahul._id, 'SEVEN_DAY_STREAK', 1);
  await unlock(learnerDocs[2]._id, 'FIRST_ASSESSMENT', 12);

  // A believable 60-day activity trail for Rahul (powers the streak heatmap).
  const activityTypes: { type: 'LESSON_COMPLETED' | 'QUIZ_COMPLETED' | 'ASSESSMENT_COMPLETED' | 'DISCUSSION_PARTICIPATION' | 'COURSE_STARTED'; xp: number; title: string }[] = [
    { type: 'LESSON_COMPLETED', xp: 10, title: 'Completed a lesson' },
    { type: 'QUIZ_COMPLETED', xp: 25, title: 'Completed a practice quiz' },
    { type: 'DISCUSSION_PARTICIPATION', xp: 20, title: 'Participated in a community discussion' },
  ];
  const activeOffsets = new Set<number>();
  for (let d = 0; d < 7; d++) activeOffsets.add(d); // current 7-day streak
  [9, 10, 12, 14, 16, 19, 21, 23, 26, 28, 31, 35, 38, 42, 45, 49, 53, 57].forEach((d) => activeOffsets.add(d));
  for (const offset of activeOffsets) {
    const pick = activityTypes[offset % activityTypes.length];
    await LearningActivity.create({
      userId: rahul._id,
      type: pick.type,
      title: pick.title,
      xpAwarded: pick.xp,
      createdAt: new Date(Date.now() - offset * 86400000 - 3600000),
    });
  }

  // ---------- 11. Welcome notifications ----------
  await Notification.insertMany([
    { userId: rahul._id, type: 'SYSTEM', title: 'Welcome to StatSkill AI', body: 'Your assessment is complete — check your personalised recommendations.' },
    { userId: rahul._id, type: 'COURSE_RECOMMENDED', title: 'New recommendations ready', body: 'Machine Learning for Statistical Analysis matches your biggest skill gap.', data: { skillCode: 'AI_ML' } },
  ]);

  log.info('✅ Seed complete.');
  log.info('   Demo logins (see the sign-in screen for one-click access):');
  log.info(`   • rahul.sharma@mospi.gov.in  (LEARNER — ${LEARNER_PASSWORD})`);
  log.info(`   • trainer@nssta.gov.in       (TRAINER — ${TRAINER_PASSWORD})`);
  log.info(`   • admin@mospi.gov.in         (ADMIN — ${ADMIN_PASSWORD})`);
};

const isRunDirectly =
  typeof process.argv[1] === 'string' &&
  process.argv[1].toLowerCase().endsWith('seed.ts') ||
  process.argv[1].toLowerCase().endsWith('seed.js');

if (isRunDirectly) {
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
}
