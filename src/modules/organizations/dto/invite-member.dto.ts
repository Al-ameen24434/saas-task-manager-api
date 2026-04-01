import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'abdul@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
    description: 'Role to assign. OWNER role cannot be assigned via invite.',
  })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole = OrganizationRole.MEMBER;
}