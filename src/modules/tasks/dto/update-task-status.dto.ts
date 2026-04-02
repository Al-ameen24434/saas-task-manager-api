import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
    description: 'New status for the task',
  })
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  status: TaskStatus;
}