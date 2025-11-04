# Database & Prisma

## Tổng quan

Dự án sử dụng **PostgreSQL** làm database chính và **Prisma** làm ORM và migration tool.

## Prisma Setup

### Schema Location

```prisma
prisma/
├── schema.prisma       # Database schema definition
├── migrations/         # Migration files
└── seed.ts            # Seed data script
```

### Schema Configuration

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Database Models

### Core Models

#### User
```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  password        String
  emailVerified   Boolean   @default(false)
  tenantId        String?
  department      String?
  clearanceLevel  Int?      @default(1)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  
  tenant          Tenant?   @relation(fields: [tenantId], references: [id])
  userRoles       UserRole[]
  
  @@index([tenantId])
  @@map("users")
}
```

#### Tenant
```prisma
model Tenant {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  domain      String?   @unique
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  users       User[]
  categories  Category[]
  
  @@index([slug])
  @@map("tenants")
}
```

#### Role & Permission
```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  
  rolePermissions RolePermission[]
  userRoles       UserRole[]
  
  @@map("roles")
}

model Permission {
  id          String   @id @default(cuid())
  name        String   @unique
  resource    String
  action      String
  createdAt   DateTime @default(now())
  
  rolePermissions RolePermission[]
  
  @@map("permissions")
}
```

#### Policy (ABAC)
```prisma
model Policy {
  id          String   @id @default(cuid())
  name        String
  description String?
  conditions  Json     // ABAC policy conditions
  createdAt   DateTime @default(now())
  
  userPolicies UserPolicy[]
  
  @@map("policies")
}
```

### Relations

- **User ↔ Tenant**: Many-to-one
- **User ↔ Role**: Many-to-many (via UserRole)
- **Role ↔ Permission**: Many-to-many (via RolePermission)
- **User ↔ Policy**: Many-to-many (via UserPolicy)

## Prisma Client Usage

### PrismaService

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

### Basic Queries

```typescript
// Find one
const user = await prisma.user.findUnique({
  where: { id: 'user-1' },
});

// Find many
const users = await prisma.user.findMany({
  where: { deletedAt: null },
  include: { userRoles: { include: { role: true } } },
});

// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    password: 'hashed',
    name: 'John Doe',
  },
});

// Update
const user = await prisma.user.update({
  where: { id: 'user-1' },
  data: { name: 'Updated Name' },
});

// Delete (soft delete)
const user = await prisma.user.update({
  where: { id: 'user-1' },
  data: { deletedAt: new Date() },
});
```

### Advanced Queries

#### Include Relations

```typescript
const user = await prisma.user.findUnique({
  where: { id: 'user-1' },
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    },
  },
});
```

#### Filtering

```typescript
const users = await prisma.user.findMany({
  where: {
    email: { contains: '@example.com' },
    deletedAt: null,
    tenantId: 'tenant-1',
    OR: [
      { name: { startsWith: 'John' } },
      { name: { startsWith: 'Jane' } },
    ],
  },
});
```

#### Pagination

```typescript
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

#### Aggregations

```typescript
const count = await prisma.user.count({
  where: { tenantId: 'tenant-1' },
});

const stats = await prisma.user.aggregate({
  _count: true,
  _avg: { clearanceLevel: true },
  _max: { createdAt: true },
});
```

### Transactions

```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: 'user@example.com' },
  });
  
  await tx.userRole.create({
    data: {
      userId: user.id,
      roleId: 'role-1',
    },
  });
  
  return user;
});
```

## Migrations

### Create Migration

```bash
pnpm prisma:migrate:dev --name add_new_field
```

Tạo migration file trong `prisma/migrations/` và apply lên database.

### Apply Migrations (Production)

```bash
pnpm prisma:migrate deploy
```

Apply pending migrations without creating new ones.

### Reset Database

```bash
pnpm prisma:migrate reset
```

⚠️ **Warning**: Deletes all data và recreates database.

### Migration Best Practices

1. **One migration per logical change**
2. **Name migrations descriptively**
3. **Test migrations** before deploying
4. **Never edit applied migrations**
5. **Review generated SQL** before applying

## Seeding

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator',
    },
  });
  
  // Create permissions
  const permissions = await Promise.all([
    prisma.permission.upsert({
      where: { name: 'user.read' },
      update: {},
      create: {
        name: 'user.read',
        resource: 'user',
        action: 'read',
      },
    }),
    // ... more permissions
  ]);
  
  // Assign permissions to roles
  await prisma.rolePermission.createMany({
    data: permissions.map(p => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Run Seed

```bash
pnpm prisma:seed
```

### Seed Best Practices

1. **Idempotent**: Use `upsert` thay vì `create`
2. **Deterministic**: Same seed produces same data
3. **Development only**: Không seed production data
4. **Reset first**: Run `migrate reset` before seeding

## Indexing

### Single Column Index

```prisma
model User {
  email String @unique  // Automatic index
  
  @@index([tenantId])
}
```

### Composite Index

```prisma
model Category {
  tenantId String?
  isActive Boolean
  
  @@index([tenantId, isActive])
  @@index([tenantId, sortOrder])
}
```

### Index Best Practices

1. **Index foreign keys**: `tenantId`, `parentId`, etc.
2. **Index frequently queried columns**
3. **Composite indexes** cho multi-column queries
4. **Avoid over-indexing**: Performance vs storage trade-off

## Soft Deletes

### Pattern

```prisma
model User {
  deletedAt DateTime?
  
  // Query only active records
  // WHERE deletedAt IS NULL
}
```

### Usage

```typescript
// Soft delete
await prisma.user.update({
  where: { id: 'user-1' },
  data: { deletedAt: new Date() },
});

// Find excluding deleted
const users = await prisma.user.findMany({
  where: { deletedAt: null },
});
```

## Performance Optimization

### Connection Pooling

Prisma tự động manage connection pooling. Configure trong `DATABASE_URL`:

```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

### Query Optimization

1. **Use `select`** thay vì `include` khi chỉ cần một vài fields
2. **Batch queries** thay vì N+1 queries
3. **Use indexes** effectively
4. **Paginate** large datasets

### Example: Avoid N+1

```typescript
// ❌ Bad: N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const roles = await prisma.userRole.findMany({
    where: { userId: user.id },
  });
}

// ✅ Good: Single query với include
const users = await prisma.user.findMany({
  include: { userRoles: { include: { role: true } } },
});
```

## Prisma Studio

### Launch

```bash
pnpm prisma:studio
```

Access tại http://localhost:5555

### Features

- Browse database tables
- View và edit data
- Execute queries
- Visualize relations

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/base_nodejs?schema=public
```

### Production

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public&sslmode=require
```

## Backup & Restore

### Backup

```bash
pg_dump -h localhost -U postgres -d base_nodejs > backup.sql
```

### Restore

```bash
psql -h localhost -U postgres -d base_nodejs < backup.sql
```

## Troubleshooting

### Common Issues

1. **Connection errors**
   - Check DATABASE_URL
   - Verify PostgreSQL running
   - Check network connectivity

2. **Migration conflicts**
   - Resolve conflicts manually
   - Test migrations locally first

3. **Performance issues**
   - Review query plans
   - Check indexes
   - Optimize N+1 queries

4. **Type errors**
   - Run `pnpm prisma:generate` after schema changes
   - Restart TypeScript server

## References

- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Xem schema tại `prisma/schema.prisma`
- Xem migrations tại `prisma/migrations/`

