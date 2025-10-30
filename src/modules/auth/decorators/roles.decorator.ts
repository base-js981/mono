import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY, PERMISSIONS_KEY } from '../guards/roles.guard';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

