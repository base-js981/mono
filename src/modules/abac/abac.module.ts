import { Module, forwardRef } from '@nestjs/common';
import { PolicyEngine } from './policy-engine';
import { AbacGuard } from './abac.guard';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [forwardRef(() => PoliciesModule)],
  providers: [PolicyEngine, AbacGuard],
  exports: [PolicyEngine, AbacGuard],
})
export class AbacModule {}
