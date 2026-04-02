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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { AssignMembersDto } from './dto/assign-members.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { TaskResponseDto, BulkUpdateResultDto } from './dto/task-response.dto';
import { OrganizationRoleGuard } from '@common/guards/organization-role.guard';
import { OrganizationRoles } from '@common/decorators/organization-roles.decorator';
import { CurrentOrganization } from '@common/decorators/current-organization.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

@ApiTags('Tasks')
@ApiBearerAuth('JWT-auth')
@UseGuards(OrganizationRoleGuard)
@Controller('organizations/:slug/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task in a project' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(projectId, org.id, dto, user.id);
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary:
      'List tasks — filter by status, priority, assignee, due date, search',
  })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: TaskQueryDto,
    @CurrentOrganization() org: { id: string },
  ) {
    return this.tasksService.findAll(projectId, org.id, query);
  }

  // ─── BULK UPDATE ──────────────────────────────────────────────────────────

  @Patch('bulk')
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @ApiOperation({
    summary: 'Bulk update multiple tasks (ADMIN+ only) — max 50 tasks',
  })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, type: BulkUpdateResultDto })
  bulkUpdate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: BulkUpdateTasksDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<BulkUpdateResultDto> {
    return this.tasksService.bulkUpdate(projectId, org.id, dto, user.id);
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  @Get(':taskId')
  @ApiOperation({ summary: 'Get task details including assignees and comment count' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<TaskResponseDto> {
    return this.tasksService.findOne(taskId, projectId, org.id);
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  @Patch(':taskId')
  @ApiOperation({ summary: 'Update task fields' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(taskId, projectId, org.id, dto, user.id);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a task' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<{ message: string }> {
    await this.tasksService.remove(taskId, projectId, org.id);
    return { message: 'Task deleted successfully' };
  }

  // ─── ASSIGN MEMBERS ────────────────────────────────────────────────────────

  @Post(':taskId/assign')
  @ApiOperation({
    summary: 'Set task assignees (replaces current assignees)',
  })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  assignMembers(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignMembersDto,
    @CurrentOrganization() org: { id: string },
  ): Promise<TaskResponseDto> {
    return this.tasksService.assignMembers(taskId, projectId, org.id, dto);
  }

  // ─── UNASSIGN MEMBER ──────────────────────────────────────────────────────

  @Delete(':taskId/assign/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a single assignee from a task' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to unassign' })
  async unassignMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<TaskResponseDto> {
    return this.tasksService.unassignMember(
      taskId,
      projectId,
      org.id,
      targetUserId,
    );
  }

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────

  @Patch(':taskId/status')
  @ApiOperation({
    summary: 'Update task status — auto-positions at end of new column',
  })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  updateStatus(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.updateStatus(
      taskId,
      projectId,
      org.id,
      dto,
      user.id,
    );
  }
}