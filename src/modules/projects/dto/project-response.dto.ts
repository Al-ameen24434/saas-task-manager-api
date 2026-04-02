import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Website Redesign' })
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty({ description: 'ID of the parent organization' })
  organizationId: string;

  @ApiPropertyOptional()
  startDate: Date | null;

  @ApiPropertyOptional()
  endDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Nested creator info — avoids a separate API call from the frontend
  @ApiProperty({ type: () => UserResponseDto })
  createdBy: UserResponseDto;

  // Task summary counts — useful for project cards in the UI
  @ApiPropertyOptional()
  taskCounts?: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    cancelled: number;
  };
}

export class ProjectStatsDto {
  @ApiProperty()
  totalTasks: number;

  @ApiProperty()
  completedTasks: number;

  @ApiProperty({ description: 'Completion percentage 0-100' })
  completionRate: number;

  @ApiProperty()
  tasksByStatus: Record<string, number>;

  @ApiProperty()
  tasksByPriority: Record<string, number>;

  @ApiProperty()
  totalMembers: number;

  @ApiPropertyOptional()
  overdueTasksCount: number;
}