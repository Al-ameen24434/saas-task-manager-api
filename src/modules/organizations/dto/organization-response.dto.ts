import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'rahmon Corporation' })
  name: string;

  @ApiProperty({ example: 'rahmon-corp' })
  slug: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  logoUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Included when fetching "my organizations" — shows the user's own role
  @ApiPropertyOptional({ enum: OrganizationRole })
  myRole?: OrganizationRole;

  // Included when fetching org details
  @ApiPropertyOptional()
  memberCount?: number;
}

export class MemberResponseDto {
  @ApiProperty()
  id: string;  // OrganizationMember id

  @ApiProperty({ enum: OrganizationRole })
  role: OrganizationRole;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;
}