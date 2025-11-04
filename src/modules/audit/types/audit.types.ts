export interface AuditRecordInput {
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  tenantId?: string;
  status: 'success' | 'fail';
  method?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  payload?: unknown;
  errorMessage?: string;
}

export interface AuditMetaOptions {
  action?: string;
  resource?: string;
}

