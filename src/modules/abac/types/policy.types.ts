export interface PolicyDecision {
  effect: 'allow' | 'deny';
  reason?: string;
}

export interface PolicyContext {
  subject: SubjectAttributes;
  resource?: ResourceAttributes;
  action: string;
  environment: EnvironmentAttributes;
}

export interface SubjectAttributes {
  id: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  department?: string;
  tenantId?: string;
  clearanceLevel?: number;
  [key: string]: any;
}

export interface ResourceAttributes {
  id?: string;
  ownerId?: string;
  department?: string;
  tenantId?: string;
  sensitivity?: string;
  status?: string;
  [key: string]: any;
}

export interface EnvironmentAttributes {
  timeOfDay?: string;
  date?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: any;
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
}

export interface PolicyCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'in' | 'contains';
  value: any;
}

