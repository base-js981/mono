# RBAC & ABAC Authorization

## Tổng quan

Hệ thống authorization sử dụng kết hợp **RBAC (Role-Based Access Control)** và **ABAC (Attribute-Based Access Control)** để cung cấp flexible và powerful access control.

## RBAC (Role-Based Access Control)

### Khái niệm

RBAC quản lý quyền truy cập dựa trên **Roles** và **Permissions**:

- **User**: Người dùng trong hệ thống
- **Role**: Tập hợp các quyền (ví dụ: Admin, Manager, User)
- **Permission**: Quyền cụ thể (ví dụ: `user.read`, `user.create`, `user.update`)

### Mô hình dữ liệu

```
User ──→ UserRole ──→ Role ──→ RolePermission ──→ Permission
```

- **User**: Có thể có nhiều roles
- **Role**: Có nhiều permissions
- **Permission**: Được định nghĩa với `resource` và `action` (ví dụ: `user:read`)

### Usage

#### 1. Tạo Permissions

```typescript
POST /permissions
{
  "name": "user.read",
  "resource": "user",
  "action": "read"
}
```

#### 2. Tạo Roles và assign Permissions

```typescript
POST /roles
{
  "name": "USER",
  "description": "Regular user",
  "permissionIds": ["perm-1", "perm-2"]
}
```

#### 3. Assign Roles cho Users

```typescript
POST /users/:userId/roles
{
  "roleIds": ["role-1", "role-2"]
}
```

#### 4. Protect Routes với RolesGuard

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  @Get()
  @Roles('ADMIN', 'USER_MANAGER')
  async findAll() {
    // Only users with ADMIN or USER_MANAGER role can access
  }
}
```

### RolesGuard Implementation

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const user = context.switchToHttp().getRequest().user;
    
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

## ABAC (Attribute-Based Access Control)

### Khái niệm

ABAC quản lý quyền truy cập dựa trên **Attributes** và **Policies**:

- **Subject Attributes**: Attributes của user (department, clearanceLevel, etc.)
- **Resource Attributes**: Attributes của resource được truy cập
- **Environment Attributes**: Context attributes (time, location, etc.)
- **Policy**: Rules định nghĩa điều kiện access dựa trên attributes

### ABAC Model

```
Policy ──→ Conditions ──→ Attributes Evaluation
```

Policies được định nghĩa dưới dạng JSON với conditions:

```json
{
  "subject": {
    "department": "IT",
    "clearanceLevel": { "$gte": 3 }
  },
  "resource": {
    "category": "sensitive"
  },
  "action": "read"
}
```

### Attributes trong hệ thống

#### User Attributes
- `department`: Phòng ban của user
- `clearanceLevel`: Mức độ clearance (1-5)
- `tenantId`: Tenant mà user thuộc về

#### Resource Attributes
- Được định nghĩa trong policy conditions
- Có thể check các properties của resource đang được truy cập

### Usage

#### 1. Tạo Policy

```typescript
POST /policies
{
  "name": "IT Department High Clearance",
  "description": "Allow IT department with clearance >= 3 to read sensitive data",
  "conditions": {
    "subject": {
      "department": "IT",
      "clearanceLevel": { "$gte": 3 }
    },
    "resource": {
      "category": "sensitive"
    },
    "action": "read"
  }
}
```

#### 2. Assign Policy cho User

```typescript
POST /users/:userId/policies
{
  "policyIds": ["policy-1"]
}
```

#### 3. Protect Routes với AbacGuard

```typescript
@Controller('files')
@UseGuards(JwtAuthGuard, AbacGuard)
export class FilesController {
  @Get(':id')
  @AbacPolicy('file.read')
  async findOne(@Param('id') id: string) {
    // ABAC policy 'file.read' sẽ được evaluate
  }
}
```

### AbacGuard Implementation

```typescript
@Injectable()
export class AbacGuard implements CanActivate {
  constructor(private readonly policyEngine: PolicyEngine) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyName = this.reflector.get<string>('abacPolicy', context.getHandler());
    const user = context.switchToHttp().getRequest().user;
    const resource = // extract resource from request
    
    return this.policyEngine.evaluate(policyName, {
      subject: user,
      resource,
      action: 'read',
    });
  }
}
```

### Policy Evaluation

Policy Engine evaluate policies theo thứ tự:

1. Load policies của user
2. Extract attributes từ subject và resource
3. Evaluate conditions (sử dụng operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, etc.)
4. Return true nếu có ít nhất một policy match

## Kết hợp RBAC và ABAC

### Strategy

1. **RBAC** cho role-based permissions cơ bản (ví dụ: Admin có thể làm mọi thứ)
2. **ABAC** cho fine-grained access control dựa trên attributes

### Ví dụ

```typescript
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class DocumentsController {
  @Get()
  @Roles('USER') // RBAC: User role required
  @AbacPolicy('document.read') // ABAC: Policy evaluation
  async findAll() {
    // User phải có role USER VÀ pass ABAC policy
  }
}
```

## Best Practices

### 1. Role Hierarchy

Tạo roles theo hierarchy:
- **Super Admin**: Tất cả permissions
- **Admin**: Quản lý users, roles, permissions
- **Manager**: Quản lý team resources
- **User**: Basic permissions

### 2. Permission Naming Convention

Sử dụng format: `{resource}.{action}`

```
user.read
user.create
user.update
user.delete
category.read
category.create
```

### 3. Policy Granularity

- Tạo policies cụ thể cho từng use case
- Tránh policies quá generic
- Document rõ ràng điều kiện của mỗi policy

### 4. Performance Considerations

- Cache policy evaluations khi có thể
- Index database queries cho policy lookups
- Limit số lượng policies per user

## Testing Authorization

### Unit Tests

```typescript
describe('RolesGuard', () => {
  it('should allow access for user with required role', () => {
    const user = { roles: ['ADMIN'] };
    const guard = new RolesGuard();
    // test logic
  });
});
```

### Integration Tests

Test complete authorization flow với real guards và policies.

## Troubleshooting

### Common Issues

1. **User không có quyền truy cập**
   - Check user có đúng role không
   - Check permissions của role
   - Check ABAC policies nếu có

2. **Policy evaluation fails**
   - Verify user attributes match policy conditions
   - Check resource attributes
   - Review policy JSON syntax

3. **Performance issues**
   - Optimize policy queries
   - Cache policy evaluations
   - Review policy complexity

## References

- Xem [Authentication & Authorization](./04-authentication-authorization.md) để hiểu authentication flow
- Xem code tại `src/modules/abac/` và `src/modules/policies/`
- Xem examples trong `docs/abac-explained.md` và `docs/abac-usage.md`

