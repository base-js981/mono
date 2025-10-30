import { SetMetadata } from '@nestjs/common';
import { AbacPolicyRule } from '../types/decorator.types';

export const ABAC_POLICIES_KEY = 'abac_policies';

/**
 * Decorator để define ABAC policies cho endpoint
 * 
 * @example
 * @AbacPolicies([
 *   { type: 'owner' }, // Chỉ owner được access
 *   { type: 'department', config: { sameDepartment: true } }
 * ])
 * @Put(':id')
 */
export const AbacPolicies = (rules: AbacPolicyRule[]) =>
  SetMetadata(ABAC_POLICIES_KEY, rules);

/**
 * Helper decorators
 */
export const RequireOwner = () => AbacPolicies([{ type: 'owner' }]);
export const RequireSameDepartment = () =>
  AbacPolicies([{ type: 'department', config: { sameDepartment: true } }]);
export const RequireSameTenant = () =>
  AbacPolicies([{ type: 'tenant' }]);

