import { Competency } from '../../src/models/Competency';
import { Role } from '../../src/models/Role';
import { User } from '../../src/models/User';
import { UserCompetency } from '../../src/models/UserCompetency';
import { Course } from '../../src/models/Course';
import { Achievement } from '../../src/models/Achievement';
import { COMPETENCY_TAXONOMY } from '../../src/data/competencyTaxonomy';
import { ACHIEVEMENT_SEED } from '../../src/data/achievements';
import { hashPassword } from '../../src/services/auth/password.service';

/** Seeds the competency taxonomy + the Statistical Officer role matrix. */
export const seedFramework = async () => {
  await Competency.insertMany(COMPETENCY_TAXONOMY.map((c) => ({ ...c })));
  const comps = await Competency.find({});
  const byCode = new Map(comps.map((c) => [c.code, c]));
  await Role.create({
    name: 'Statistical Officer',
    code: 'STATISTICAL_OFFICER',
    description: 'test role',
    requirements: [
      { competencyId: byCode.get('SURVEY_DESIGN')!._id, requiredScore: 75, weight: 1 },
      { competencyId: byCode.get('SAMPLING')!._id, requiredScore: 75, weight: 1 },
      { competencyId: byCode.get('DATA_QUALITY')!._id, requiredScore: 70, weight: 0.9 },
      { competencyId: byCode.get('PYTHON')!._id, requiredScore: 60, weight: 0.8 },
      { competencyId: byCode.get('AI_ML')!._id, requiredScore: 70, weight: 0.7 },
      { competencyId: byCode.get('SQL')!._id, requiredScore: 60, weight: 0.7 },
      { competencyId: byCode.get('DATA_VISUALIZATION')!._id, requiredScore: 60, weight: 0.6 },
      { competencyId: byCode.get('GIS')!._id, requiredScore: 30, weight: 0.4 },
    ],
  });
  await Achievement.insertMany(ACHIEVEMENT_SEED);
  return byCode;
};

export const seedCourses = async () => {
  const { MOCK_COURSES } = await import('../../src/data/mockCourses');
  await Course.insertMany(MOCK_COURSES.map((c) => ({ ...c, syncStatus: 'OK' as const, lastSyncedAt: new Date() })));
};

/** Rahul-shaped learner (prompt §51/§53): AI/ML 25 vs required 70 etc. */
export const seedLearner = async (byCode: Map<string, { _id: unknown }>) => {
  const passwordHash = await hashPassword('Demo@123');
  const learner = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul.test@mospi.gov.in',
    passwordHash,
    role: 'LEARNER',
    designation: 'Statistical Officer',
    department: 'National Statistical Office',
    experience: 5,
    interests: ['machine learning', 'data analytics'],
  });
  const scores: Record<string, number> = {
    SURVEY_DESIGN: 82,
    SAMPLING: 80,
    DATA_QUALITY: 75,
    PYTHON: 42,
    SQL: 65,
    AI_ML: 25,
    GIS: 35,
    DATA_VISUALIZATION: 55,
  };
  for (const comp of await Competency.find({})) {
    const current = scores[comp.code] ?? comp.defaultRequiredScore;
    await UserCompetency.create({
      userId: learner._id,
      competencyId: comp._id,
      currentScore: current,
      requiredScore: byCode.get(comp.code) ? (scores[comp.code] !== undefined ? comp.defaultRequiredScore : comp.defaultRequiredScore) : comp.defaultRequiredScore,
      source: 'ASSESSMENT',
    });
  }
  // fix required scores per role matrix
  const role = await Role.findOne({ code: 'STATISTICAL_OFFICER' }).populate('requirements.competencyId');
  for (const req of role?.requirements ?? []) {
    const code = (req.competencyId as unknown as { code: string }).code;
    await UserCompetency.updateOne(
      { userId: learner._id, competencyId: byCode.get(code)!._id },
      { requiredScore: req.requiredScore }
    );
  }
  return learner;
};

export const seedTrainer = async () => {
  const passwordHash = await hashPassword('Demo@123');
  return User.create({
    name: 'Priya Nair',
    email: 'trainer.test@nssta.gov.in',
    passwordHash,
    role: 'TRAINER',
    designation: 'Training Officer',
  });
};

export const seedAdmin = async () => {
  const passwordHash = await hashPassword('Admin@123');
  return User.create({
    name: 'Admin',
    email: 'admin.test@mospi.gov.in',
    passwordHash,
    role: 'ADMIN',
  });
};

/** Login helper returning an Authorization header value. */
export const loginAs = async (app: import('express').Express, email: string, password: string): Promise<string> => {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return `Bearer ${res.body.data.accessToken}`;
};
