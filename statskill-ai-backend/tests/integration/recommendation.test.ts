import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedLearner, loginAs } from '../helpers/fixtures';
import { Course } from '../../src/models/Course';
import type { Express } from 'express';

let app: Express;
let learnerToken: string;
let byCode: Map<string, { _id: unknown }>;

/**
 * Prompt §53: the recommendation example MUST be produced by the algorithm:
 *   1. Machine Learning for Statistical Analysis
 *   2. Python for Data Analytics
 *   3. Advanced Survey Methodology
 *   4. GIS Fundamentals
 */
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
  byCode = await seedFramework();

  // Only the four courses from the §53 example are "available".
  const four = [
    {
      title: 'Machine Learning for Statistical Analysis',
      description: 'Apply supervised and unsupervised machine learning to official statistics: regression, classification, clustering and model validation on survey and administrative data.',
      provider: 'NSSTA', source: 'MOCK', externalId: 'ml-1', category: 'Artificial Intelligence',
      skills: ['AI_ML', 'PYTHON', 'DATA_QUALITY'], level: 'INTERMEDIATE', durationHours: 20, language: 'en',
      tags: ['machine learning', 'ai', 'python'], learningObjectives: ['Train models on official data'], modules: [], rating: 4.7, enrollmentCount: 420,
    },
    {
      title: 'Python for Data Analytics',
      description: 'Hands-on Python for data analytics with pandas and NumPy: importing survey data, cleaning, aggregation and reproducible notebooks.',
      provider: 'iGOT Karmayogi', source: 'MOCK', externalId: 'py-1', category: 'Programming',
      skills: ['PYTHON', 'DATA_VISUALIZATION', 'SQL'], level: 'BEGINNER', durationHours: 15, language: 'en',
      tags: ['python', 'pandas', 'data analysis'], learningObjectives: ['Wrangle data with pandas'], modules: [], rating: 4.5, enrollmentCount: 810,
    },
    {
      title: 'Advanced Survey Methodology',
      description: 'Advanced survey methodology for official statistics: dual-frame designs, nonresponse adjustment, small area estimation and total survey error management.',
      provider: 'NSSTA', source: 'MOCK', externalId: 'svy-1', category: 'Statistical Methods',
      skills: ['SURVEY_DESIGN', 'SAMPLING', 'DATA_QUALITY'], level: 'ADVANCED', durationHours: 24, language: 'en',
      tags: ['survey design', 'sampling'], learningObjectives: ['Design complex surveys'], modules: [], rating: 4.8, enrollmentCount: 260,
    },
    {
      title: 'GIS Fundamentals',
      description: 'Fundamentals of geographic information systems for statistical offices: coordinate systems, spatial data models and choropleth mapping with QGIS.',
      provider: 'MoSPI', source: 'MOCK', externalId: 'gis-1', category: 'Geospatial',
      skills: ['GIS', 'DATA_VISUALIZATION'], level: 'BEGINNER', durationHours: 10, language: 'en',
      tags: ['gis', 'mapping'], learningObjectives: ['Create thematic maps'], modules: [], rating: 4.2, enrollmentCount: 190,
    },
  ];
  await Course.insertMany(four);

  await seedLearner(byCode);
  learnerToken = await loginAs(app, 'rahul.test@mospi.gov.in', 'Demo@123');
});

afterAll(async () => {
  await stopTestDb();
});

describe('hybrid recommendation engine (prompt §7-13, §53)', () => {
  it('ranks the §53 example courses in the expected order', async () => {
    const res = await supertest(app)
      .post('/api/recommendations/refresh?sync=true')
      .set('Authorization', learnerToken)
      .send({});
    expect(res.status).toBe(200);
    const recommendations = res.body.data.recommendations as { title: string; matchScore: number; scores: Record<string, number>; reason: string; priority: string }[];
    expect(recommendations.length).toBeGreaterThan(0);

    const expected = [
      'Machine Learning for Statistical Analysis',
      'Python for Data Analytics',
      'Advanced Survey Methodology',
      'GIS Fundamentals',
    ];
    const positions = expected.map((t) => recommendations.findIndex((r) => r.title === t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);

    // The top recommendation targets the AI/ML gap
    expect(recommendations[0].title).toBe('Machine Learning for Statistical Analysis');
    expect(recommendations[0].priority).toBe('CRITICAL');
    expect(recommendations[0].reason).toContain('AI/ML');
    // scores are stored per-component
    expect(recommendations[0].scores.gap).toBeCloseTo(0.45, 1);
  });

  it('serves stored recommendations on GET without re-running the engine', async () => {
    const res = await supertest(app).get('/api/recommendations').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);
    expect(res.body.data.recommendations[0].matchScore).toBeGreaterThan(0);
  });

  it('returns top-N via /recommendations/top', async () => {
    const res = await supertest(app).get('/api/recommendations/top?limit=2').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.recommendations.length).toBeLessThanOrEqual(2);
  });

  it('matches matchScore = round(final * 100) (deterministic)', async () => {
    const res = await supertest(app).get('/api/recommendations').set('Authorization', learnerToken);
    const first = res.body.data.recommendations[0];
    expect(first.matchScore).toBe(Math.round(first.scores.final * 100));
  });

  it('AI never invents course IDs — reasonSource is deterministic without an AI key', async () => {
    const res = await supertest(app).get('/api/recommendations').set('Authorization', learnerToken);
    for (const rec of res.body.data.recommendations) {
      expect(['AI', 'DETERMINISTIC']).toContain(rec.reasonSource);
      const courseExists = await Course.countDocuments({ _id: new mongoose.Types.ObjectId(rec.courseId?._id ?? rec.courseId) });
      expect(courseExists).toBe(1);
    }
  });
});

describe('skill gap engine (prompt §5-6)', () => {
  it('identifies AI/ML as the critical gap', async () => {
    const res = await supertest(app).get('/api/skill-gaps/me').set('Authorization', learnerToken);
    expect(res.status).toBe(200);
    const gaps = res.body.data.skillGaps;
    const aiGap = gaps.find((g: { competencyCode: string }) => g.competencyCode === 'AI_ML');
    expect(aiGap).toBeTruthy();
    expect(aiGap.gap).toBe(45);
    expect(aiGap.priority).toBe('CRITICAL');
    // Python: 42 vs 60 → 18 → HIGH
    const pyGap = gaps.find((g: { competencyCode: string }) => g.competencyCode === 'PYTHON');
    expect(pyGap.priority).toBe('MEDIUM');
    // SQL: 65 vs 60 → closed
    const sqlGap = gaps.find((g: { competencyCode: string }) => g.competencyCode === 'SQL');
    expect(sqlGap.status).toBe('CLOSED');
  });
});
