import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { OrganizationRole } from '@prisma/client';

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.organization;
  },
);

export const CurrentMemberRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrganizationRole => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.membership!.role;
  },
);