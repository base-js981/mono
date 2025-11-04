import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant slug', example: 'company-abc' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ description: 'Tenant name', example: 'Company ABC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Tenant domain (e.g., tenant1.example.com)' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: 'Is tenant active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Tenant-specific settings (JSON)' })
  @IsOptional()
  settings?: Record<string, any>;
}

