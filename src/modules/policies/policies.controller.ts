import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dtos/create-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Policies')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Create a new policy',
    description: 'Creates a new ABAC policy with rules. All rules must pass for the policy effect to apply.'
  })
  @ApiBody({
    type: CreatePolicyDto,
    examples: {
      example1: {
        summary: 'IT Department Policy',
        description: 'Allow IT department managers to access resources',
        value: {
          name: 'IT Department Access',
          description: 'Allow managers from IT department to access company resources',
          effect: 'allow',
          enabled: true,
          rules: [
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
            }
          ]
        }
      },
      example4: {
        summary: 'Comprehensive Access Control',
        description: 'Allow Finance users to read their own resources during business hours',
        value: {
          name: 'Finance Self-Read (Business Hours)',
          description: 'Allow Finance users to read resources they own between 08:00 and 18:00',
          effect: 'allow',
          enabled: true,
          rules: [
            {
              attribute: 'subject.department',
              operator: 'equals',
              value: 'Finance',
              order: 0
            },
            {
              attribute: 'action',
              operator: 'equals',
              value: 'read',
              order: 1
            },
            {
              attribute: 'resource.ownerId',
              operator: 'equals',
              value: { '$ref': 'subject.id' },
              order: 2
            },
            {
              attribute: 'environment.timeOfDay',
              operator: 'greater',
              value: '08:00',
              order: 3
            },
            {
              attribute: 'environment.timeOfDay',
              operator: 'less',
              value: '18:00',
              order: 4
            }
          ]
        }
      },
      example2: {
        summary: 'High Security Access',
        description: 'Deny access to high-security resources outside business hours',
        value: {
          name: 'High Security Hours Restriction',
          description: 'Deny access to high sensitivity resources outside business hours',
          effect: 'deny',
          enabled: true,
          rules: [
            {
              attribute: 'resource.sensitivity',
              operator: 'greater',
              value: 4,
              order: 0
            },
            {
              attribute: 'environment.timeOfDay',
              operator: 'less',
              value: '08:00',
              order: 1
            }
          ]
        }
      },
      example3: {
        summary: 'Multi-tenant Policy',
        description: 'Allow users to access only their own tenant data',
        value: {
          name: 'Tenant Isolation',
          description: 'Ensure users can only access resources from their own tenant',
          effect: 'allow',
          enabled: true,
          rules: [
            {
              attribute: 'subject.tenantId',
              operator: 'equals',
              value: { '$ref': 'resource.tenantId' },
              order: 0
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Policy created successfully',
    example: {
      id: 'clx1234567890',
      name: 'IT Department Access',
      description: 'Allow managers from IT department to access company resources',
      effect: 'allow',
      enabled: true,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
      rules: [
        {
          id: 'clx1234567891',
          policyId: 'clx1234567890',
          attribute: 'subject.department',
          operator: 'equals',
          value: 'IT',
          order: 0
        },
        {
          id: 'clx1234567892',
          policyId: 'clx1234567890',
          attribute: 'subject.role',
          operator: 'in',
          value: ['manager', 'supervisor'],
          order: 1
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Policy name already exists',
    example: {
      statusCode: 409,
      message: 'Policy with this name already exists',
      error: 'Conflict'
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
    example: {
      statusCode: 400,
      message: ['name should not be empty', 'effect must be one of the following values: allow, deny'],
      error: 'Bad Request'
    }
  })
  async create(@Body() createPolicyDto: CreatePolicyDto) {
    return this.policiesService.create(createPolicyDto, createPolicyDto.rules || []);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all policies' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all policies with their rules',
    example: [
      {
        id: 'clx1234567890',
        name: 'IT Department Access',
        description: 'Allow managers from IT department to access company resources',
        effect: 'allow',
        enabled: true,
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
        rules: [
          {
            id: 'clx1234567891',
            policyId: 'clx1234567890',
            attribute: 'subject.department',
            operator: 'equals',
            value: 'IT',
            order: 0
          }
        ]
      }
    ]
  })
  findAll() {
    return this.policiesService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Policy details with all rules',
    example: {
      id: 'clx1234567890',
      name: 'IT Department Access',
      description: 'Allow managers from IT department to access company resources',
      effect: 'allow',
      enabled: true,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
      rules: [
        {
          id: 'clx1234567891',
          policyId: 'clx1234567890',
          attribute: 'subject.department',
          operator: 'equals',
          value: 'IT',
          order: 0
        },
        {
          id: 'clx1234567892',
          policyId: 'clx1234567890',
          attribute: 'subject.role',
          operator: 'in',
          value: ['manager', 'supervisor'],
          order: 1
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Policy not found',
    example: {
      statusCode: 404,
      message: 'Policy not found',
      error: 'Not Found'
    }
  })
  findOne(@Param('id') id: string) {
    return this.policiesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Update policy',
    description: 'Update policy name, description, effect, or enabled status. Rules are not updated through this endpoint.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Policy Name' },
        description: { type: 'string', example: 'Updated description' },
        effect: { type: 'string', enum: ['allow', 'deny'], example: 'allow' },
        enabled: { type: 'boolean', example: true }
      }
    },
    examples: {
      example1: {
        summary: 'Update policy name',
        value: {
          name: 'New Policy Name'
        }
      },
      example2: {
        summary: 'Disable policy',
        value: {
          enabled: false
        }
      },
      example3: {
        summary: 'Change effect',
        value: {
          effect: 'deny'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Policy updated successfully',
    example: {
      id: 'clx1234567890',
      name: 'Updated Policy Name',
      description: 'Updated description',
      effect: 'allow',
      enabled: true,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T11:45:00.000Z',
      rules: []
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Policy not found',
    example: {
      statusCode: 404,
      message: 'Policy not found',
      error: 'Not Found'
    }
  })
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.policiesService.update(id, updateData);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete policy' })
  @ApiResponse({ 
    status: 200, 
    description: 'Policy deleted successfully',
    example: {
      message: 'Policy deleted successfully'
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Policy not found',
    example: {
      statusCode: 404,
      message: 'Policy not found',
      error: 'Not Found'
    }
  })
  delete(@Param('id') id: string) {
    return this.policiesService.delete(id);
  }

  @Post(':id/reload')
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Reload policy cache',
    description: 'Invalidate and reload the policy cache. Useful after updating policies to ensure changes take effect immediately.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache reloaded successfully',
    example: {
      message: 'Policy cache reloaded'
    }
  })
  async reloadCache() {
    await this.policiesService.invalidateCache();
    return { message: 'Policy cache reloaded' };
  }
}

