import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ required: false, description: 'Optional custom filename' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}

