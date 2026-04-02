// import { Test, TestingModule } from '@nestjs/testing';
// import { BadRequestException } from '@nestjs/common';
// import { TaskStatus, TaskPriority } from '@prisma/client';
// import { TasksService } from './tasks.service';
// import { ProjectsService } from '@modules/projects/projects.service';
// import { PrismaService } from '@database/prisma.service';
// import { ResourceNotFoundException } from '@common/exceptions/custom.exceptions';

// describe('TasksService', () => {
//   let service: TasksService;
//   let prisma: jest.Mocked<PrismaService>;
//   let projectsService: jest.Mocked<ProjectsService>;

//   const orgId = 'org-uuid-1';
//   const projectId = 'project-uuid-1';
//   const taskId = 'task-uuid-1';
//   const userId = 'user-uuid-1';

//   const mockUser = {
//     id: userId,
//     email: 'alice@example.com',
//     password: 'hashed',
//     firstName: 'Alice',
//     lastName: 'Johnson',
//     avatarUrl: null,
//     isActive: true,
//     isEmailVerified: true,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   const mockTask = {
//     id: taskId,
//     title: 'Fix login bug',
//     description: null,
//     status: TaskStatus.TODO,
//     priority: TaskPriority.HIGH,
//     projectId,
//     createdById: userId,
//     dueDate: null,
//     position: 0,
//     isDeleted: false,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     createdBy: mockUser,
//     assignees: [],
//     _count: { comments: 0 },
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         TasksService,
//         {
//           provide: ProjectsService,
//           useValue: {
//             assertProjectBelongsToOrg: jest.fn().mockResolvedValue(undefined),
//           },
//         },
//         {
//           provide: PrismaService,
//           useValue: {
//             task: {
//               create: jest.fn(),
//               findMany: jest.fn(),
//               findFirst: jest.fn(),
//               findUniqueOrThrow: jest.fn(),
//               update: jest.fn(),
//               updateMany: jest.fn(),
//               count: jest.fn(),
//             },
//             taskAssignee: {
//               findUnique: jest.fn(),
//               delete: jest.fn(),
//               deleteMany: jest.fn(),
//               createMany: jest.fn(),
//             },
//             organizationMember: {
//               findMany: jest.fn(),
//             },
//             $transaction: jest.fn(),
//           },
//         },
//       ],
//     }).compile();

//     service = module.get<TasksService>(TasksService);
//     prisma = module.get(PrismaService);
//     projectsService = module.get(ProjectsService);
//   });

//   afterEach(() => jest.clearAllMocks());

//   // ─── CREATE ──────────────────────────────────────────────────────────────

//   describe('create()', () => {
//     it('should create a task successfully', async () => {
//       (prisma.task.findFirst as jest.Mock).mockResolvedValue(null); // no existing
//       (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

//       const result = await service.create(
//         projectId, orgId,
//         { title: 'Fix login bug', priority: TaskPriority.HIGH },
//         userId,
//       );

//       expect(projectsService.assertProjectBelongsToOrg).toHaveBeenCalledWith(
//         projectId, orgId,
//       );
//       expect(result.title).toBe('Fix login bug');
//       expect(result.isOverdue).toBe(false);
//     });

//     it('should validate org members when assigneeIds provided', async () => {
//       const assigneeId = 'other-user-id';
//       // Return empty — user is NOT a member
//       (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([]);

//       await expect(
//         service.create(
//           projectId, orgId,
//           { title: 'Task', assigneeIds: [assigneeId] },
//           userId,
//         ),
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   // ─── FIND ALL ────────────────────────────────────────────────────────────

//   describe('findAll()', () => {
//     it('should return paginated tasks with meta', async () => {
//       (prisma.task.findMany as jest.Mock).mockResolvedValue([mockTask]);
//       (prisma.task.count as jest.Mock).mockResolvedValue(1);

//       const result = await service.findAll(projectId, orgId, {
//         page: 1, limit: 20, skip: 0,
//       } as any);

//       expect(result.data).toHaveLength(1);
//       expect(result.meta).toMatchObject({
//         total: 1,
//         page: 1,
//         totalPages: 1,
//         hasNextPage: false,
//       });
//     });

//     it('should filter by multiple statuses', async () => {
//       (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
//       (prisma.task.count as jest.Mock).mockResolvedValue(0);

//       await service.findAll(projectId, orgId, {
//         page: 1, limit: 20, skip: 0,
//         status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
//       } as any);

//       expect(prisma.task.findMany).toHaveBeenCalledWith(
//         expect.objectContaining({
//           where: expect.objectContaining({
//             status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
//           }),
//         }),
//       );
//     });
//   });

//   // ─── BULK UPDATE ─────────────────────────────────────────────────────────

//   describe('bulkUpdate()', () => {
//     it('should throw if no update fields provided', async () => {
//       await expect(
//         service.bulkUpdate(projectId, orgId, { taskIds: [taskId] }, userId),
//       ).rejects.toThrow(BadRequestException);
//     });

//     it('should skip task IDs not found in project', async () => {
//       const missingId = 'missing-uuid';
//       (prisma.task.findMany as jest.Mock).mockResolvedValue([
//         { id: taskId },
//       ]);
//       (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

//       const result = await service.bulkUpdate(
//         projectId, orgId,
//         { taskIds: [taskId, missingId], status: TaskStatus.DONE },
//         userId,
//       );

//       expect(result.updatedCount).toBe(1);
//       expect(result.skippedIds).toContain(missingId);
//       expect(result.updatedIds).toContain(taskId);
//     });
//   });

//   // ─── ASSIGN MEMBERS ──────────────────────────────────────────────────────

//   describe('assignMembers()', () => {
//     it('should reject users not in the organization', async () => {
//       (prisma.task.findFirst as jest.Mock).mockResolvedValue({ id: taskId });
//       (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([]);

//       await expect(
//         service.assignMembers(taskId, projectId, orgId, {
//           userIds: ['non-member-id'],
//         }),
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   // ─── UNASSIGN MEMBER ─────────────────────────────────────────────────────

//   describe('unassignMember()', () => {
//     it('should throw if user is not assigned to the task', async () => {
//       (prisma.task.findFirst as jest.Mock).mockResolvedValue({ id: taskId });
//       (prisma.taskAssignee.findUnique as jest.Mock).mockResolvedValue(null);

//       await expect(
//         service.unassignMember(taskId, projectId, orgId, 'not-assigned-user'),
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   // ─── OVERDUE DETECTION ───────────────────────────────────────────────────

//   describe('isOverdue calculation', () => {
//     it('should mark task as overdue when dueDate is past and not done', async () => {
//       const overdueTask = {
//         ...mockTask,
//         dueDate: new Date('2020-01-01'), // Far in the past
//         status: TaskStatus.IN_PROGRESS,
//       };
//       (prisma.task.findFirst as jest.Mock).mockResolvedValue(overdueTask);
//       (prisma.task.findMany as jest.Mock).mockResolvedValue([overdueTask]);
//       (prisma.task.count as jest.Mock).mockResolvedValue(1);

//       const result = await service.findAll(projectId, orgId, {
//         page: 1, limit: 20, skip: 0,
//       } as any);

//       expect(result.data[0].isOverdue).toBe(true);
//     });

//     it('should NOT mark DONE tasks as overdue even if past due', async () => {
//       const doneTask = {
//         ...mockTask,
//         dueDate: new Date('2020-01-01'),
//         status: TaskStatus.DONE,
//       };
//       (prisma.task.findMany as jest.Mock).mockResolvedValue([doneTask]);
//       (prisma.task.count as jest.Mock).mockResolvedValue(1);

//       const result = await service.findAll(projectId, orgId, {
//         page: 1, limit: 20, skip: 0,
//       } as any);

//       expect(result.data[0].isOverdue).toBe(false);
//     });
//   });
// });