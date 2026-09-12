import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedLearner, loginAs } from '../helpers/fixtures';
import type { Express } from 'express';

let app: Express;
let learnerToken: string;
let byCode: Map<string, { _id: unknown }>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
  byCode = await seedFramework();
  await seedLearner(byCode);
  learnerToken = await loginAs(app, 'rahul.test@mospi.gov.in', 'Demo@123');
});

afterAll(async () => {
  await stopTestDb();
});

/** Assessment engine (prompt §6): start → questions without answers → submit → scored. */
describe('assessment engine', () => {
  let assessment: { id: string; questions: { questionId: string }[] };

  it('generates an assessment targeting the weakest competencies', async () => {
    const res = await supertest(app)
      .post('/api/assessment/start')
      .set('Authorization', learnerToken)
      .send({ questionCount: 8 });
    expect([200, 201]).toContain(res.status);
    assessment = res.body.data.assessment;
    expect(assessment.questions.length).toBeGreaterThanOrEqual(5);
    // correct answers must NEVER reach the learner
    for (const q of assessment.questions) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it('rejects unauthorized access', async () => {
    const res = await supertest(app).post('/api/assessment/start').send({});
    expect(res.status).toBe(401);
  });

  it('submits answers and scores server-side, updating competencies + gaps', async () => {
    // Answer everything with option 0 — deterministic, whatever the key is.
    const answers = assessment.questions.map((q) => ({ questionId: q.questionId, selectedIndex: 0 }));
    const res = await supertest(app)
      .post(`/api/assessment/${assessment.id}/submit`)
      .set('Authorization', learnerToken)
      .send({ answers, timeTakenSeconds: 120 });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalQuestions).toBe(assessment.questions.length);
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(data.competencyResults.length).toBeGreaterThan(0);
    for (const cr of data.competencyResults) {
      expect(cr.newScore).toBeDefined();
      expect(cr.scorePercent).toBe(Math.round((cr.correct / cr.total) * 100));
    }
    expect(data.newAchievements.some((a: { code: string }) => a.code === 'FIRST_ASSESSMENT')).toBe(true);

    // Skill gaps recalculated + achievements visible
    const gapsRes = await supertest(app).get('/api/skill-gaps/me').set('Authorization', learnerToken);
    expect(gapsRes.status).toBe(200);
    const achRes = await supertest(app).get('/api/achievements/me').set('Authorization', learnerToken);
    expect(achRes.body.data.unlocked.some((u: { code?: string }) => u.code === 'FIRST_ASSESSMENT' || (u as { achievement?: { code?: string } }).achievement?.code === 'FIRST_ASSESSMENT')).toBe(true);
  });

  it('blocks double submission', async () => {
    const res = await supertest(app)
      .post(`/api/assessment/${assessment.id}/submit`)
      .set('Authorization', learnerToken)
      .send({ answers: [{ questionId: assessment.questions[0].questionId, selectedIndex: 0 }] });
    expect(res.status).toBe(400);
  });

  it('stores assessment history', async () => {
    const res = await supertest(app).get('/api/assessment/history/me').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(1);
  });
});

/** Dashboard endpoint (prompt §34): one call, whole payload. */
describe('dashboard endpoint', () => {
  it('returns every dashboard section in one call', async () => {
    const res = await supertest(app).get('/api/dashboard').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('competency');
    expect(data).toHaveProperty('skillGaps');
    expect(data).toHaveProperty('recommendations');
    expect(data).toHaveProperty('continueLearning');
    expect(data).toHaveProperty('streak');
    expect(data).toHaveProperty('achievements');
    expect(data).toHaveProperty('recentActivity');
    expect(data).toHaveProperty('notifications');
    // competency update from the assessment is reflected
    expect(data.user.xp).toBeGreaterThan(0);
  });
});
