import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';

/**
 * Declares which org roles are permitted to access a route.
 * Usage: @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
 *
 * The guard reads this metadata and checks the requesting user's
 * role within the target organization.
 */
export const OrganizationRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);