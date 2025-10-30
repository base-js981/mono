import { SetMetadata } from '@nestjs/common';

export const ABAC_PERMISSION_KEY = 'abac_permission';

/**
 * Decorator để specify permission cần check
 * 
 * @example
 * @RequirePermission('user.update')
 * @Put(':id')
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(ABAC_PERMISSION_KEY, permission);

