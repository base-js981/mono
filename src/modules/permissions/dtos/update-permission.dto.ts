import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePermissionDto {
  @ApiPropertyOptional({ description: 'Permission description' })
  @IsString()
  @IsOptional()
  description?: string;
}

