# Architecture Overview

## Tổng quan

Dự án này là một NestJS application được thiết kế với kiến trúc modular, hỗ trợ multi-tenancy, RBAC/ABAC authorization, và các tính năng enterprise-grade.

## Tech Stack

### Core Framework
- **NestJS** (v11): Progressive Node.js framework
- **TypeScript** (v5.7): Type-safe JavaScript
- **Express**: HTTP server framework

### Database & ORM
- **PostgreSQL** (v16): Primary database
- **Prisma** (v6.18): ORM và migration tool

### Caching & Queue
- **Redis** (v7): Caching và message broker
- **Bull** (v4.16): Job queue cho background tasks

### Observability & Monitoring
- **OpenTelemetry**: Distributed tracing
- **Jaeger**: Trace visualization và analysis

### Authentication & Authorization
- **JWT**: Token-based authentication
- **Passport**: Authentication middleware
- **RBAC**: Role-Based Access Control
- **ABAC**: Attribute-Based Access Control

### File Storage
- **AWS S3**: Object storage (production)
- **Local Storage**: File storage (development)

### Email
- **Nodemailer**: Email sending
- **Bull Queue**: Async email processing

### API Documentation
- **Swagger/OpenAPI**: API documentation tự động

## Kiến trúc Module

### Module Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── instrumentation.ts         # OpenTelemetry setup
├── modules/                   # Feature modules
│   ├── auth/                 # Authentication
│   ├── users/                # User management
│   ├── roles/                 # Role management
│   ├── permissions/           # Permission management
│   ├── policies/             # ABAC policies
│   ├── abac/                  # ABAC guard & engine
│   ├── tenants/               # Tenant management
│   ├── audit/                 # Audit logging
│   ├── files/                 # File upload/download
│   ├── categories/             # Category management
│   └── email/                 # Email service
└── shared/                    # Shared utilities
    ├── prisma/                # Prisma module
    └── tenant/                # Multi-tenancy utilities
```

### Core Principles

#### 1. Modular Architecture
- Mỗi feature được tổ chức thành module độc lập
- Modules có thể được lazy-loaded nếu cần
- Dependencies được inject thông qua DI container

#### 2. Separation of Concerns
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic
- **DTOs**: Data validation và transformation
- **Guards**: Authorization logic
- **Interceptors**: Cross-cutting concerns (logging, transformation)

#### 3. Multi-Tenancy Support
- Tenant context được inject tự động qua interceptor
- Data isolation theo tenant
- Tenant-aware services extend `TenantAwareService`

#### 4. Layered Security
- **Authentication**: JWT-based với refresh tokens
- **Authorization**: RBAC (roles/permissions) + ABAC (attribute-based)
- **Input Validation**: Class-validator với DTOs
- **Audit Logging**: Tự động log các operations

## Request Flow

```
Client Request
    ↓
Global Pipes (Validation)
    ↓
TenantContextInterceptor (Extract tenant)
    ↓
Guards (Authentication & Authorization)
    ↓
Controller (Route handler)
    ↓
Service (Business logic)
    ↓
PrismaService (Database access)
    ↓
Database (PostgreSQL)
    ↓
Response
    ↓
AuditInterceptor (Log operation)
```

## Design Patterns

### 1. Dependency Injection
NestJS sử dụng DI container để quản lý dependencies:

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}
}
```

### 2. Repository Pattern (via Prisma)
Prisma Client đóng vai trò như repository pattern, cung cấp type-safe database access.

### 3. Strategy Pattern
- ABAC policy engine sử dụng strategy pattern cho việc evaluate policies
- Different storage strategies (S3, local) cho file storage

### 4. Interceptor Pattern
- **TenantContextInterceptor**: Tự động extract tenant từ request
- **AuditInterceptor**: Tự động log operations

### 5. Guard Pattern
- **JwtAuthGuard**: Verify JWT tokens
- **RolesGuard**: Check user roles
- **AbacGuard**: Evaluate ABAC policies

## Shared Services

### TenantAwareService
Base service class cho các services cần multi-tenancy:

```typescript
export class CategoriesService extends TenantAwareService {
  // Automatically filters by tenant
  async findAll(tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    return this.prisma.category.findMany({
      where: { ...tenantWhere },
    });
  }
}
```

### PrismaService
Singleton Prisma Client với lifecycle hooks:

```typescript
@Injectable()
export class PrismaService extends PrismaClient 
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

## Configuration Management

Sử dụng `@nestjs/config` với environment variables:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
})
```

Environment variables được load từ `.env` file và được validate ở runtime.

## Error Handling

- **Global Exception Filter**: Standardize error responses
- **HTTP Exceptions**: Use NestJS built-in exceptions (NotFoundException, ConflictException, etc.)
- **Custom Exceptions**: Domain-specific exceptions khi cần

## Testing Strategy

- **Unit Tests**: Test individual services với mocked dependencies
- **E2E Tests**: Test complete request flows
- **Integration Tests**: Test với real database (test database)

## Scalability Considerations

1. **Database**: Connection pooling với Prisma
2. **Caching**: Redis cho caching strategies
3. **Queue**: Bull queue cho background jobs
4. **Horizontal Scaling**: Stateless application, có thể scale horizontally
5. **Multi-tenancy**: Data isolation cho phép multi-tenant deployment

## Next Steps

- Xem [RBAC & ABAC](./02-rbac-abac.md) để hiểu authorization system
- Xem [Multi-Tenancy](./03-multi-tenancy.md) để hiểu tenant isolation
- Xem [Tools](./05-tools.md) để hiểu các công cụ hỗ trợ

