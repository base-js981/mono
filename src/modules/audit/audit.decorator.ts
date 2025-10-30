import { SetMetadata } from '@nestjs/common';
import { AuditMetaOptions } from './types/audit.types';

export const AUDIT_META_KEY = 'audit_meta';
export const AuditMeta = (options: AuditMetaOptions) => SetMetadata(AUDIT_META_KEY, options);


