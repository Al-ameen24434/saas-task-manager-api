import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ProjectStatus, TaskStatus, TaskPriority, Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { ProjectResponseDto, ProjectStatsDto } from './dto/project-response.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { ResourceNotFoundException } from '@common/exception/custom.exceptions';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    dto: CreateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    // Validate date range if both provided
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status ?? ProjectStatus.ACTIVE,
        organizationId,
        createdById: userId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        createdBy: true,
      },
    });

    this.logger.log(
      `Project created: "${project.name}" in org: ${organizationId}`,
    );

    return this.mapToResponseDto(project);
  }

  // ─── LIST (with filtering, sorting, pagination) ────────────────────────────

  async findAll(
    organizationId: string,
    query: ProjectQueryDto,
  ): Promise<{ data: ProjectResponseDto[]; meta: object }> {
    const {
      page = 1,
      limit = 10,
      skip,
      status,
      search,
      createdById,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build the WHERE clause dynamically
    // Prisma's type-safe query builder prevents SQL injection by design
    const where: Prisma.ProjectWhereInput = {
      organizationId,   // ← ALWAYS scoped to this org
      isDeleted: false, // ← Only active projects (we'll add this field)
      ...(status && { status }),
      ...(createdById && { createdById }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Run count and data queries in parallel — halves response time
    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          createdBy: true,
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => this.mapToResponseDto(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ─── FIND ONE ──────────────────────────────────────────────────────────────

  async findOne(
    projectId: string,
    organizationId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,   // Scope check — prevents cross-org access
        isDeleted: false,
      },
      include: {
        createdBy: true,
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', projectId);
    }

    // Fetch task counts broken down by status
    const taskCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId, isDeleted: false },
      _count: { status: true },
    });

    const dto = this.mapToResponseDto(project);
    dto.taskCounts = this.buildTaskCounts(taskCounts);

    return dto;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(
    projectId: string,
    organizationId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    // Verify project exists in this org before updating
    await this.assertProjectExists(projectId, organizationId);

    // Validate date range
    if (dto.startDate && dto.endDate) {
      if (new Date(dto.endDate) <= new Date(dto.startDate)) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
      include: { createdBy: true },
    });

    this.logger.log(`Project updated: ${projectId}`);
    return this.mapToResponseDto(project);
  }

  // ─── DELETE (soft) ────────────────────────────────────────────────────────

  async remove(projectId: string, organizationId: string): Promise<void> {
    await this.assertProjectExists(projectId, organizationId);

    // Soft delete — preserve data for audit trail
    await this.prisma.project.update({
      where: { id: projectId },
      data: { isDeleted: true, status: ProjectStatus.ARCHIVED },
    });

    this.logger.log(`Project soft-deleted: ${projectId}`);
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  async getStats(
    projectId: string,
    organizationId: string,
  ): Promise<ProjectStatsDto> {
    await this.assertProjectExists(projectId, organizationId);

    // Run all aggregation queries in parallel
    const [tasksByStatus, tasksByPriority, memberCount, overdueTasks] =
      await Promise.all([
        // Group tasks by status
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId, isDeleted: false },
          _count: { status: true },
        }),

        // Group tasks by priority
        this.prisma.task.groupBy({
          by: ['priority'],
          where: { projectId, isDeleted: false },
          _count: { priority: true },
        }),

        // Count unique members who are assigned tasks in this project
        this.prisma.taskAssignee.count({
          where: { task: { projectId } },
        }),

        // Count overdue tasks (dueDate in the past, not done/cancelled)
        this.prisma.task.count({
          where: {
            projectId,
            isDeleted: false,
            dueDate: { lt: new Date() },
            status: {
              notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
            },
          },
        }),
      ]);

    // Flatten groupBy results into plain objects
    const statusMap = Object.fromEntries(
      tasksByStatus.map((t) => [t.status, t._count.status]),
    );
    const priorityMap = Object.fromEntries(
      tasksByPriority.map((t) => [t.priority, t._count.priority]),
    );

    const totalTasks = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const completedTasks = statusMap[TaskStatus.DONE] ?? 0;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      completionRate,
      tasksByStatus: statusMap,
      tasksByPriority: priorityMap,
      totalMembers: memberCount,
      overdueTasksCount: overdueTasks,
    };
  }

  // ─── GUARD HELPER (used by other modules) ─────────────────────────────────

  /**
   * Verifies a project belongs to an organization.
   * Used by TasksService to verify scope before any task operation.
   */
  async assertProjectBelongsToOrg(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.assertProjectExists(projectId, organizationId);
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private async assertProjectExists(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
      select: { id: true },
    });

    if (!project) {
      throw new ResourceNotFoundException('Project', projectId);
    }
  }

  private buildTaskCounts(
    groupByResult: Array<{ status: TaskStatus; _count: { status: number } }>,
  ) {
    const map = Object.fromEntries(
      groupByResult.map((r) => [r.status, r._count.status]),
    );

    return {
      total: Object.values(map).reduce((a, b) => a + b, 0),
      todo: map[TaskStatus.TODO] ?? 0,
      inProgress: map[TaskStatus.IN_PROGRESS] ?? 0,
      inReview: map[TaskStatus.IN_REVIEW] ?? 0,
      done: map[TaskStatus.DONE] ?? 0,
      cancelled: map[TaskStatus.CANCELLED] ?? 0,
    };
  }

  private mapToResponseDto(project: any): ProjectResponseDto {
    const dto = new ProjectResponseDto();
    dto.id = project.id;
    dto.name = project.name;
    dto.description = project.description;
    dto.status = project.status;
    dto.organizationId = project.organizationId;
    dto.startDate = project.startDate;
    dto.endDate = project.endDate;
    dto.createdAt = project.createdAt;
    dto.updatedAt = project.updatedAt;
    dto.createdBy = UserResponseDto.fromEntity(project.createdBy);
    return dto;
  }
}