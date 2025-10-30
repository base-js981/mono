import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Permission name', example: 'order.create' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Resource name', example: 'order' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ description: 'Action name', example: 'create' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ description: 'Permission description' })
  @IsString()
  @IsOptional()
  description?: string;
}

