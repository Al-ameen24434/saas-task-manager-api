// import { Test, TestingModule } from '@nestjs/testing';
// import { BadRequestException } from '@nestjs/common';
// import { ProjectStatus, TaskStatus } from '@prisma/client';
// import { ProjectsService } from './projects.service';
// import { PrismaService } from '@database/prisma.service';
// import { ResourceNotFoundException } from '@common/exceptions/custom.exceptions';

// describe('ProjectsService', () => {
//   let service: ProjectsService;
//   let prisma: jest.Mocked<PrismaService>;

//   const orgId = 'org-uuid-1';
//   const userId = 'user-uuid-1';
//   const projectId = 'project-uuid-1';

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

//   const mockProject = {
//     id: projectId,
//     name: 'Website Redesign',
//     description: 'Redesign the website',
//     status: ProjectStatus.ACTIVE,
//     organizationId: orgId,
//     createdById: userId,
//     startDate: null,
//     endDate: null,
//     isDeleted: false,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     createdBy: mockUser,
//     _count: { tasks: 5 },
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         ProjectsService,
//         {
//           provide: PrismaService,
//           useValue: {
//             project: {
//               create: jest.fn(),
//               findMany: jest.fn(),
//               findFirst: jest.fn(),
//               update: jest.fn(),
//               count: jest.fn(),
//             },
//             task: {
//               groupBy: jest.fn(),
//               count: jest.fn(),
//             },
//             taskAssignee: {
//               count: jest.fn(),
//             },
//           },
//         },
//       ],
//     }).compile();

//     service = module.get<ProjectsService>(ProjectsService);
//     prisma = module.get(PrismaService);
//   });

//   afterEach(() => jest.clearAllMocks());

//   // ─── CREATE ──────────────────────────────────────────────────────────────

//   describe('create()', () => {
//     it('should create a project successfully', async () => {
//       (prisma.project.create as jest.Mock).mockResolvedValue(mockProject);

//       const result = await service.create(
//         orgId,
//         { name: 'Website Redesign', description: 'Redesign the website' },
//         userId,
//       );

//       expect(result.name).toBe('Website Redesign');
//       expect(result.organizationId).toBe(orgId);
//       expect(result.createdBy.id).toBe(userId);
//     });

//     it('should throw BadRequestException when endDate is before startDate', async () => {
//       await expect(
//         service.create(
//           orgId,
//           {
//             name: 'Test',
//             startDate: '2024-06-01',
//             endDate: '2024-01-01',  // Before startDate
//           },
//           userId,
//         ),
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   // ─── FIND ONE ────────────────────────────────────────────────────────────

//   describe('findOne()', () => {
//     it('should return project with task counts', async () => {
//       (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
//       (prisma.task.groupBy as jest.Mock).mockResolvedValue([
//         { status: TaskStatus.TODO, _count: { status: 3 } },
//         { status: TaskStatus.DONE, _count: { status: 2 } },
//       ]);

//       const result = await service.findOne(projectId, orgId);

//       expect(result.id).toBe(projectId);
//       expect(result.taskCounts?.total).toBe(5);
//       expect(result.taskCounts?.todo).toBe(3);
//       expect(result.taskCounts?.done).toBe(2);
//     });

//     it('should throw ResourceNotFoundException if project not found', async () => {
//       (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

//       await expect(service.findOne('nonexistent', orgId)).rejects.toThrow(
//         ResourceNotFoundException,
//       );
//     });

//     it('should throw if project belongs to a different org', async () => {
//       // findFirst returns null when orgId doesn't match (WHERE clause filters it out)
//       (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

//       await expect(
//         service.findOne(projectId, 'different-org-id'),
//       ).rejects.toThrow(ResourceNotFoundException);
//     });
//   });

//   // ─── FIND ALL ────────────────────────────────────────────────────────────

//   describe('findAll()', () => {
//     it('should return paginated projects', async () => {
//       (prisma.project.findMany as jest.Mock).mockResolvedValue([mockProject]);
//       (prisma.project.count as jest.Mock).mockResolvedValue(1);

//       const result = await service.findAll(orgId, {
//         page: 1,
//         limit: 10,
//         skip: 0,
//       } as any);

//       expect(result.data).toHaveLength(1);
//       expect(result.meta).toMatchObject({
//         total: 1,
//         page: 1,
//         limit: 10,
//         totalPages: 1,
//         hasNextPage: false,
//         hasPreviousPage: false,
//       });
//     });

//     it('should run count and findMany in parallel', async () => {
//       (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
//       (prisma.project.count as jest.Mock).mockResolvedValue(0);

//       await service.findAll(orgId, { page: 1, limit: 10, skip: 0 } as any);

//       // Both called exactly once — parallel execution
//       expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
//       expect(prisma.project.count).toHaveBeenCalledTimes(1);
//     });
//   });

//   // ─── STATS ───────────────────────────────────────────────────────────────

//   describe('getStats()', () => {
//     it('should calculate completion rate correctly', async () => {
//       (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
//       (prisma.task.groupBy as jest.Mock)
//         .mockResolvedValueOnce([
//           // tasksByStatus
//           { status: 'TODO', _count: { status: 3 } },
//           { status: 'DONE', _count: { status: 7 } },
//         ])
//         .mockResolvedValueOnce([
//           // tasksByPriority
//           { priority: 'HIGH', _count: { priority: 5 } },
//           { priority: 'MEDIUM', _count: { priority: 5 } },
//         ]);
//       (prisma.taskAssignee.count as jest.Mock).mockResolvedValue(4);
//       (prisma.task.count as jest.Mock).mockResolvedValue(1); // overdue

//       const stats = await service.getStats(projectId, orgId);

//       expect(stats.totalTasks).toBe(10);
//       expect(stats.completedTasks).toBe(7);
//       expect(stats.completionRate).toBe(70);
//       expect(stats.overdueTasksCount).toBe(1);
//     });

//     it('should return 0% completion when there are no tasks', async () => {
//       (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
//       (prisma.task.groupBy as jest.Mock).mockResolvedValue([]);
//       (prisma.taskAssignee.count as jest.Mock).mockResolvedValue(0);
//       (prisma.task.count as jest.Mock).mockResolvedValue(0);

//       const stats = await service.getStats(projectId, orgId);

//       expect(stats.totalTasks).toBe(0);
//       expect(stats.completionRate).toBe(0); // No division by zero
//     });
//   });
// });