import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import { seedFramework, seedLearner, seedAdmin, loginAs } from '../helpers/fixtures';
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
});

afterAll(async () => {
  await stopTestDb();
});

/** Security tests (prompt §36-37, §48). */
describe('security', () => {
  it('blocks unauthenticated access to protected endpoints', async () => {
    const endpoints = [
      ['get', '/api/dashboard'],
      ['get', '/api/recommendations'],
      ['post', '/api/assessment/start'],
      ['get', '/api/notifications'],
      ['get', '/api/admin/users'],
      ['get', '/api/trainer/learners'],
    ];
    for (const [method, url] of endpoints) {
      const res = await (supertest(app) as never as Record<string, (u: string) => Promise<{ status: number }>>)[method](url);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
    }
  });

  it('rejects malformed Authorization headers', async () => {
    const res = await supertest(app).get('/api/dashboard').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects forged tokens', async () => {
    const res = await supertest(app).get('/api/dashboard').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('enforces RBAC: learner cannot reach admin endpoints', async () => {
    const res = await supertest(app).get('/api/admin/dashboard').set('Authorization', learnerToken);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('enforces RBAC: learner cannot reach trainer endpoints', async () => {
    const res = await supertest(app).post('/api/trainer/quizzes/generate').set('Authorization', learnerToken).send({});
    expect(res.status).toBe(403);
  });

  it('admin can reach admin endpoints', async () => {
    const res = await supertest(app).get('/api/admin/dashboard').set('Authorization', adminToken);
    expect(res.status).toBe(200);
  });

  it('returns 422 with error details for invalid input', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects SQL-ish/garbage objectIds gracefully (400, not 500)', async () => {
    const res = await supertest(app).get('/api/courses/{"$ne":null}').set('Authorization', learnerToken);
    expect([400, 404]).toContain(res.status);
  });

  it('rejects disallowed file types on upload', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    const exePath = path.join(dir, 'malware.exe');
    fs.writeFileSync(exePath, 'MZ fake binary');
    const res = await supertest(app)
      .post('/api/materials/upload')
      .set('Authorization', learnerToken)
      .attach('file', exePath);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects wrong MIME types even with an allowed extension', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    const fakePath = path.join(dir, 'notes.pdf');
    fs.writeFileSync(fakePath, 'this is not a pdf but claims the extension');
    const res = await supertest(app)
      .post('/api/materials/upload')
      .set('Authorization', learnerToken)
      .attach('file', fakePath, { contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a valid TXT upload for learners and processes it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    const txtPath = path.join(dir, 'sampling-notes.txt');
    fs.writeFileSync(
      txtPath,
      'Sampling frames are the lists from which sample units are selected. '.repeat(40)
    );
    const res = await supertest(app)
      .post('/api/materials/upload')
      .set('Authorization', learnerToken)
      .attach('file', txtPath, { contentType: 'text/plain' });
    expect([202, 201]).toContain(res.status);
    const materialId = res.body.data.material._id;
    // wait for the background processing job
    let material = null;
    for (let i = 0; i < 40; i++) {
      const check = await supertest(app).get(`/api/materials/${materialId}`).set('Authorization', learnerToken);
      material = check.body.data.material;
      if (material.status === 'READY' || material.status === 'FAILED') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(material.status).toBe('READY');
    expect(material.chunkCount).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('never exposes secrets in responses', async () => {
    const res = await supertest(app).post('/api/auth/login').send({ email: 'rahul.test@mospi.gov.in', password: 'Demo@123' });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('refreshTokens');
  });

  it('returns the standard error envelope on unknown routes', async () => {
    const res = await supertest(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });
});
