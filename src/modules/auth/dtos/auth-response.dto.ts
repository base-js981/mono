import { ApiProperty } from '@nestjs/swagger';

class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ type: [String], description: 'User roles' })
  roles: string[];
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}

