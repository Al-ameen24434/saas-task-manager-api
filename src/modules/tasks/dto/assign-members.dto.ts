import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignMembersDto {
  @ApiProperty({
    type: [String],
    description: 'Array of user UUIDs to assign. Replaces current assignees.',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsNotEmpty()
  @IsUUID('4', { each: true })
  userIds: string[];
}