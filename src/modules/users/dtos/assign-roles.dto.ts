import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRolesDto {
  @ApiProperty({
    description: 'Role IDs to assign',
    example: ['role-id-1', 'role-id-2'],
  })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}

