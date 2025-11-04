import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { CreatePolicyDto } from './dtos/create-policy.dto';
import { Policy, PolicyCondition } from '../abac/types/policy.types';

@Injectable()
export class PoliciesService {
  private cache: Map<string, { policies: Policy[]; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute

  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.policy.findMany({
      include: {
        rules: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async create(createPolicyDto: CreatePolicyDto, rules: any[], tenantId?: string | null) {
    const existing = await this.prisma.policy.findFirst({
      where: {
        name: createPolicyDto.name,
        tenantId: tenantId || null,
      },
    });

    if (existing) {
      throw new ConflictException('Policy with this name already exists');
    }

    const policy = await this.prisma.policy.create({
      data: {
        ...createPolicyDto,
        rules: {
          create: rules,
        },
      },
      include: {
        rules: true,
      },
    });

    await this.invalidateCache();
    return policy;
  }

  async update(id: string, data: any) {
    const policy = await this.findOne(id);

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async delete(id: string) {
    const policy = await this.findOne(id);

    await this.prisma.policy.delete({
      where: { id },
    });

    await this.invalidateCache();
    return { message: 'Policy deleted successfully' };
  }

  async loadEnabledPolicies(): Promise<Policy[]> {
    const cacheKey = 'enabled_policies';

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.policies;
    }

    // Load from database
    const policies = await this.prisma.policy.findMany({
      where: { enabled: true },
      include: {
        rules: {
          orderBy: { order: 'asc' },
        },
      },
    });

    // Convert to Policy type
    const convertedPolicies: Policy[] = policies.map(policy => ({
      id: policy.id,
      name: policy.name,
      description: policy.description || undefined,
      effect: policy.effect as 'allow' | 'deny',
      conditions: policy.rules.map(rule => ({
        attribute: rule.attribute,
        operator: rule.operator as any,
        value: rule.value as any,
      })),
    }));

    // Update cache
    this.cache.set(cacheKey, {
      policies: convertedPolicies,
      timestamp: Date.now(),
    });

    return convertedPolicies;
  }

  async invalidateCache() {
    this.cache.clear();
  }
}

