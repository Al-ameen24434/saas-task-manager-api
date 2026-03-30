import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class TokensDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15min)' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived refresh token (7 days)' })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900, description: 'Seconds until access token expires' })
  expiresIn: number;
}

export class AuthResponseDto {
  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty()
  tokens: TokensDto;
}