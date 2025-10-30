import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import {
  Policy,
  PolicyContext,
  PolicyCondition,
  PolicyDecision,
} from './types/policy.types';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class PolicyEngine implements OnModuleInit {
  private policies: Policy[] = [];

  constructor(
    @Inject(forwardRef(() => PoliciesService))
    private policiesService: PoliciesService,
  ) {}

  async onModuleInit() {
    await this.loadPolicies();
  }

  async loadPolicies() {
    try {
      // Try to load from database
      const dbPolicies = await this.policiesService.loadEnabledPolicies();
      if (dbPolicies && dbPolicies.length > 0) {
        this.policies = dbPolicies;
        console.log(`✅ Loaded ${dbPolicies.length} policies from database`);
        return;
      }
    } catch (error) {
      console.warn('⚠️  Could not load policies from DB, using defaults:', error.message);
    }

    // Fallback to default policies
    this.loadDefaultPolicies();
    console.log('✅ Using default in-memory policies');
  }

  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    for (const policy of this.policies) {
      const matches = this.checkConditions(policy, context);

      if (matches) {
        return {
          effect: policy.effect,
          reason: policy.name,
        };
      }
    }

    // Default deny
    return { effect: 'deny', reason: 'No policy matched' };
  }

  private checkConditions(policy: Policy, context: PolicyContext): boolean {
    for (const condition of policy.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(
    condition: PolicyCondition,
    context: PolicyContext,
  ): boolean {
    const { attribute, operator, value } = condition;
    const [contextType, attr] = attribute.split('.');

    let actualValue: any;

    switch (contextType) {
      case 'subject':
        actualValue = context.subject[attr] ?? context.subject[attr];
        break;
      case 'resource':
        actualValue = context.resource?.[attr];
        break;
      case 'environment':
        actualValue = context.environment[attr];
        break;
      case 'action':
        actualValue = context.action;
        break;
      default:
        return false;
    }

    const expectedValue = this.resolveRef(value, context);
    return this.compare(actualValue, operator, expectedValue);
  }

  private compare(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater':
        return actual > expected;
      case 'less':
        return actual < expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'contains':
        return String(actual).includes(String(expected));
      default:
        return false;
    }
  }

  private resolveRef(value: any, context: PolicyContext): any {
    if (value && typeof value === 'object' && '$ref' in value) {
      const ref: string = (value as any)['$ref'];
      const [ctx, attr] = ref.split('.');
      if (ctx === 'subject') return (context.subject as any)[attr];
      if (ctx === 'resource') return (context.resource as any)?.[attr];
      if (ctx === 'environment') return (context.environment as any)[attr];
      if (ctx === 'action') return context.action;
      return undefined;
    }
    return value;
  }

  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  private loadDefaultPolicies(): void {
    // No in-code default policies. Policies should be seeded and managed via database.
    this.policies = [];
  }
}

