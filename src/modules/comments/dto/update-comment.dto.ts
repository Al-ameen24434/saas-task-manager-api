import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated: I reviewed the latest changes.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}