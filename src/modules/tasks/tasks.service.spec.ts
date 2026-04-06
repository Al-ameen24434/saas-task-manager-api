import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TasksService } from './tasks.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { PrismaService } from '@database/prisma.service';
import { expect, jest } from '@jest/globals';
import { afterAll, beforeAll,describe, beforeEach, it,afterEach  } from '@jest/globals';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: jest.Mocked<PrismaService>;
  let projectsService: jest.Mocked<ProjectsService>;

  const orgId = 'org-uuid-1';
  const projectId = 'project-uuid-1';
  const taskId = 'task-uuid-1';
  const userId = 'user-uuid-1';

  const mockUser = {
    id: userId,
    email: 'alice@example.com',
    password: 'hashed',
    firstName: 'Alice',
    lastName: 'Johnson',
    avatarUrl: null,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask = {
    id: taskId,
    title: 'Fix login bug',
    description: null,
    status: TaskStatus.TODO,
    priority: TaskPriority.HIGH,
    projectId,
    createdById: userId,
    dueDate: null,
    position: 0,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUser,
    assignees: [],
    _count: { comments: 0 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: ProjectsService,
          useValue: {
            assertProjectBelongsToOrg: jest.fn().mockReturnValue(Promise.resolve()),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            task: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
            },
            taskAssignee: {
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            organizationMember: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get(PrismaService);
    projectsService = module.get(ProjectsService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  // ─── CREATE ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a task successfully', async () => {
      jest.mocked(prisma.task.findFirst).mockResolvedValue(null);
      jest.mocked(prisma.task.create).mockResolvedValue(mockTask as any);

      const result = await service.create(
        projectId, orgId,
        { title: 'Fix login bug', priority: TaskPriority.HIGH },
        userId,
      );

      expect(projectsService.assertProjectBelongsToOrg).toHaveBeenCalledWith(
        projectId, orgId,
      );
      expect(result.title).toBe('Fix login bug');
      expect(result.isOverdue).toBe(false);
    });

    it('should validate org members when assigneeIds provided', async () => {
      const assigneeId = 'other-user-id';
      // Return empty — user is NOT a member
      jest.mocked(prisma.organizationMember.findMany).mockResolvedValue([] as any);

      await expect(
        service.create(
          projectId, orgId,
          { title: 'Task', assigneeIds: [assigneeId] },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── FIND ALL ────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return paginated tasks with meta', async () => {
      jest.mocked(prisma.task.findMany).mockResolvedValue([mockTask] as any);
      jest.mocked(prisma.task.count).mockResolvedValue(1);

      const result = await service.findAll(projectId, orgId, {
        page: 1, limit: 20, skip: 0,
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({
        total: 1,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
      });
    });

    it('should filter by multiple statuses', async () => {
      jest.mocked(prisma.task.findMany).mockResolvedValue([] as any);
      jest.mocked(prisma.task.count).mockResolvedValue(0);

      await service.findAll(projectId, orgId, {
        page: 1, limit: 20, skip: 0,
        status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
      } as any);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          }),
        }),
      );
    });
  });

  // ─── BULK UPDATE ─────────────────────────────────────────────────────────

  describe('bulkUpdate()', () => {
    it('should throw if no update fields provided', async () => {
      await expect(
        service.bulkUpdate(projectId, orgId, { taskIds: [taskId] }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip task IDs not found in project', async () => {
      const missingId = 'missing-uuid';
      jest.mocked(prisma.task.findMany).mockResolvedValue([{ id: taskId }] as any);
      jest.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });

      const result = await service.bulkUpdate(
        projectId, orgId,
        { taskIds: [taskId, missingId], status: TaskStatus.DONE },
        userId,
      );

      expect(result.updatedCount).toBe(1);
      expect(result.skippedIds).toContain(missingId);
      expect(result.updatedIds).toContain(taskId);
    });
  });

  // ─── ASSIGN MEMBERS ──────────────────────────────────────────────────────

  describe('assignMembers()', () => {
    it('should reject users not in the organization', async () => {
      jest.mocked(prisma.task.findFirst).mockResolvedValue({ id: taskId } as any);
      jest.mocked(prisma.organizationMember.findMany).mockResolvedValue([] as any);

      await expect(
        service.assignMembers(taskId, projectId, orgId, {
          userIds: ['non-member-id'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UNASSIGN MEMBER ─────────────────────────────────────────────────────

  describe('unassignMember()', () => {
    it('should throw if user is not assigned to the task', async () => {
      jest.mocked(prisma.task.findFirst).mockResolvedValue({ id: taskId } as any);
      jest.mocked(prisma.taskAssignee.findUnique).mockResolvedValue(null);

      await expect(
        service.unassignMember(taskId, projectId, orgId, 'not-assigned-user'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── OVERDUE DETECTION ───────────────────────────────────────────────────

  describe('isOverdue calculation', () => {
    it('should mark task as overdue when dueDate is past and not done', async () => {
      const overdueTask = {
        ...mockTask,
        dueDate: new Date('2020-01-01'), // Far in the past
        status: TaskStatus.IN_PROGRESS,
      };
      jest.mocked(prisma.task.findFirst).mockResolvedValue(overdueTask as any);
      jest.mocked(prisma.task.findMany).mockResolvedValue([overdueTask] as any);
      jest.mocked(prisma.task.count).mockResolvedValue(1);

      const result = await service.findAll(projectId, orgId, {
        page: 1, limit: 20, skip: 0,
      } as any);

      expect(result.data[0].isOverdue).toBe(true);
    });

    it('should NOT mark DONE tasks as overdue even if past due', async () => {
      const doneTask = {
        ...mockTask,
        dueDate: new Date('2020-01-01'),
        status: TaskStatus.DONE,
      };
      jest.mocked(prisma.task.findMany).mockResolvedValue([doneTask] as any);
      jest.mocked(prisma.task.count).mockResolvedValue(1);

      const result = await service.findAll(projectId, orgId, {
        page: 1, limit: 20, skip: 0,
      } as any);

      expect(result.data[0].isOverdue).toBe(false);
    });
  });
});

describe('TasksService Placeholder', () => {
  it('should have a placeholder test', () => {
    expect(true).toBe(true);
  });
});