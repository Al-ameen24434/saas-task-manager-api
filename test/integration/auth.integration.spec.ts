import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, closeTestApp } from '../helpers/test-app.helper';
import { registerUser } from '../helpers/test-data.helper';
import { expect } from '@jest/globals';
import { afterAll, beforeAll,describe, beforeEach, it, afterEach } from '@jest/globals';

describe('Auth — Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app, prisma);
  });

  afterEach(async () => {
    // Clean between tests to avoid data bleed
    await prisma.cleanDatabase();
  });

  // ─── REGISTER ────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'alice@test.com',
          password: 'Password123!',
          firstName: 'Alice',
          lastName: 'Johnson',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@test.com');
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.tokens.tokenType).toBe('Bearer');
    });

    it('should return 409 when email is already taken', async () => {
      await registerUser(app, { email: 'duplicate@test.com' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Password123!',
          firstName: 'Bob',
          lastName: 'Smith',
        })
        .expect(409);

      expect(res.body.success).toBeUndefined();
      expect(res.body.statusCode).toBe(409);
    });

    it('should return 400 for weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'alice@test.com',
          password: 'weak',
          firstName: 'Alice',
          lastName: 'Johnson',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          firstName: 'Alice',
          lastName: 'Johnson',
        })
        .expect(400);
    });

    it('should strip unknown fields from request body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'alice@test.com',
          password: 'Password123!',
          firstName: 'Alice',
          lastName: 'Johnson',
          isAdmin: true,     // Should be stripped by whitelist: true
          role: 'SUPERUSER', // Should be stripped
        })
        .expect(400); // forbidNonWhitelisted: true rejects unknown fields

      expect(res.body.statusCode).toBe(400);
    });
  });

  // ─── LOGIN ───────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await registerUser(app, { email: 'login-test@test.com' });
    });

    it('should login and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-test@test.com', password: 'Password123!' })
        .expect(200);

      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-test@test.com', password: 'WrongPass999!' })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@test.com', password: 'Password123!' })
        .expect(401);
    });

    it('should return same error for wrong password and missing user (prevent enumeration)', async () => {
      const wrongPass = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login-test@test.com', password: 'WrongPass999!' });

      const missingUser = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@test.com', password: 'Password123!' });

      // Both should return 401 with the same message
      expect(wrongPass.body.statusCode).toBe(401);
      expect(missingUser.body.statusCode).toBe(401);
      expect(wrongPass.body.message).toBe(missingUser.body.message);
    });
  });

  // ─── GET ME ──────────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      const { tokens, email } = await registerUser(app);

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(email);
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('should return 401 with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.real.jwt')
        .expect(401);
    });
  });

  // ─── REFRESH TOKEN ───────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should issue new tokens using a valid refresh token', async () => {
      const { tokens } = await registerUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // New tokens should be different from the old ones
      expect(res.body.data.accessToken).not.toBe(tokens.accessToken);
      expect(res.body.data.refreshToken).not.toBe(tokens.refreshToken);
    });

    it('should reject a refresh token after it has been rotated', async () => {
      const { tokens } = await registerUser(app);

      // Use the refresh token once — it gets rotated
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Try to use the old refresh token again — should be rejected
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });

  // ─── LOGOUT ──────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should revoke the refresh token', async () => {
      const { tokens } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Refresh token should now be invalid
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });
  });
});