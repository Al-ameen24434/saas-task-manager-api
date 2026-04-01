import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  OrganizationResponseDto,
  MemberResponseDto,
} from './dto/organization-response.dto';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import {
  CurrentOrganization,
  CurrentMemberRole,
} from '@common/decorators/current-organization.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { OrganizationRoleGuard } from '@common/guards/organization-role.guard';
import { OrganizationRoles } from '@common/decorators/organization-roles.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: UserResponseDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.create(dto, user.id);
  }

  // ─── LIST MY ORGS ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all organizations I belong to' })
  findMyOrganizations(
    @CurrentUser() user: UserResponseDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.organizationsService.findMyOrganizations(user.id, pagination);
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  @Get(':slug')
  @UseGuards(OrganizationRoleGuard)
  @ApiOperation({ summary: 'Get organization details by slug' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  @ApiResponse({ status: 404, description: 'Organization not found or not a member' })
  findOne(
    @Param('slug') slug: string,
    @CurrentUser() user: UserResponseDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.findBySlug(slug, user.id);
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  @Patch(':slug')
  @UseGuards(OrganizationRoleGuard)
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Update organization (ADMIN or OWNER only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  update(
    @Body() dto: UpdateOrganizationDto,
    @CurrentOrganization() org: { id: string; slug: string; name: string },
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.update(org.id, dto);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  @Delete(':slug')
  @UseGuards(OrganizationRoleGuard)
  @OrganizationRoles(OrganizationRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate organization (OWNER only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  async remove(
    @CurrentOrganization() org: { id: string; slug: string; name: string },
  ): Promise<{ message: string }> {
    await this.organizationsService.remove(org.id, org.slug);
    return { message: `Organization '${org.name}' has been deactivated` };
  }

  // ─── INVITE MEMBER ────────────────────────────────────────────────────────

  @Post(':slug/members')
  @UseGuards(OrganizationRoleGuard)
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a user to the organization (ADMIN+ only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  inviteMember(
    @Body() dto: InviteMemberDto,
    @CurrentOrganization() org: { id: string; slug: string; name: string },
    @CurrentMemberRole() myRole: OrganizationRole,
  ): Promise<MemberResponseDto> {
    return this.organizationsService.inviteMember(org.id, dto, myRole);
  }

  // ─── LIST MEMBERS ─────────────────────────────────────────────────────────

  @Get(':slug/members')
  @UseGuards(OrganizationRoleGuard)
  @ApiOperation({ summary: 'List all organization members (any member)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  findMembers(
    @CurrentOrganization() org: { id: string; slug: string; name: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.organizationsService.findMembers(org.id, pagination);
  }

  // ─── UPDATE MEMBER ROLE ───────────────────────────────────────────────────

  @Patch(':slug/members/:userId')
  @UseGuards(OrganizationRoleGuard)
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Change a member\'s role (OWNER only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'userId', description: 'ID of the member to update' })
  updateMemberRole(
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentOrganization() org: { id: string; slug: string; name: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<MemberResponseDto> {
    return this.organizationsService.updateMemberRole(
      org.id,
      targetUserId,
      dto,
      user.id,
    );
  }

  // ─── REMOVE MEMBER ────────────────────────────────────────────────────────

  @Delete(':slug/members/:userId')
  @UseGuards(OrganizationRoleGuard)
  @OrganizationRoles(OrganizationRole.ADMIN, OrganizationRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the organization (ADMIN+ only)' })
  @ApiParam({ name: 'slug', example: 'acme-corp' })
  @ApiParam({ name: 'userId', description: 'ID of the member to remove' })
  async removeMember(
    @Param('userId') targetUserId: string,
    @CurrentOrganization() org: { id: string; slug: string; name: string },
    @CurrentUser() user: UserResponseDto,
  ): Promise<{ message: string }> {
    await this.organizationsService.removeMember(org.id, targetUserId, user.id);
    return { message: 'Member removed successfully' };
  }
}