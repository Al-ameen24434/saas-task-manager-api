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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { ProjectResponseDto, ProjectStatsDto } from './dto/project-response.dto';
import { OrganizationRoleGuard } from '@common/guards/organization-role.guard';
import { OrganizationRoles } from '@common/decorators/organization-roles.decorator';
import { CurrentOrganization } from '@common/decorators/current-organization.decorator';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(OrganizationRoleGuard)   // Applied at class level — ALL routes require org membership
@Controller('organizations/:slug/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  @Post()
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project (ADMIN+ only)' })
  @ApiParam({ name: 'slug', example: 'adisa-corp' })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  create(
    @Body() dto: CreateProjectDto,
    @CurrentOrganization() org: { id: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(org.id, dto, user.id);
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List projects in organization (supports filtering, sorting, pagination)',
  })
  @ApiParam({ name: 'slug', example: 'adisa-corp' })
  findAll(
    @Query() query: ProjectQueryDto,
    @CurrentOrganization() org: { id: string },
  ) {
    return this.projectsService.findAll(org.id, query);
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details including task counts' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(projectId, org.id);
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  @Patch(':projectId')
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Update project details (ADMIN+ only)' })
  @ApiParam({ name: 'slug', example: 'adisa-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentOrganization() org: { id: string },
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(projectId, org.id, dto);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  @Delete(':projectId')
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a project (ADMIN+ only)' })
  @ApiParam({ name: 'slug', example: 'adisa-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<{ message: string }> {
    await this.projectsService.remove(projectId, org.id);
    return { message: 'Project deleted successfully' };
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  @Get(':projectId/stats')
  @ApiOperation({
    summary: 'Get project statistics: task counts, completion rate, overdue tasks',
  })
  @ApiParam({ name: 'slug', example: 'adisa-corp' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, type: ProjectStatsDto })
  getStats(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentOrganization() org: { id: string },
  ): Promise<ProjectStatsDto> {
    return this.projectsService.getStats(projectId, org.id);
  }
}