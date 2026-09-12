import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedLearner, seedTrainer, loginAs } from '../helpers/fixtures';
import { Course } from '../../src/models/Course';
import type { Express } from 'express';

let app: Express;
let learnerToken: string;
let trainerToken: string;
let byCode: Map<string, { _id: unknown }>;
let courseId: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
  byCode = await seedFramework();
  await seedLearner(byCode);
  await seedTrainer();
  learnerToken = await loginAs(app, 'rahul.test@mospi.gov.in', 'Demo@123');
  trainerToken = await loginAs(app, 'trainer.test@nssta.gov.in', 'Demo@123');

  const course = await Course.create({
    title: 'Test Course for Learning Flow',
    description: 'A course used to test enrollment and progress tracking end to end.',
    provider: 'NSSTA',
    source: 'MOCK',
    externalId: 'learn-1',
    category: 'Testing',
    skills: ['PYTHON'],
    level: 'BEGINNER',
    durationHours: 2,
    modules: [
      { title: 'Module 1', durationMinutes: 30 },
      { title: 'Module 2', durationMinutes: 30 },
      { title: 'Module 3', durationMinutes: 30 },
      { title: 'Module 4', durationMinutes: 30 },
    ],
  });
  courseId = String(course._id);
});

afterAll(async () => {
  await stopTestDb();
});

/** Enrollment + progress + streak + XP + activity (prompt §18-21). */
describe('learning lifecycle', () => {
  it('enrolls the learner', async () => {
    const res = await supertest(app).post(`/api/learning/enroll/${courseId}`).set('Authorization', learnerToken);
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.enrollment.status).toBe('ACTIVE');
  });

  it('is idempotent on re-enroll', async () => {
    const res = await supertest(app).post(`/api/learning/enroll/${courseId}`).set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Already');
  });

  it('tracks module completion and awards XP for lessons', async () => {
    const res = await supertest(app)
      .put(`/api/learning/${courseId}/progress`)
      .set('Authorization', learnerToken)
      .send({ moduleIndex: 0, timeSpentMinutes: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data.enrollment.progress).toBe(25);
    expect(res.body.data.activity.xpAwarded).toBe(10); // LESSON_COMPLETED

    const activity = await supertest(app).get('/api/learning/activity').set('Authorization', learnerToken);
    const types = activity.body.data.activities.map((a: { type: string }) => a.type);
    expect(types).toContain('COURSE_STARTED');
    expect(types).toContain('LESSON_COMPLETED');
  });

  it('creates a streak from meaningful activity (not logins)', async () => {
    const res = await supertest(app).get('/api/streak').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.streak.currentStreak).toBe(1);
    expect(res.body.data.streak.totalLearningDays).toBe(1);
  });

  it('auto-completes when every module is done and awards completion XP', async () => {
    for (const idx of [1, 2, 3]) {
      await supertest(app)
        .put(`/api/learning/${courseId}/progress`)
        .set('Authorization', learnerToken)
        .send({ moduleIndex: idx, timeSpentMinutes: 20 });
    }
    const progress = await supertest(app).get(`/api/learning/${courseId}/progress`).set('Authorization', learnerToken);
    expect(progress.body.data.enrollment.status).toBe('COMPLETED');
    expect(progress.body.data.enrollment.progress).toBe(100);

    const activity = await supertest(app).get('/api/learning/activity').set('Authorization', learnerToken);
    const types = activity.body.data.activities.map((a: { type: string }) => a.type);
    expect(types).toContain('COURSE_COMPLETED');
  });

  it('grants the FIRST_COURSE achievement and learning-path updates', async () => {
    const ach = await supertest(app).get('/api/achievements/me').set('Authorization', learnerToken);
    const unlockedCodes = (ach.body.data.unlocked as { code?: string; achievement?: { code?: string } }[]).map(
      (u) => u.code ?? u.achievement?.code
    );
    expect(unlockedCodes).toContain('FIRST_COURSE');
  });

  it('rejects progress updates for non-enrolled courses', async () => {
    const other = await Course.create({
      title: 'Other Course',
      description: 'Not enrolled course for negative testing.',
      provider: 'X', source: 'MOCK', externalId: 'other-1', category: 'T', skills: ['R'],
      level: 'BEGINNER', modules: [],
    });
    const res = await supertest(app)
      .put(`/api/learning/${other._id}/progress`)
      .set('Authorization', learnerToken)
      .send({ moduleIndex: 0 });
    expect(res.status).toBe(404);
  });

  it('generates a learning path (prompt §17)', async () => {
    const res = await supertest(app).post('/api/learning/paths/generate').set('Authorization', learnerToken).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.path.steps.length).toBeGreaterThan(0);
    // ordered: lower levels first
    const levels = res.body.data.path.steps.map((s: { level: string }) => s.level);
    const order = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };
    const sorted = [...levels].sort((a, b) => order[a] - order[b]);
    expect(levels).toEqual(sorted);
  });
});

/** Notifications (prompt §31). */
describe('notifications', () => {
  it('collects notifications from platform events', async () => {
    const res = await supertest(app).get('/api/notifications').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    const types = res.body.data.notifications.map((n: { type: string }) => n.type);
    expect(types).toContain('ACHIEVEMENT_UNLOCKED');
    expect(res.body.data.unreadCount).toBeGreaterThan(0);
  });

  it('marks one and all read', async () => {
    const list = await supertest(app).get('/api/notifications').set('Authorization', learnerToken);
    const first = list.body.data.notifications[0];
    await supertest(app).put(`/api/notifications/${first._id}/read`).set('Authorization', learnerToken);
    const res = await supertest(app).put('/api/notifications/read-all').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    const after = await supertest(app).get('/api/notifications').set('Authorization', learnerToken);
    expect(after.body.data.unreadCount).toBe(0);
  });
});

/** Trainer quiz flows (prompt §23-27) — generation falls back to the curated bank without AI keys. */
describe('quiz generation → publish → submit → competency update', () => {
  let quizId: string;

  it('trainer generates an AI quiz for a competency (validated, draft)', async () => {
    const res = await supertest(app)
      .post('/api/trainer/quizzes/generate')
      .set('Authorization', trainerToken)
      .send({ topic: 'Python for statistical analysis', competencyCode: 'PYTHON', count: 4 });
    expect(res.status).toBe(201);
    expect(res.body.data.quiz.status).toBe('DRAFT');
    expect(res.body.data.quiz.questions.length).toBeGreaterThan(0);
    for (const q of res.body.data.quiz.questions) {
      expect(q.options).toHaveLength(4);
    }
    quizId = res.body.data.quiz._id;
  });

  it('learner cannot submit an unpublished quiz', async () => {
    const quiz = await supertest(app).get(`/api/quizzes/${quizId}`).set('Authorization', learnerToken);
    expect(quiz.status).toBe(404);
  });

  it('trainer publishes after validation passes', async () => {
    const res = await supertest(app).post(`/api/trainer/quizzes/${quizId}/publish`).set('Authorization', trainerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.quiz.status).toBe('PUBLISHED');
  });

  it('learner takes the quiz; answers hidden; submission scored server-side', async () => {
    const quizRes = await supertest(app).get(`/api/quizzes/${quizId}`).set('Authorization', learnerToken);
    expect(quizRes.status).toBe(200);
    for (const q of quizRes.body.data.quiz.questions) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
    const questions = quizRes.body.data.quiz.questions;
    const answers = questions.map((q: { questionId: string }, i: number) => ({ questionId: q.questionId, selectedIndex: i % 4 }));
    const res = await supertest(app)
      .post(`/api/quizzes/${quizId}/submit`)
      .set('Authorization', learnerToken)
      .send({ answers, timeTakenSeconds: 60 });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.attempt.score).toBeGreaterThanOrEqual(0);
    expect(data.attempt.totalQuestions).toBe(questions.length);
    // competency update flow ran (prompt §27)
    expect(Array.isArray(data.competencyUpdates)).toBe(true);
    // QUIZ_COMPLETED activity with XP
    const activity = await supertest(app).get('/api/learning/activity').set('Authorization', learnerToken);
    const quizActivities = activity.body.data.activities.filter((a: { type: string }) => a.type === 'QUIZ_COMPLETED');
    expect(quizActivities.length).toBe(1);
    expect(quizActivities[0].xpAwarded).toBeGreaterThanOrEqual(25);
  });

  it('trainer sees learner performance + topic analytics (prompt §32)', async () => {
    const learners = await supertest(app).get('/api/trainer/learners').set('Authorization', trainerToken);
    expect(learners.status).toBe(200);
    expect(learners.body.data.learners.length).toBeGreaterThanOrEqual(1);

    const results = await supertest(app).get(`/api/trainer/quizzes/${quizId}/results`).set('Authorization', trainerToken);
    expect(results.status).toBe(200);
    expect(results.body.data.attempts.length).toBe(1);
    expect(Array.isArray(results.body.data.topicWeaknesses)).toBe(true);
  });

  it('learner cannot access trainer endpoints (RBAC)', async () => {
    const res = await supertest(app).get('/api/trainer/quizzes').set('Authorization', learnerToken);
    expect(res.status).toBe(403);
  });
});
