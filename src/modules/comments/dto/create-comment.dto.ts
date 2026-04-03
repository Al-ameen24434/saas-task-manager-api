import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 'Looking good! I left some inline feedback on the design file.',
    description: 'Comment content (supports plain text)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}