import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: OrganizationRole,
    example: OrganizationRole.ADMIN,
  })
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;
}