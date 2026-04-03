import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ProjectsService } from '@modules/projects/projects.service';
import { TasksService } from '@modules/tasks/tasks.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { ResourceNotFoundException } from '@common/exception/custom.exceptions';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(
    taskId: string,
    projectId: string,
    organizationId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    // Validate the full scope chain
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.tasksService.assertTaskBelongsToProject(taskId, projectId);

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        taskId,
        authorId: userId,
      },
      include: { author: true },
    });

    this.logger.log(`Comment created on task ${taskId} by user ${userId}`);
    return this.mapToDto(comment, userId);
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async findAll(
    taskId: string,
    projectId: string,
    organizationId: string,
    query: CommentQueryDto,
    requestingUserId: string,
  ): Promise<{ data: CommentResponseDto[]; meta: object }> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );
    await this.tasksService.assertTaskBelongsToProject(taskId, projectId);

    const { page = 1, limit = 20, skip, sortOrder = 'asc' } = query;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { taskId },
        include: { author: true },
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where: { taskId } }),
    ]);

    return {
      data: comments.map((c) => this.mapToDto(c, requestingUserId)),
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

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(
    commentId: string,
    taskId: string,
    projectId: string,
    organizationId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    const comment = await this.assertCommentExists(commentId, taskId);

    // Only the comment author can edit their own comment
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content, isEdited: true },
      include: { author: true },
    });

    return this.mapToDto(updated, userId);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  async remove(
    commentId: string,
    taskId: string,
    projectId: string,
    organizationId: string,
    userId: string,
    userRole: OrganizationRole,
  ): Promise<void> {
    await this.projectsService.assertProjectBelongsToOrg(
      projectId,
      organizationId,
    );

    const comment = await this.assertCommentExists(commentId, taskId);

    // Author can always delete their own comment
    // ADMIN and OWNER can delete any comment (moderation)
    const isAuthor = comment.authorId === userId;
    const isModerator =
      userRole === OrganizationRole.ADMIN ||
      userRole === OrganizationRole.OWNER;

    if (!isAuthor && !isModerator) {
      throw new ForbiddenException(
        'You can only delete your own comments, or you must be an ADMIN/OWNER',
      );
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    this.logger.log(`Comment ${commentId} deleted by user ${userId}`);
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private async assertCommentExists(commentId: string, taskId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });
    if (!comment) throw new ResourceNotFoundException('Comment', commentId);
    return comment;
  }

  private mapToDto(comment: any, requestingUserId: string): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = comment.id;
    dto.content = comment.content;
    dto.taskId = comment.taskId;
    dto.isEdited = comment.isEdited;
    dto.createdAt = comment.createdAt;
    dto.updatedAt = comment.updatedAt;
    dto.author = UserResponseDto.fromEntity(comment.author);
    dto.isOwn = comment.authorId === requestingUserId;
    return dto;
  }
}