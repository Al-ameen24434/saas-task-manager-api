import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { expect } from '@jest/globals';
import { afterAll, beforeAll,describe,  it, afterEach } from '@jest/globals';

import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, closeTestApp } from '../helpers/test-app.helper';
import {
  registerUser,
  createOrg,
  inviteMember,
} from '../helpers/test-data.helper';

describe('Organizations — Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app, prisma);
  });

  afterEach(async () => {
    await prisma.cleanDatabase();
  });

  describe('POST /organizations', () => {
    it('should create an org and make creator the OWNER', async () => {
      const { tokens } = await registerUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Acme Corp', slug: 'acme-corp' })
        .expect(201);

      expect(res.body.data.slug).toBe('acme-corp');
      expect(res.body.data.myRole).toBe('OWNER');
    });

    it('should return 409 for duplicate slug', async () => {
      const { tokens } = await registerUser(app);
      await createOrg(app, tokens.accessToken, { slug: 'my-org' });

      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Another Org', slug: 'my-org' })
        .expect(409);
    });

    it('should reject invalid slug format', async () => {
      const { tokens } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Bad Org', slug: 'UPPERCASE_NOT_ALLOWED' })
        .expect(400);
    });
  });

  describe('RBAC — Role enforcement', () => {
    it('MEMBER should not be able to delete the organization', async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);

      const org = await createOrg(app, owner.tokens.accessToken);
      await inviteMember(
        app, owner.tokens.accessToken, org.slug, member.email, 'MEMBER',
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${org.slug}`)
        .set('Authorization', `Bearer ${member.tokens.accessToken}`)
        .expect(403);
    });

    it('ADMIN should be able to invite members', async () => {
      const owner = await registerUser(app);
      const admin = await registerUser(app);
      const newMember = await registerUser(app);

      const org = await createOrg(app, owner.tokens.accessToken);
      await inviteMember(
        app, owner.tokens.accessToken, org.slug, admin.email, 'ADMIN',
      );

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.slug}/members`)
        .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
        .send({ email: newMember.email, role: 'MEMBER' })
        .expect(201);
    });

    it('ADMIN should NOT be able to assign OWNER role', async () => {
      const owner = await registerUser(app);
      const admin = await registerUser(app);
      const target = await registerUser(app);

      const org = await createOrg(app, owner.tokens.accessToken);
      await inviteMember(
        app, owner.tokens.accessToken, org.slug, admin.email, 'ADMIN',
      );

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${org.slug}/members`)
        .set('Authorization', `Bearer ${admin.tokens.accessToken}`)
        .send({ email: target.email, role: 'OWNER' })
        .expect(403);
    });

    it('non-member should receive 404 not 403 (no information leak)', async () => {
      const owner = await registerUser(app);
      const stranger = await registerUser(app);

      const org = await createOrg(app, owner.tokens.accessToken);

      // Stranger should get 404 — they shouldn't know the org exists
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${org.slug}`)
        .set('Authorization', `Bearer ${stranger.tokens.accessToken}`)
        .expect(404);
    });
  });

  describe('GET /organizations', () => {
    it('should only return orgs the user belongs to', async () => {
      const alice = await registerUser(app);
      const bob = await registerUser(app);

      await createOrg(app, alice.tokens.accessToken, { slug: 'alice-org' });
      await createOrg(app, bob.tokens.accessToken, { slug: 'bob-org' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Authorization', `Bearer ${alice.tokens.accessToken}`)
        .expect(200);

      const slugs = res.body.data.data.map((o: any) => o.slug);
      expect(slugs).toContain('alice-org');
      expect(slugs).not.toContain('bob-org');
    });

    it('should support pagination', async () => {
      const { tokens } = await registerUser(app);
      for (let i = 0; i < 5; i++) {
        await createOrg(app, tokens.accessToken, { slug: `org-${i}-${Date.now()}` });
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations?page=1&limit=2')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.meta.totalPages).toBeGreaterThan(1);
    });
  });
});