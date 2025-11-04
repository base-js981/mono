import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  Request,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ListFilesDto } from './dtos/list-files.dto';

@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Permissions('file.upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadFile(@UploadedFile() file: Express.Multer.File, @GetUser() user: any, @Request() req: any) {
    return this.filesService.uploadFile(file, user.id, req.tenant);
  }

  @Post('upload/multiple')
  @Permissions('file.upload')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid files' })
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[], @GetUser() user: any, @Request() req: any) {
    return this.filesService.uploadMultipleFiles(files, user.id, req.tenant);
  }

  @Get()
  @Permissions('file.read')
  @ApiOperation({ summary: 'List all files with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'uploadedBy', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of files' })
  async findAll(@Query() dto: ListFilesDto, @Request() req: any) {
    return this.filesService.findAll(dto, req.tenant);
  }

  @Get(':id')
  @Permissions('file.read')
  @ApiOperation({ summary: 'Get file metadata by ID' })
  @ApiResponse({ status: 200, description: 'File metadata' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.filesService.findOne(id, req.tenant);
  }

  @Get(':id/download')
  @Permissions('file.download')
  @ApiOperation({ summary: 'Download file by ID' })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(@Param('id') id: string, @Res() res: Response, @Request() req: any) {
    const { stream, filename, mimeType } = await this.filesService.downloadFile(id, req.tenant);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    stream.pipe(res);
  }

  @Get(':id/url')
  @Permissions('file.read')
  @ApiOperation({ summary: 'Get file download URL (presigned for S3)' })
  @ApiResponse({ status: 200, description: 'File URL' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileUrl(@Param('id') id: string, @Request() req: any) {
    const url = await this.filesService.getFileUrl(id, req.tenant);
    return { url };
  }

  @Delete(':id')
  @Permissions('file.delete')
  @ApiOperation({ summary: 'Delete file (soft delete)' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('id') id: string, @GetUser() user: any, @Request() req: any) {
    await this.filesService.deleteFile(id, user.id, req.tenant);
    return { message: 'File deleted successfully' };
  }
}

