import {
  Controller,
  Get,
  Param,
  Delete,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AssignRolesDto } from './dtos/assign-roles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Permissions } from '../auth/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/roles')
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiResponse({ status: 200, description: 'User roles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserRoles(@Param('id') id: string) {
    return this.usersService.getUserRoles(id);
  }

  @Post(':id/roles')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign roles to user' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    return this.usersService.assignRoles(id, dto.roleIds);
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
  remove(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }
}

