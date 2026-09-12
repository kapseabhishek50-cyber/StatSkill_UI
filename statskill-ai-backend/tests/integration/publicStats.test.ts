import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedCourses, seedLearner, seedTrainer, seedAdmin } from '../helpers/fixtures';
import { User } from '../../src/models/User';
import { Competency } from '../../src/models/Competency';
import { Course } from '../../src/models/Course';
import { publicStatsService } from '../../src/services/publicStats/publicStats.service';
import { COMPETENCY_TAXONOMY } from '../../src/data/competencyTaxonomy';
import { MOCK_COURSES } from '../../src/data/mockCourses';
import type { Express } from 'express';

/**
 * GET /api/stats/public — the public landing-page snapshot.
 *
 * Two guarantees matter most and are asserted first-class: the numbers are real
 * database counts when the database is reachable, and the route still answers
 * 200 with a labelled snapshot when it is not.
 */
let app: Express;
let uri: string;
let request: () => supertest.Agent;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  uri = await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
  request = () => supertest(app);
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearDb();
  // Counts are cached briefly on purpose; each test must start from a cold cache.
  publicStatsService.invalidate();
});

describe('GET /api/stats/public', () => {
  it('answers without authentication', async () => {
    const res = await request().get('/api/stats/public');
    expect(res.status).toBe(200);
  });

  it('returns the bare payload the frontend expects, not the success envelope', async () => {
    const res = await request().get('/api/stats/public');
    expect(res.body).toHaveProperty('stats');
    expect(res.body).toHaveProperty('live');
    expect(res.body).toHaveProperty('source');
    // The landing page reads `body.stats` directly; wrapping it would silently
    // degrade the page to the bundled snapshot instead of failing loudly.
    expect(res.body.success).toBeUndefined();
    expect(res.body.data).toBeUndefined();
  });

  it('reports live database counts that match the collections', async () => {
    const byCode = await seedFramework();
    await seedCourses();
    await seedLearner(byCode);
    await seedTrainer();
    await seedAdmin();

    publicStatsService.invalidate();
    const res = await request().get('/api/stats/public');
    const body = res.body;

    expect(body.live).toBe(true);
    expect(body.source).toBe('database');
    expect(body.health.db).toBe('up');

    const [officers, competencies, courses] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Competency.countDocuments({ isActive: true }),
      Course.countDocuments({ isActive: true }),
    ]);

    expect(body.stats.officers).toBe(officers);
    expect(body.stats.competencies).toBe(competencies);
    expect(body.stats.courses).toBe(courses);
    expect(body.stats.jobRoles).toBe(1);
    expect(body.stats.competencyRecords).toBe(COMPETENCY_TAXONOMY.length);
    // Only the learner carries a department in the fixtures.
    expect(body.stats.departments).toBe(1);
    // Nothing has taken an assessment or a quiz yet — the endpoint reports zero
    // rather than inventing activity for a public page.
    expect(body.stats.assessments).toBe(0);
    expect(body.stats.quizzes).toBe(0);
  });

  it('excludes deactivated accounts from the officer count', async () => {
    const byCode = await seedFramework();
    await seedLearner(byCode);
    const passwordHash = '$2a$10$inactiveaccountplaceholderplaceholderplaceholderplaceholderpl';
    await User.create({
      name: 'Left The Service',
      email: 'inactive.test@mospi.gov.in',
      passwordHash,
      role: 'LEARNER',
      isActive: false,
    });

    publicStatsService.invalidate();
    const res = await request().get('/api/stats/public');
    expect(res.body.stats.officers).toBe(1);
    expect(await User.countDocuments({})).toBe(2);
  });

  it('caps the ticker at 16 competencies and keeps categories consistent', async () => {
    await seedFramework();
    publicStatsService.invalidate();
    const res = await request().get('/api/stats/public');

    expect(res.body.competencies.length).toBeLessThanOrEqual(16);
    expect(res.body.competencies[0]).toMatchObject({ code: expect.any(String), name: expect.any(String), category: expect.any(String) });
    expect(res.body.competencies[0]).not.toHaveProperty('_id');

    // Category buckets must describe the same population the count reports.
    const categoryTotal = res.body.categories.reduce((sum: number, c: { count: number }) => sum + c.count, 0);
    expect(categoryTotal).toBe(COMPETENCY_TAXONOMY.length);
  });

  it('exposes catalogue previews with a stable code per course', async () => {
    await seedFramework();
    await seedCourses();
    publicStatsService.invalidate();
    const res = await request().get('/api/stats/public');

    expect(res.body.courses.length).toBeLessThanOrEqual(12);
    for (const course of res.body.courses) {
      expect(typeof course.code).toBe('string');
      expect(course.code.length).toBeGreaterThan(0);
      expect(course).toHaveProperty('title');
      expect(course).toHaveProperty('rating');
      expect(course).toHaveProperty('durationHours');
    }
    // React uses these as keys on the ticker.
    const codes = res.body.courses.map((c: { code: string }) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('never leaks officer identities or credentials', async () => {
    const byCode = await seedFramework();
    await seedCourses();
    await seedLearner(byCode);
    await seedTrainer();
    await seedAdmin();
    publicStatsService.invalidate();

    const res = await request().get('/api/stats/public');
    const raw = JSON.stringify(res.body);

    expect(raw).not.toContain('@mospi.gov.in');
    expect(raw).not.toContain('@nssta.gov.in');
    expect(raw).not.toContain('Rahul');
    expect(raw).not.toContain('Priya');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toMatch(/Bearer|eyJ/); // no tokens
    expect(raw).not.toContain(uri); // no connection string
    expect(raw).not.toMatch(/"[a-f0-9]{24}"/); // no object ids
  });

  it('serves a labelled snapshot when the database is unreachable', async () => {
    await mongoose.disconnect();
    try {
      publicStatsService.invalidate();
      const res = await request().get('/api/stats/public');

      expect(res.status).toBe(200);
      expect(res.body.live).toBe(false);
      expect(res.body.source).toBe('snapshot');
      expect(res.body.health.db).toBe('down');
      // Still shaped identically, so the page renders without special-casing.
      expect(res.body.stats).toHaveProperty('officers');
      expect(res.body.competencies.length).toBeGreaterThan(0);
      // Snapshot figures come from the shipped seed data.
      expect(res.body.stats.competencies).toBe(COMPETENCY_TAXONOMY.length);
      expect(res.body.stats.courses).toBe(MOCK_COURSES.length);
      expect(res.body.stats.officers).toBe(0);
    } finally {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    }
  });

  it('reuses a cached payload within the TTL and refreshes on demand', async () => {
    const first = await request().get('/api/stats/public');
    const second = await request().get('/api/stats/public');
    expect(second.body.generatedAt).toBe(first.body.generatedAt);

    await Competency.insertMany([{ code: 'EXTRA_SKILL', name: 'Extra Skill', category: 'TECHNICAL', keywords: [] }]);
    publicStatsService.invalidate();
    const third = await request().get('/api/stats/public');

    expect(third.body.generatedAt).not.toBe(first.body.generatedAt);
    expect(third.body.stats.competencies).toBe(first.body.stats.competencies + 1);
  });

  it('sets cache headers so a CDN can absorb landing-page traffic', async () => {
    const res = await request().get('/api/stats/public');
    expect(res.headers['cache-control']).toMatch(/public, max-age=\d+/);
    expect(res.headers.vary).toMatch(/Accept-Encoding/);
  });
});
