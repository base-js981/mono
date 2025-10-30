import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

export class CreatePolicyRuleDto {
  @ApiProperty({ 
    example: 'subject.department',
    description: 'The attribute path to evaluate (e.g., subject.department, resource.ownerId, environment.timeOfDay)'
  })
  @IsString()
  @IsNotEmpty()
  attribute: string;

  @ApiProperty({ 
    example: 'equals',
    enum: ['equals', 'not_equals', 'greater', 'less', 'in', 'contains'],
    description: 'Comparison operator for the attribute'
  })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ 
    example: 'IT',
    description: 'The value to compare against (can be string, number, array, or object)'
  })
  @IsNotEmpty()
  value: any;

  @ApiPropertyOptional({ 
    example: 0,
    default: 0,
    description: 'Order of evaluation (lower numbers are evaluated first)'
  })
  @IsOptional()
  order?: number;
}

export class CreatePolicyDto {
  @ApiProperty({ 
    example: 'IT Department Read Only',
    description: 'Unique name for the policy'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ 
    example: 'Allow users from IT department to read data during business hours',
    description: 'Description of what this policy does'
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    enum: PolicyEffect, 
    example: PolicyEffect.ALLOW,
    description: 'Whether to allow or deny access when conditions are met'
  })
  @IsEnum(PolicyEffect)
  @IsNotEmpty()
  effect: PolicyEffect;

  @ApiPropertyOptional({ 
    default: true,
    example: true,
    description: 'Whether this policy is currently enabled'
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    type: [CreatePolicyRuleDto],
    isArray: true,
    example: [
      {
        attribute: 'subject.department',
        operator: 'equals',
        value: 'IT',
        order: 0
      },
      {
        attribute: 'subject.role',
        operator: 'in',
        value: ['manager', 'supervisor'],
        order: 1
      },
      {
        attribute: 'resource.sensitivity',
        operator: 'less',
        value: 3,
        order: 2
      },
      {
        attribute: 'environment.timeOfDay',
        operator: 'greater',
        value: '09:00',
        order: 3
      }
    ],
    description: 'Array of rules that must all pass for the policy to apply'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePolicyRuleDto)
  @IsOptional()
  rules?: CreatePolicyRuleDto[];
}

