import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedLearner, seedAdmin, loginAs } from '../helpers/fixtures';
import { Course } from '../../src/models/Course';
import type { Express } from 'express';

let app: Express;
let learnerToken: string;
let adminToken: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
  const byCode = await seedFramework();
  await seedLearner(byCode);
  await seedAdmin();
  learnerToken = await loginAs(app, 'rahul.test@mospi.gov.in', 'Demo@123');
  adminToken = await loginAs(app, 'admin.test@mospi.gov.in', 'Admin@123');

  await Course.create({
    title: 'Machine Learning Basics for Statistical Officers',
    description: 'An introductory machine learning course for statistical offices.',
    provider: 'NSSTA', source: 'MOCK', externalId: 'ml-search-1', category: 'Artificial Intelligence',
    skills: ['AI_ML'], level: 'BEGINNER', modules: [],
  });
});

afterAll(async () => {
  await stopTestDb();
});

describe('communities (prompt §30)', () => {
  let communityId: string;
  let messageId: string;

  it('creates a community and auto-joins the creator', async () => {
    const res = await supertest(app)
      .post('/api/communities')
      .set('Authorization', learnerToken)
      .send({ name: 'Sampling Nerds', description: 'All things sampling.', category: 'Statistical Methods' });
    expect(res.status).toBe(201);
    communityId = res.body.data.community._id;
    expect(res.body.data.community.membersCount).toBe(1);
  });

  it('rejects duplicate community names', async () => {
    const res = await supertest(app)
      .post('/api/communities')
      .set('Authorization', learnerToken)
      .send({ name: 'Sampling Nerds', category: 'General' });
    expect(res.status).toBe(409);
  });

  it('join / leave flows update membership and counts', async () => {
    const join = await supertest(app).post(`/api/communities/${communityId}/join`).set('Authorization', adminToken);
    expect(join.status).toBe(200);
    expect(join.body.data.community.membersCount).toBe(2);

    const leave = await supertest(app).post(`/api/communities/${communityId}/leave`).set('Authorization', adminToken);
    expect(leave.status).toBe(200);
    expect(leave.body.data.community.membersCount).toBe(1);
  });

  it('members can send and read messages; non-members cannot', async () => {
    const send = await supertest(app)
      .post(`/api/communities/${communityId}/messages`)
      .set('Authorization', learnerToken)
      .send({ content: 'Stratified sampling question: proportional vs optimal allocation?' });
    expect(send.status).toBe(201);
    messageId = send.body.data.message._id;

    const list = await supertest(app).get(`/api/communities/${communityId}/messages`).set('Authorization', learnerToken);
    expect(list.status).toBe(200);
    expect(list.body.data.messages.length).toBe(1);

    // admin left, so sending must fail
    const outsider = await supertest(app)
      .post(`/api/communities/${communityId}/messages`)
      .set('Authorization', adminToken)
      .send({ content: 'hello?' });
    expect(outsider.status).toBe(403);
  });

  it('DISCUSSION_PARTICIPATION counts as a learning activity (prompt §19)', async () => {
    const activity = await supertest(app).get('/api/learning/activity').set('Authorization', learnerToken);
    const types = activity.body.data.activities.map((a: { type: string }) => a.type);
    expect(types).toContain('DISCUSSION_PARTICIPATION');
  });

  it('reports a message until it auto-hides (moderation)', async () => {
    // 2 more members report it (threshold 3)
    const extraUser = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Reporter', email: 'reporter@mospi.gov.in', password: 'Password1' });
    const reporterToken = `Bearer ${extraUser.body.data.accessToken}`;
    await supertest(app).post(`/api/communities/${communityId}/join`).set('Authorization', reporterToken);

    const reporters = [learnerToken, adminToken, reporterToken];
    for (const token of reporters) {
      await supertest(app)
        .post(`/api/communities/${communityId}/messages/${messageId}/report`)
        .set('Authorization', token)
        .send({ reason: 'off-topic' });
    }
    const list = await supertest(app).get(`/api/communities/${communityId}/messages`).set('Authorization', learnerToken);
    const still = list.body.data.messages.some((m: { _id: string }) => m._id === messageId);
    expect(still).toBe(false); // auto-hidden after 3 reports
  });
});

describe('AI assistant (prompt §28, §42) — runs on the deterministic provider without keys', () => {
  it('answers grounded in user context and never fails even without an AI key', async () => {
    const res = await supertest(app)
      .post('/api/ai/chat')
      .set('Authorization', learnerToken)
      .send({ message: 'What are my biggest skill gaps and what should I study next?' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBeTruthy();
    expect(res.body.data.fallback).toBe(true); // no AI key in tests
  });

  it('reports AI status honestly', async () => {
    const res = await supertest(app).get('/api/ai/status').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
    expect(res.body.data.provider).toBe('mock');
  });

  it('generates a study plan from top gaps', async () => {
    const res = await supertest(app).post('/api/ai/study-plan').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBeTruthy();
  });
});

describe('admin analytics (prompt §33)', () => {
  it('aggregates platform analytics', async () => {
    const res = await supertest(app).get('/api/admin/dashboard').set('Authorization', adminToken);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.users.total).toBeGreaterThanOrEqual(2);
    expect(data.topSkillGaps).toBeDefined();
    expect(data.departmentCompetency).toBeDefined();
    expect(Array.isArray(data.learningActivityByDay)).toBe(true);
  });

  it('lists audit logs', async () => {
    const res = await supertest(app).get('/api/admin/audit-logs').set('Authorization', adminToken);
    expect(res.status).toBe(200);
    const actions = res.body.data.items.map((i: { action: string }) => i.action);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('runs the course sync pipeline and reports per-provider status', async () => {
    const sync = await supertest(app).post('/api/admin/course-sync').set('Authorization', adminToken);
    expect(sync.status).toBe(200);
    expect(sync.body.data.providers.length).toBeGreaterThan(0);

    const providers = await supertest(app).get('/api/admin/providers').set('Authorization', adminToken);
    const ids = providers.body.data.providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('mock');
    expect(ids).toContain('igot'); // present but not configured
    const igot = providers.body.data.providers.find((p: { id: string }) => p.id === 'igot');
    expect(igot.configured).toBe(false);
  });

  it('searches across entities (prompt §35)', async () => {
    const res = await supertest(app).get('/api/search?q=machine').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.courses.length).toBeGreaterThan(0);
  });
});
