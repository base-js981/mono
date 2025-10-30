import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ description: 'Role name', example: 'MODERATOR' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Role description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AssignPermissionDto {
  @ApiProperty({ description: 'Permission names', example: ['user.create', 'user.update'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissions: string[];
}

