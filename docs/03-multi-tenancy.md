# Multi-Tenancy

## Tổng quan

Hệ thống hỗ trợ **multi-tenancy** cho phép một single application instance phục vụ nhiều tenants (organizations, clients) với data isolation hoàn toàn.

## Kiến trúc Multi-Tenancy

### Single Database, Multi-Tenant

Hệ thống sử dụng **shared database, shared schema** approach với `tenantId` column để phân biệt data của các tenants.

```
┌─────────────────────────────────────┐
│         Application Instance         │
├─────────────────────────────────────┤
│  Tenant Context Interceptor         │
│  (Extracts tenant from request)     │
├─────────────────────────────────────┤
│         Tenant-Aware Services       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     PostgreSQL Database              │
│  ┌───────────────────────────────┐  │
│  │  users (tenantId)             │  │
│  │  categories (tenantId)         │  │
│  │  files (tenantId)              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Tenant Resolution

### TenantContext Interceptor

Interceptor tự động extract tenant từ request:

```typescript
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    
    // Extract tenant từ header, subdomain, hoặc JWT token
    const tenant = await this.tenantResolver.resolve(request);
    
    request.tenant = tenant;
    return next.handle();
  }
}
```

### Tenant Sources

Tenant có thể được xác định từ:

1. **HTTP Header**: `X-Tenant-Id` hoặc `X-Tenant-Slug`
2. **JWT Token**: Tenant ID trong token payload
3. **Subdomain**: Extract từ `tenant1.example.com`
4. **Query Parameter**: `?tenant=tenant-1` (development only)

### TenantResolver Implementation

```typescript
@Injectable()
export class TenantResolverService {
  async resolve(request: Request): Promise<TenantContext | null> {
    // Priority order:
    // 1. Header
    // 2. JWT token
    // 3. Subdomain
    // 4. Query param
    
    const tenantId = 
      request.headers['x-tenant-id'] ||
      request.user?.tenantId ||
      this.extractFromSubdomain(request) ||
      request.query['tenant'];
      
    if (!tenantId) return null;
    
    return this.tenantService.findBySlugOrId(tenantId);
  }
}
```

## Tenant-Aware Services

### Base Class: TenantAwareService

Services extend `TenantAwareService` để có sẵn tenant utilities:

```typescript
export abstract class TenantAwareService {
  constructor(protected readonly prisma: PrismaService) {}
  
  protected getTenantId(tenant?: TenantContext): string | null {
    return tenant?.id || null;
  }
  
  protected buildTenantWhere(tenant?: TenantContext): Record<string, any> {
    const tenantId = this.getTenantId(tenant);
    return tenantId ? { tenantId } : {};
  }
}
```

### Usage Example

```typescript
@Injectable()
export class CategoriesService extends TenantAwareService {
  async findAll(tenant?: TenantContext) {
    const tenantWhere = this.buildTenantWhere(tenant);
    
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        ...tenantWhere, // Automatically filter by tenant
      },
    });
  }
  
  async create(dto: CreateCategoryDto, tenant?: TenantContext) {
    const tenantId = this.getTenantId(tenant);
    
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    
    return this.prisma.category.create({
      data: {
        ...dto,
        tenantId, // Assign to tenant
      },
    });
  }
}
```

## Controllers

### Inject Tenant Context

```typescript
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}
  
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@TenantContext() tenant: TenantContext) {
    // Tenant được inject tự động từ interceptor
    return this.service.findAll(tenant);
  }
}
```

### TenantContext Decorator

```typescript
export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
```

## Data Isolation

### Database Schema

Tất cả tenant-aware models có `tenantId` column:

```prisma
model Category {
  id        String   @id @default(cuid())
  name      String
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
}
```

### Automatic Filtering

Tenant-aware queries tự động filter:

```typescript
// Service automatically adds tenantId filter
const categories = await service.findAll(tenant);
// SQL: SELECT * FROM categories WHERE tenantId = 'tenant-1' AND deletedAt IS NULL

// Without tenant context, returns all (admin use case)
const allCategories = await service.findAll();
// SQL: SELECT * FROM categories WHERE deletedAt IS NULL
```

## Tenant Management

### Create Tenant

```typescript
POST /tenants
{
  "slug": "acme-corp",
  "name": "ACME Corporation",
  "domain": "acme.example.com",
  "isActive": true
}
```

### List Tenants

```typescript
GET /tenants
// Returns all tenants (admin only)
```

### Update Tenant

```typescript
PATCH /tenants/:id
{
  "name": "Updated Name",
  "isActive": false
}
```

## Security Considerations

### 1. Tenant Isolation Enforcement

- **Always filter by tenantId** trong queries
- **Validate tenant ownership** trước khi update/delete
- **Prevent cross-tenant access** ở service layer

### 2. Tenant Validation

```typescript
async findOne(id: string, tenant?: TenantContext) {
  const tenantWhere = this.buildTenantWhere(tenant);
  
  const category = await this.prisma.category.findFirst({
    where: {
      id,
      ...tenantWhere, // Ensure tenant isolation
      deletedAt: null,
    },
  });
  
  if (!category) {
    throw new NotFoundException('Category not found');
  }
  
  return category;
}
```

### 3. Admin Override

Một số operations có thể bypass tenant filter cho admin users:

```typescript
protected buildTenantWhere(tenant?: TenantContext, isAdmin = false): Record<string, any> {
  if (isAdmin) {
    return {}; // Admin can see all tenants
  }
  
  const tenantId = this.getTenantId(tenant);
  return tenantId ? { tenantId } : {};
}
```

## Migration Strategy

### Initial Setup

1. Add `tenantId` column to existing tables
2. Migrate existing data (assign to default tenant)
3. Create indexes on `tenantId`

### Migration Example

```sql
-- Add tenantId column
ALTER TABLE categories ADD COLUMN tenant_id TEXT;

-- Create default tenant
INSERT INTO tenants (id, slug, name) VALUES ('default-tenant', 'default', 'Default Tenant');

-- Assign existing data to default tenant
UPDATE categories SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;

-- Create index
CREATE INDEX idx_categories_tenant_id ON categories(tenant_id);
```

## Performance Optimization

### Database Indexes

Tất cả tenant-aware tables cần index trên `tenantId`:

```prisma
model Category {
  tenantId String?
  
  @@index([tenantId])
  @@index([tenantId, isActive]) // Composite index
}
```

### Query Optimization

- Use composite indexes cho common query patterns
- Limit queries với tenant filter để sử dụng index
- Paginate large tenant datasets

## Testing Multi-Tenancy

### Unit Tests

```typescript
describe('CategoriesService', () => {
  it('should filter by tenant', async () => {
    const tenant = { id: 'tenant-1' };
    const categories = await service.findAll(tenant);
    
    expect(categories.every(c => c.tenantId === 'tenant-1')).toBe(true);
  });
  
  it('should not allow cross-tenant access', async () => {
    const tenant1 = { id: 'tenant-1' };
    
    await expect(
      service.findOne('category-from-tenant-2', tenant1)
    ).rejects.toThrow(NotFoundException);
  });
});
```

## Best Practices

1. **Always pass tenant context** từ controllers đến services
2. **Never expose tenantId** trong responses (security)
3. **Validate tenant ownership** cho all mutations
4. **Use tenant-aware base service** cho consistency
5. **Index tenantId columns** for performance

## Troubleshooting

### Common Issues

1. **Data leakage between tenants**
   - Check `buildTenantWhere()` được gọi đúng
   - Verify tenant context được pass đúng
   - Review service implementations

2. **Performance issues**
   - Ensure indexes exist trên `tenantId`
   - Check query plans
   - Optimize composite indexes

3. **Missing tenant context**
   - Verify TenantContextInterceptor được registered
   - Check tenant resolution logic
   - Review request flow

## References

- Xem [Architecture](./01-architecture.md) để hiểu tổng quan
- Xem code tại `src/shared/tenant/`
- Xem tenant-aware services examples trong `src/modules/categories/` và `src/modules/users/`

