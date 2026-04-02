import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';


export class BulkUpdateTasksDto {
  @ApiProperty({
    type: [String],
    description: 'IDs of tasks to update (max 50)',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  taskIds: string[];

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}