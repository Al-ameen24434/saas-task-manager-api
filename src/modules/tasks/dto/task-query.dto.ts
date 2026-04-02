import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SortOrder } from '@common/dto/pagination.dto';

export enum TaskSortBy {
  TITLE = 'title',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DUE_DATE = 'dueDate',
  PRIORITY = 'priority',
  STATUS = 'status',
  POSITION = 'position',
}

export class TaskQueryDto {
  // ── Pagination ──────────────────────────────────────────────────────────
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // ── Filtering ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    enum: TaskStatus,
    isArray: true,
    description: 'Filter by one or more statuses',
    example: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  // Transform comma-separated string to array: ?status=TODO,IN_PROGRESS
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : value.split(','),
  )
  status?: TaskStatus[];

  @ApiPropertyOptional({
    enum: TaskPriority,
    isArray: true,
    description: 'Filter by one or more priorities',
    example: [TaskPriority.HIGH, TaskPriority.URGENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskPriority, { each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : value.split(','),
  )
  priority?: TaskPriority[];

  @ApiPropertyOptional({
    description: 'Filter by assigned user ID',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by creator user ID',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;

  @ApiPropertyOptional({
    description: 'Search task title or description',
    example: 'login',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks due before this date (ISO 8601)',
    example: '2024-03-31',
  })
  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks due after this date (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter only overdue tasks (dueDate in the past, not done/cancelled)',
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  overdue?: boolean;

  // ── Sorting ─────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ enum: TaskSortBy, default: TaskSortBy.POSITION })
  @IsOptional()
  @IsEnum(TaskSortBy)
  sortBy?: TaskSortBy = TaskSortBy.POSITION;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }
}