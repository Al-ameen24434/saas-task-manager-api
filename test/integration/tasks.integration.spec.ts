import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { expect } from '@jest/globals';
import { afterAll, beforeAll,describe, beforeEach, it,  } from '@jest/globals';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, closeTestApp } from '../helpers/test-app.helper';
import {
  registerUser,
  createOrg,
  inviteMember,
  createProject,
  createTask,
} from '../helpers/test-data.helper';

describe('Tasks — Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Shared state across tests in this suite
  let ownerToken: string;
  let memberToken: string;
  let orgSlug: string;
  let projectId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app, prisma);
  });

  // Set up a complete org + project + member before each test
  beforeEach(async () => {
    await prisma.cleanDatabase();

    const owner = await registerUser(app);
    const member = await registerUser(app);

    ownerToken = owner.tokens.accessToken;
    memberToken = member.tokens.accessToken;

    const org = await createOrg(app, ownerToken);
    orgSlug = org.slug;

    await inviteMember(app, ownerToken, orgSlug, member.email, 'MEMBER');

    const project = await createProject(app, ownerToken, orgSlug);
    projectId = project.id;
  });

  const taskPath = (suffix = '') =>
    `/api/v1/organizations/${orgSlug}/projects/${projectId}/tasks${suffix}`;

  // ─── CREATE ────────────────────────────────────────────────────────────────

  describe('POST /tasks', () => {
    it('should create a task and return it with assignees', async () => {
      const res = await request(app.getHttpServer())
        .post(taskPath())
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'New Task', priority: 'HIGH' })
        .expect(201);

      expect(res.body.data.title).toBe('New Task');
      expect(res.body.data.priority).toBe('HIGH');
      expect(res.body.data.status).toBe('TODO');
      expect(res.body.data.assignees).toEqual([]);
      expect(res.body.data.isOverdue).toBe(false);
    });

    it('should allow MEMBER to create tasks', async () => {
      await request(app.getHttpServer())
        .post(taskPath())
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Member Task' })
        .expect(201);
    });

    it('should reject task creation in a non-existent project', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${orgSlug}/projects/00000000-0000-0000-0000-000000000000/tasks`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Ghost Task' })
        .expect(404);
    });
  });

  // ─── FILTERING ────────────────────────────────────────────────────────────

  describe('GET /tasks — filtering', () => {
    beforeEach(async () => {
      await createTask(app, ownerToken, orgSlug, projectId, {
        title: 'High Priority Task',
        priority: 'HIGH',
      });
      await createTask(app, ownerToken, orgSlug, projectId, {
        title: 'Low Priority Task',
        priority: 'LOW',
      });
      await createTask(app, ownerToken, orgSlug, projectId, {
        title: 'Medium Priority Task',
        priority: 'MEDIUM',
      });
    });

    it('should filter by single priority', async () => {
      const res = await request(app.getHttpServer())
        .get(taskPath('?priority=HIGH'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].priority).toBe('HIGH');
    });

    it('should filter by multiple priorities', async () => {
      const res = await request(app.getHttpServer())
        .get(taskPath('?priority=HIGH,LOW'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(2);
      const priorities = res.body.data.data.map((t: any) => t.priority);
      expect(priorities).toContain('HIGH');
      expect(priorities).toContain('LOW');
    });

    it('should search by title', async () => {
      const res = await request(app.getHttpServer())
        .get(taskPath('?search=High'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].title).toContain('High');
    });

    it('should return correct pagination meta', async () => {
      const res = await request(app.getHttpServer())
        .get(taskPath('?page=1&limit=2'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.meta.total).toBe(3);
      expect(res.body.data.meta.totalPages).toBe(2);
      expect(res.body.data.meta.hasNextPage).toBe(true);
    });
  });

  // ─── SCOPE ISOLATION ─────────────────────────────────────────────────────

  describe('scope isolation', () => {
    it('should not expose tasks from another organization', async () => {
      // Create a completely separate org with its own project and task
      const otherOwner = await registerUser(app);
      const otherOrg = await createOrg(app, otherOwner.tokens.accessToken);
      const otherProject = await createProject(
        app, otherOwner.tokens.accessToken, otherOrg.slug,
      );
      const otherTask = await createTask(
        app, otherOwner.tokens.accessToken, otherOrg.slug, otherProject.id,
      );

      // Our user tries to access a task from the other org — should 404
      await request(app.getHttpServer())
        .get(taskPath(`/${otherTask.id}`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // ─── STATUS UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /tasks/:taskId/status', () => {
    it('should update task status', async () => {
      const task = await createTask(app, ownerToken, orgSlug, projectId);

      const res = await request(app.getHttpServer())
        .patch(taskPath(`/${task.id}/status`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });

  // ─── BULK UPDATE ─────────────────────────────────────────────────────────

  describe('PATCH /tasks/bulk', () => {
    it('should bulk update tasks as ADMIN', async () => {
      const t1 = await createTask(app, ownerToken, orgSlug, projectId);
      const t2 = await createTask(app, ownerToken, orgSlug, projectId);

      const res = await request(app.getHttpServer())
        .patch(taskPath('/bulk'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ taskIds: [t1.id, t2.id], priority: 'URGENT' })
        .expect(200);

      expect(res.body.data.updatedCount).toBe(2);
      expect(res.body.data.skippedIds).toHaveLength(0);
    });

    it('should return skipped IDs for tasks not in project', async () => {
      const task = await createTask(app, ownerToken, orgSlug, projectId);
      const fakeId = '00000000-0000-0000-0000-000000000099';

      const res = await request(app.getHttpServer())
        .patch(taskPath('/bulk'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ taskIds: [task.id, fakeId], status: 'DONE' })
        .expect(200);

      expect(res.body.data.updatedCount).toBe(1);
      expect(res.body.data.skippedIds).toContain(fakeId);
    });

    it('should reject bulk update for MEMBER role', async () => {
      const task = await createTask(app, ownerToken, orgSlug, projectId);

      await request(app.getHttpServer())
        .patch(taskPath('/bulk'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ taskIds: [task.id], status: 'DONE' })
        .expect(403);
    });
  });
});
