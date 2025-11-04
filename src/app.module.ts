import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './shared/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { UsersModule } from './modules/users/users.module';
import { AbacModule } from './modules/abac/abac.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { AuditModule } from './modules/audit/audit.module';
import { FilesModule } from './modules/files/files.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenantModule } from './shared/tenant/tenant.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { TenantContextInterceptor } from './shared/tenant/tenant-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    PoliciesModule,
    AbacModule,
    AuditModule,
    FilesModule,
    CategoriesModule,
    TenantsModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
