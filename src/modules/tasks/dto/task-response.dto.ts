import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class TaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Implement login page' })
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ enum: TaskPriority })
  priority: TaskPriority;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  dueDate: Date | null;

  @ApiProperty({ description: 'Order position within the status column' })
  position: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => UserResponseDto })
  createdBy: UserResponseDto;

  @ApiProperty({
    type: () => [UserResponseDto],
    description: 'Users assigned to this task',
  })
  assignees: UserResponseDto[];

  @ApiPropertyOptional()
  commentCount?: number;

  // Computed: is this task overdue?
  @ApiProperty()
  isOverdue: boolean;
}

export class BulkUpdateResultDto {
  @ApiProperty({ description: 'Number of tasks successfully updated' })
  updatedCount: number;

  @ApiProperty({ type: [String], description: 'IDs of updated tasks' })
  updatedIds: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs that were skipped (not found or not in project)',
  })
  skippedIds?: string[];
}