import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { startTestDb, stopTestDb, clearDb } from '../helpers/setup';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await startTestDb();
  await clearDb();
  app = (await import('../../src/app')).createApp();
});

afterAll(async () => {
  await stopTestDb();
});

describe('authentication flow (prompt §36)', () => {
  it('registers a learner and returns tokens', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@mospi.gov.in', password: 'Password1', designation: 'Statistical Officer' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('LEARNER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email registration', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'test@mospi.gov.in', password: 'Password1' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('logs in with valid credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'test@mospi.gov.in', password: 'Password1' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const res = await supertest(app).post('/api/auth/login').send({ email: 'test@mospi.gov.in', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 'AUTH_ERROR' });
  });

  it('serves /api/auth/me with a valid token', async () => {
    const login = await supertest(app).post('/api/auth/login').send({ email: 'test@mospi.gov.in', password: 'Password1' });
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('test@mospi.gov.in');
  });

  it('rotates refresh tokens', async () => {
    const login = await supertest(app).post('/api/auth/login').send({ email: 'test@mospi.gov.in', password: 'Password1' });
    const res = await supertest(app).post('/api/auth/refresh').send({ refreshToken: login.body.data.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    // old refresh token is now revoked (rotation)
    const replay = await supertest(app).post('/api/auth/refresh').send({ refreshToken: login.body.data.refreshToken });
    expect(replay.status).toBe(401);
  });

  it('uses the standard success envelope everywhere', async () => {
    const res = await supertest(app).get('/api/health');
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('message');
  });
});
