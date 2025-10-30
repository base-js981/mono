export interface AbacPolicyRule {
  type: 'owner' | 'department' | 'tenant' | 'time' | 'custom';
  config?: any;
}

export interface ResourceLoaderOptions {
  paramName?: string;
  method?: 'findById' | 'findByOwnerId';
}

