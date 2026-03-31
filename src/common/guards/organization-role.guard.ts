import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ORGANIZATION_ROLES_KEY } from '@common/decorators/organization-roles.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { Request } from 'express';

// Extend Express Request to carry the resolved membership
declare module 'express' {
  interface Request {
    organization?: {
      id: string;
      slug: string;
      name: string;
    };
    membership?: {
      role: OrganizationRole;
    };
  }
}

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Read the roles required by the route decorator
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @OrganizationRoles() decorator = any authenticated member can access
    if (!requiredRoles || requiredRoles.length === 0) {
      // Still verify they ARE a member — just no role restriction
      return this.verifyMembership(context);
    }

    return this.verifyMembership(context, requiredRoles);
  }

  private async verifyMembership(
    context: ExecutionContext,
    requiredRoles?: OrganizationRole[],
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as UserResponseDto;

    // Org slug comes from the route param: /organizations/:slug
    const rawSlug = request.params['slug'];
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    if (!slug) {
      // Route doesn't have :slug param — guard is misapplied
      throw new ForbiddenException('Organization context is required');
    }

    // 2. Look up the organization AND the user's membership in one query
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organization: { slug },
      },
      include: {
        organization: {
          select: { id: true, slug: true, name: true, isActive: true },
        },
      },
    });

    // 3. User is not a member of this org at all
    if (!membership) {
      throw new NotFoundException(
        `Organization '${slug}' not found or you are not a member`,
      );
    }

    // 4. Org must be active
    if (!membership.organization.isActive) {
      throw new ForbiddenException('This organization has been deactivated');
    }

    // 5. Attach org and membership to request for use in controllers/services
    //    This prevents querying the same data twice (guard + service)
    request.organization = {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
    };
    request.membership = { role: membership.role };

    // 6. Check role hierarchy if roles are required
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = this.hasRequiredRole(membership.role, requiredRoles);
      if (!hasRole) {
        throw new ForbiddenException(
          `This action requires one of these roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    return true;
  }

  /**
   * Role hierarchy check.
   * OWNER satisfies ADMIN requirements. ADMIN satisfies MEMBER requirements.
   */
  private hasRequiredRole(
    userRole: OrganizationRole,
    requiredRoles: OrganizationRole[],
  ): boolean {
    const hierarchy: Record<OrganizationRole, number> = {
      [OrganizationRole.OWNER]: 3,
      [OrganizationRole.ADMIN]: 2,
      [OrganizationRole.MEMBER]: 1,
    };

    const userLevel = hierarchy[userRole];
    // User passes if their level is >= any of the required role levels
    return requiredRoles.some((role) => userLevel >= hierarchy[role]);
  }
}