import {
  Controller,
  Get,
  Param,
  Delete,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AssignRolesDto } from './dtos/assign-roles.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Permissions } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('user.create')
  @ApiOperation({ summary: 'Create user in current tenant' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.create(dto, req.tenant);
  }

  @Get()
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(@Request() req: any) {
    return this.usersService.findAll(req.tenant);
  }

  @Get(':id')
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.tenant);
  }

  @Get(':id/roles')
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiResponse({ status: 200, description: 'User roles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserRoles(@Param('id') id: string, @Request() req: any) {
    return this.usersService.getUserRoles(id, req.tenant);
  }

  @Post(':id/roles')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign roles to user' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto, @Request() req: any) {
    return this.usersService.assignRoles(id, dto.roleIds, req.tenant);
  }

  @Patch(':id')
  @Permissions('user.update')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    return this.usersService.update(id, dto, req.tenant);
  }

  @Delete(':id/roles/:roleId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.usersService.removeRole(id, roleId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.usersService.softDelete(id, req.tenant);
  }
}

