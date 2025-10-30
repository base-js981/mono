import { SetMetadata } from '@nestjs/common';
import { ResourceLoaderOptions } from '../types/decorator.types';

export const RESOURCE_KEY = 'resource_loader';

/**
 * Decorator để tự động load resource từ database
 * 
 * @example
 * @Resource({ paramName: 'id', method: 'findById' })
 * @Get(':id')
 * async getDocument(@Param('id') id: string, @ResourceData() data: any) {
 *   // data.resource đã được load sẵn
 * }
 */
export const Resource = (options: ResourceLoaderOptions) =>
  SetMetadata(RESOURCE_KEY, options);

