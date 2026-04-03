import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Looks great! Approved.' })
  content: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty({ description: 'Whether this comment has been edited' })
  isEdited: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => UserResponseDto })
  author: UserResponseDto;

  // Convenience flag for the frontend to show edit/delete controls
  @ApiPropertyOptional({
    description: 'True if the requesting user is the comment author',
  })
  isOwn?: boolean;
}