import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Permissions } from '../auth/decorators/roles.decorator';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 409, description: 'Category with this slug already exists' })
  create(@Body() createCategoryDto: CreateCategoryDto, @Request() req: any) {
    return this.categoriesService.create(createCategoryDto, req.tenant);
  }

  @Get()
  @Permissions('category.read')
  @ApiOperation({ summary: 'Get all categories' })
  @ApiQuery({ name: 'includeDeleted', required: false, type: Boolean, description: 'Include deleted categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  findAll(@Query('includeDeleted') includeDeleted?: string, @Request() req?: any) {
    const include = includeDeleted === 'true';
    return this.categoriesService.findAll(include, req?.tenant);
  }

  @Get(':id')
  @Permissions('category.read')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(@Param('id') id: string, @Request() req?: any) {
    return this.categoriesService.findOne(id, req?.tenant);
  }

  @Get('slug/:slug')
  @Permissions('category.read')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findBySlug(@Param('slug') slug: string, @Request() req?: any) {
    return this.categoriesService.findBySlug(slug, req?.tenant);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category with this slug already exists' })
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto, @Request() req: any) {
    return this.categoriesService.update(id, updateCategoryDto, req.tenant);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete category (soft delete)' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete category with children' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.categoriesService.remove(id, req.tenant);
  }
}

