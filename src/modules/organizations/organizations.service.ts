import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  OrganizationResponseDto,
  MemberResponseDto,
} from './dto/organization-response.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import {
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '@common/exception/custom.exceptions';
import { PaginationDto } from '@common/dto/pagination.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(
    dto: CreateOrganizationDto,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    // Check slug uniqueness
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ResourceAlreadyExistsException('Organization', 'slug');
    }

    // Use a transaction: create org + make creator the OWNER atomically
    // If either fails, both are rolled back — data integrity guaranteed
    const [organization] = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          logoUrl: dto.logoUrl,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: OrganizationRole.OWNER,
        },
      });

      return [org];
    });

    this.logger.log(
      `Organization created: ${organization.slug} by user: ${userId}`,
    );

    return this.mapToResponseDto(organization, OrganizationRole.OWNER);
  }

  // ─── LIST MY ORGANIZATIONS ────────────────────────────────────────────────

  async findMyOrganizations(
    userId: string,
    pagination: PaginationDto,
  ): Promise<{ data: OrganizationResponseDto[]; meta: object }> {
    const { page = 1, limit = 10, skip, search } = pagination;

    const where = {
      userId,
      organization: {
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
    };

    const [memberships, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
        include: {
          organization: true,
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where }),
    ]);

    const data = memberships.map((m) =>
      this.mapToResponseDto(m.organization, m.role),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  async findBySlug(
    slug: string,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organization: { slug } },
      include: {
        organization: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (!membership) {
      throw new ResourceNotFoundException('Organization', slug);
    }

    const { organization } = membership;
    const dto = this.mapToResponseDto(organization, membership.role);
    dto.memberCount = organization._count.members;
    return dto;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      },
    });

    this.logger.log(`Organization updated: ${organization.slug}`);
    return this.mapToResponseDto(organization);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  async remove(organizationId: string, slug: string): Promise<void> {
    // Soft delete — set isActive = false
    // Real production systems rarely hard-delete organizations (audit trail, billing)
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { isActive: false },
    });

    this.logger.log(`Organization deactivated: ${slug}`);
  }

  // ─── INVITE MEMBER ────────────────────────────────────────────────────────

  async inviteMember(
    organizationId: string,
    dto: InviteMemberDto,
    inviterRole: OrganizationRole,
  ): Promise<MemberResponseDto> {
    // ADMIN cannot assign OWNER role — only OWNER can do that
    if (
      dto.role === OrganizationRole.OWNER &&
      inviterRole !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only an OWNER can assign the OWNER role',
      );
    }

    // Find the user being invited
    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!invitee) {
      throw new ResourceNotFoundException(
        'User',
        `with email ${dto.email}`,
      );
    }

    // Check if already a member
    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: invitee.id,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      throw new ResourceAlreadyExistsException(
        'User',
        'already a member of this organization',
      );
    }

    const membership = await this.prisma.organizationMember.create({
      data: {
        userId: invitee.id,
        organizationId,
        role: dto.role ?? OrganizationRole.MEMBER,
      },
      include: { user: true },
    });

    this.logger.log(
      `User ${invitee.email} invited to org ${organizationId} as ${membership.role}`,
    );

    return this.mapMemberToDto(membership);
  }

  // ─── LIST MEMBERS ─────────────────────────────────────────────────────────

  async findMembers(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<{ data: MemberResponseDto[]; meta: object }> {
    const { page = 1, limit = 10, skip, search } = pagination;

    const where = {
      organizationId,
      ...(search && {
        user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const [members, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where }),
    ]);

    return {
      data: members.map(this.mapMemberToDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── UPDATE MEMBER ROLE ───────────────────────────────────────────────────

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requestingUserId: string,
  ): Promise<MemberResponseDto> {
    // Cannot change your own role (prevents owner from accidentally demoting themselves)
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
      include: { user: true },
    });

    if (!targetMembership) {
      throw new ResourceNotFoundException('Member', targetUserId);
    }

    // Prevent demoting the last OWNER
    if (targetMembership.role === OrganizationRole.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: OrganizationRole.OWNER },
      });

      if (ownerCount <= 1 && dto.role !== OrganizationRole.OWNER) {
        throw new BadRequestException(
          'Cannot demote the last owner. Transfer ownership first.',
        );
      }
    }

    const updated = await this.prisma.organizationMember.update({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
      data: { role: dto.role },
      include: { user: true },
    });

    this.logger.log(
      `Member ${targetUserId} role changed to ${dto.role} in org ${organizationId}`,
    );

    return this.mapMemberToDto(updated);
  }

  // ─── REMOVE MEMBER ────────────────────────────────────────────────────────

  async removeMember(
    organizationId: string,
    targetUserId: string,
    requestingUserId: string,
  ): Promise<void> {
    if (targetUserId === requestingUserId) {
      throw new BadRequestException(
        'Cannot remove yourself. Use the leave organization endpoint instead.',
      );
    }

    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });

    if (!targetMembership) {
      throw new ResourceNotFoundException('Member', targetUserId);
    }

    // Prevent removing the last owner
    if (targetMembership.role === OrganizationRole.OWNER) {
      const ownerCount = await this.prisma.organizationMember.count({
        where: { organizationId, role: OrganizationRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last owner of an organization.',
        );
      }
    }

    await this.prisma.organizationMember.delete({
      where: {
        userId_organizationId: { userId: targetUserId, organizationId },
      },
    });

    this.logger.log(
      `Member ${targetUserId} removed from org ${organizationId}`,
    );
  }

  // ─── MAPPERS ──────────────────────────────────────────────────────────────

  private mapToResponseDto(
    org: any,
    role?: OrganizationRole,
  ): OrganizationResponseDto {
    const dto = new OrganizationResponseDto();
    dto.id = org.id;
    dto.name = org.name;
    dto.slug = org.slug;
    dto.description = org.description;
    dto.logoUrl = org.logoUrl;
    dto.isActive = org.isActive;
    dto.createdAt = org.createdAt;
    dto.updatedAt = org.updatedAt;
    if (role) dto.myRole = role;
    return dto;
  }

  private mapMemberToDto = (membership: any): MemberResponseDto => {
    const dto = new MemberResponseDto();
    dto.id = membership.id;
    dto.role = membership.role;
    dto.joinedAt = membership.joinedAt;
    dto.user = UserResponseDto.fromEntity(membership.user);
    return dto;
  };
}