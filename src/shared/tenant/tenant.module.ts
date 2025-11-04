import { Module, Global } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { PrismaModule } from '../prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [TenantResolverService, TenantContextInterceptor],
  exports: [TenantResolverService, TenantContextInterceptor],
})
export class TenantModule {}

