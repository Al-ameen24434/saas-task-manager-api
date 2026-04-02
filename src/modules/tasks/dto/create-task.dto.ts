import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login page' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    example: 'Build the login form with email/password validation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus = TaskStatus.TODO;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({
    example: '2024-03-15',
    description: 'Due date in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Position within the status column for ordering',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number = 0;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of user UUIDs to assign to this task',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}