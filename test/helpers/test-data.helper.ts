import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface TestUser {
  id: string;
  email: string;
  tokens: AuthTokens;
}

interface TestOrg {
  id: string;
  slug: string;
  name: string;
}

interface TestProject {
  id: string;
  name: string;
}

interface TestTask {
  id: string;
  title: string;
}

// ── Auth Helpers ────────────────────────────────────────────────────────────

export async function registerUser(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }> = {},
): Promise<TestUser> {
  const payload = {
    email: overrides.email ?? `user-${Date.now()}@test.com`,
    password: overrides.password ?? 'Password123!',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
  };

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(payload)
    .expect(201);

  return {
    id: res.body.data.user.id,
    email: res.body.data.user.email,
    tokens: res.body.data.tokens,
  };
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password = 'Password123!',
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return res.body.data.tokens;
}

// ── Org Helpers ─────────────────────────────────────────────────────────────

export async function createOrg(
  app: INestApplication,
  token: string,
  overrides: Partial<{ name: string; slug: string }> = {},
): Promise<TestOrg> {
  const suffix = Date.now();
  const res = await request(app.getHttpServer())
    .post('/api/v1/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: overrides.name ?? `Test Org ${suffix}`,
      slug: overrides.slug ?? `test-org-${suffix}`,
    })
    .expect(201);

  return {
    id: res.body.data.id,
    slug: res.body.data.slug,
    name: res.body.data.name,
  };
}

export async function inviteMember(
  app: INestApplication,
  token: string,
  orgSlug: string,
  email: string,
  role = 'MEMBER',
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgSlug}/members`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email, role })
    .expect(201);
}

// ── Project Helpers ──────────────────────────────────────────────────────────

export async function createProject(
  app: INestApplication,
  token: string,
  orgSlug: string,
  overrides: Partial<{ name: string }> = {},
): Promise<TestProject> {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgSlug}/projects`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: overrides.name ?? `Project ${Date.now()}` })
    .expect(201);

  return { id: res.body.data.id, name: res.body.data.name };
}

// ── Task Helpers ─────────────────────────────────────────────────────────────

export async function createTask(
  app: INestApplication,
  token: string,
  orgSlug: string,
  projectId: string,
  overrides: Partial<{ title: string; priority: string }> = {},
): Promise<TestTask> {
  const res = await request(app.getHttpServer())
    .post(
      `/api/v1/organizations/${orgSlug}/projects/${projectId}/tasks`,
    )
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title ?? `Task ${Date.now()}`,
      priority: overrides.priority ?? 'MEDIUM',
    })
    .expect(201);

  return { id: res.body.data.id, title: res.body.data.title };
}