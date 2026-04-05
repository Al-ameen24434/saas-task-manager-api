import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { AssignMembersDto } from './dto/assign-members.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { TaskResponseDto, BulkUpdateResultDto } from './dto/task-response.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { ResourceNotFoundException } from '@common/exception/custom.exceptions';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(
    projectId: string,
    organizationId: string,
    dto: CreateTaskDto,
    userId: string,
  ): Promise<TaskResponseDto> {
    // Verify project scope — throws 404 if project not in this org
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    // Validate assignees are all members of this organization
    if (dto.assigneeIds?.length) {
      await this.validateOrgMembers(dto.assigneeIds, organizationId);
    }

    // Auto-position: place at the end of the status column
    const position =
      dto.position ??
      (await this.getNextPosition(projectId, dto.status ?? TaskStatus.TODO));

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        projectId,
        createdById: userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        position,
        // Create assignee junction records in the same query
        assignees: dto.assigneeIds?.length
          ? {
              create: dto.assigneeIds.map((uid) => ({ userId: uid })),
            }
          : undefined,
      },
      include: this.taskInclude(),
    });

    this.logger.log(
      `Task created: "${task.title}" in project: ${projectId}`,
    );

    return this.mapToResponseDto(task);
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async findAll(
    projectId: string,
    organizationId: string,
    query: TaskQueryDto,
  ): Promise<{ data: TaskResponseDto[]; meta: object }> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    const {
      page = 1,
      limit = 20,
      skip,
      status,
      priority,
      assigneeId,
      createdById,
      search,
      dueBefore,
      dueAfter,
      overdue,
      sortBy = 'position',
      sortOrder = 'asc',
    } = query;

    // Build dynamic WHERE clause
    const where: Prisma.TaskWhereInput = {
      projectId,
      isDeleted: false,
      // Multi-value enum filter: ?status=TODO,IN_PROGRESS
      ...(status?.length && { status: { in: status } }),
      ...(priority?.length && { priority: { in: priority } }),
      ...(createdById && { createdById }),
      // Assignee filter via relation
      ...(assigneeId && {
        assignees: { some: { userId: assigneeId } },
      }),
      // Full-text search across title and description
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      // Date range filters
      ...(dueBefore || dueAfter || overdue
        ? {
            dueDate: {
              ...(dueBefore && { lte: new Date(dueBefore) }),
              ...(dueAfter && { gte: new Date(dueAfter) }),
              // Overdue: dueDate is in the past
              ...(overdue && { lt: new Date() }),
            },
          }
        : {}),
      // Overdue also requires not completed/cancelled
      ...(overdue && {
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.taskInclude(),
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map((t) => this.mapToResponseDto(t)),
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
    taskId: string,
    projectId: string,
    organizationId: string,
  ): Promise<TaskResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, isDeleted: false },
      include: {
        ...this.taskInclude(),
        _count: { select: { comments: true } },
      },
    });

    if (!task) throw new ResourceNotFoundException('Task', taskId);

    const dto = this.mapToResponseDto(task);
    dto.commentCount = task._count?.comments ?? 0;
    return dto;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(
    taskId: string,
    projectId: string,
    organizationId: string,
    dto: UpdateTaskDto,
    userId: string,
  ): Promise<TaskResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    const task = await this.assertTaskExists(taskId, projectId);

    // If changing assignees, validate they're all org members
    if (dto.assigneeIds !== undefined) {
      if (dto.assigneeIds.length > 0) {
        await this.validateOrgMembers(dto.assigneeIds, organizationId);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If assigneeIds provided, replace all assignees atomically
      if (dto.assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (dto.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: dto.assigneeIds.map((uid) => ({ taskId, userId: uid })),
          });
        }
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
          ...(dto.position !== undefined && { position: dto.position }),
        },
        include: this.taskInclude(),
      });
    });

    this.logger.log(`Task updated: ${taskId} by user: ${userId}`);
    return this.mapToResponseDto(updated);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  async remove(
    taskId: string,
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.assertTaskExists(taskId, projectId);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { isDeleted: true },
    });

    this.logger.log(`Task soft-deleted: ${taskId}`);
  }

  // ─── ASSIGN MEMBERS ────────────────────────────────────────────────────────

  async assignMembers(
    taskId: string,
    projectId: string,
    organizationId: string,
    dto: AssignMembersDto,
  ): Promise<TaskResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.assertTaskExists(taskId, projectId);

    // Critical: only org members can be assigned to tasks
    await this.validateOrgMembers(dto.userIds, organizationId);

    // Replace all assignees atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskAssignee.createMany({
        data: dto.userIds.map((userId) => ({ taskId, userId })),
        skipDuplicates: true,
      });
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: this.taskInclude(),
    });

    this.logger.log(
      `Task ${taskId} assigned to ${dto.userIds.length} users`,
    );

    return this.mapToResponseDto(task);
  }

  // ─── UNASSIGN MEMBER ──────────────────────────────────────────────────────

  async unassignMember(
    taskId: string,
    projectId: string,
    organizationId: string,
    targetUserId: string,
  ): Promise<TaskResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.assertTaskExists(taskId, projectId);

    const assignee = await this.prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });

    if (!assignee) {
      throw new BadRequestException(
        'User is not assigned to this task',
      );
    }

    await this.prisma.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: this.taskInclude(),
    });

    return this.mapToResponseDto(task);
  }

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────

  async updateStatus(
    taskId: string,
    projectId: string,
    organizationId: string,
    dto: UpdateTaskStatusDto,
    userId: string,
  ): Promise<TaskResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.assertTaskExists(taskId, projectId);

    // When moving to a new status column, place at the end
    const position = await this.getNextPosition(projectId, dto.status);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status, position },
      include: this.taskInclude(),
    });

    this.logger.log(
      `Task ${taskId} status → ${dto.status} by user: ${userId}`,
    );

    return this.mapToResponseDto(task);
  }

  // ─── BULK UPDATE ──────────────────────────────────────────────────────────

  async bulkUpdate(
    projectId: string,
    organizationId: string,
    dto: BulkUpdateTasksDto,
    userId: string,
  ): Promise<BulkUpdateResultDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    if (!dto.status && !dto.priority) {
      throw new BadRequestException(
        'At least one field (status or priority) must be provided for bulk update',
      );
    }

    // Find which of the requested task IDs actually exist in this project
    const existingTasks = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        projectId,
        isDeleted: false,
      },
      select: { id: true },
    });

    const existingIds = existingTasks.map((t) => t.id);
    const skippedIds = dto.taskIds.filter((id) => !existingIds.includes(id));

    if (existingIds.length === 0) {
      throw new BadRequestException(
        'None of the provided task IDs were found in this project',
      );
    }

    // Bulk update using Prisma updateMany
    const result = await this.prisma.task.updateMany({
      where: {
        id: { in: existingIds },
        projectId,
        isDeleted: false,
      },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
      },
    });

    this.logger.log(
      `Bulk updated ${result.count} tasks in project ${projectId} by user: ${userId}`,
    );

    return {
      updatedCount: result.count,
      updatedIds: existingIds,
      skippedIds,
    };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  /**
   * Validates that ALL provided user IDs are members of the organization.
   * Throws if any user is not a member — prevents assigning external users.
   */
  private async validateOrgMembers(
    userIds: string[],
    organizationId: string,
  ): Promise<void> {
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);
    const nonMembers = userIds.filter((id) => !memberIds.includes(id));

    if (nonMembers.length > 0) {
      throw new BadRequestException(
        `The following users are not members of this organization: ${nonMembers.join(', ')}`,
      );
    }
  }

  /**
   * Gets the next position value for a task in a given status column.
   * This enables ordered lists / drag-and-drop positioning.
   */
  private async getNextPosition(
    projectId: string,
    status: TaskStatus,
  ): Promise<number> {
    const lastTask = await this.prisma.task.findFirst({
      where: { projectId, status, isDeleted: false },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    // Increment by 1000 to leave room for insertions between items
    return lastTask ? lastTask.position + 1000 : 0;
  }

  /**
   * Asserts a task exists in a project. Returns the task or throws 404.
   */
  private async assertTaskExists(taskId: string, projectId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId, isDeleted: false },
      select: { id: true, title: true },
    });

    if (!task) throw new ResourceNotFoundException('Task', taskId);
    return task;
  }

  /**
   * Standard include object for task queries.
   * Centralised here — change once, applies everywhere.
   */
  private taskInclude() {
    return {
      createdBy: true,
      assignees: {
        include: { user: true },
        orderBy: { assignedAt: 'asc' as const },
      },
    };
  }

  /**
   * Maps a raw Prisma task record to the response DTO.
   */
  private mapToResponseDto(task: any): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = task.id;
    dto.title = task.title;
    dto.description = task.description;
    dto.status = task.status;
    dto.priority = task.priority;
    dto.projectId = task.projectId;
    dto.dueDate = task.dueDate;
    dto.position = task.position;
    dto.createdAt = task.createdAt;
    dto.updatedAt = task.updatedAt;
    dto.createdBy = UserResponseDto.fromEntity(task.createdBy);
    dto.assignees = task.assignees.map((a: any) =>
      UserResponseDto.fromEntity(a.user),
    );
    dto.isOverdue =
      !!task.dueDate &&
      task.dueDate < new Date() &&
      ![TaskStatus.DONE, TaskStatus.CANCELLED].includes(task.status);
    return dto;
  }

    /**
     * Public scope validator used by CommentsService.
     * Verifies a task belongs to a project.
     */
    async assertTaskBelongsToProject(
    taskId: string,
    projectId: string,
    ): Promise<void> {
    const task = await this.prisma.task.findFirst({
        where: { id: taskId, projectId, isDeleted: false },
        select: { id: true },
    });
    if (!task) throw new ResourceNotFoundException('Task', taskId);
    }
}