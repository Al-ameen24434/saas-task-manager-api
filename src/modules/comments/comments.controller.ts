import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { OrganizationRoleGuard } from '@common/guards/organization-role.guard';
import { CurrentOrganization } from '@common/decorators/current-organization.decorator';
import { CurrentMemberRole } from '@common/decorators/current-organization.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

@ApiTags('Comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(OrganizationRoleGuard)
@Controller(
  'organizations/:slug/projects/:projectId/tasks/:taskId/comments',
)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a task (any member)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(
      taskId, projectId, org.id, dto, user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List comments on a task (chronological)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: CommentQueryDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ) {
    return this.commentsService.findAll(
      taskId, projectId, org.id, query, user.id,
    );
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Edit a comment (author only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiParam({ name: 'commentId' })
  @ApiResponse({ status: 200, type: CommentResponseDto })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.update(
      commentId, taskId, projectId, org.id, dto, user.id,
    );
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment (author or ADMIN+)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'taskId' })
  @ApiParam({ name: 'commentId' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
    @CurrentMemberRole() role: OrganizationRole,
  ): Promise<{ message: string }> {
    await this.commentsService.remove(
      commentId, taskId, projectId, org.id, user.id, role,
    );
    return { message: 'Comment deleted successfully' };
  }
}