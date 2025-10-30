# ABAC Usage Guide

## 1. Introduction

Dự án hiện tại đã được extend với **ABAC (Attribute-Based Access Control)** kết hợp với **RBAC** sẵn có.

### Hybrid System: RBAC + ABAC
- **RBAC**: Check roles và permissions (nhanh, simple)
- **ABAC**: Check attributes (flexible, fine-grained)

## 2. ABAC Attributes

### User Attributes (Subject)
```typescript
{
  id: string;
  department?: string;        // Phòng ban
  tenantId?: string;          // Multi-tenant
  clearanceLevel?: number;    // Mức độ bảo mật
  roles?: string[];           // Roles (RBAC)
  permissions?: string[];     // Permissions (RBAC)
}
```

## 3. Default Policies

### Policy 1: Admin Full Access
```typescript
{
  effect: 'allow',
  conditions: [
    { subject.role IN ['ADMIN'] }
  ]
}
```
→ Admin có thể làm mọi thứ

### Policy 2: Same Tenant Access
```typescript
{
  effect: 'allow',
  conditions: [
    { subject.tenantId == resource.tenantId }
  ]
}
```
→ User chỉ truy cập resources cùng tenant

### Policy 3: Owner Edit Access
```typescript
{
  effect: 'allow',
  conditions: [
    { subject.id == resource.ownerId },
    { action IN ['UPDATE', 'DELETE'] }
  ]
}
```
→ Owner có thể edit/delete resources của mình

### Policy 4: Same Department Access
```typescript
{
  effect: 'allow',
  conditions: [
    { subject.department == resource.department }
  ]
}
```
→ User chỉ truy cập resources cùng department

## 4. Usage Examples

### Example 1: Protect Resource by Owner
```typescript
import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AbacGuard, RequireOwner } from '../abac';

@Controller('documents')
@UseGuards(JwtAuthGuard, AbacGuard)
export class DocumentsController {
  @Put(':id')
  @RequireOwner() // ← ABAC decorator
  async update(@Param('id') id: string) {
    // Chỉ owner mới được update
  }
}
```

### Example 2: Same Department Access
```typescript
@Get(':id')
@RequireSameDepartment() // ← ABAC decorator
async read(@Param('id') id: string) {
  // Chỉ user cùng department mới được đọc
}
```

### Example 3: Same Tenant Access
```typescript
@Get(':id')
@RequireSameTenant() // ← ABAC decorator
async read(@Param('id') id: string) {
  // Multi-tenant: chỉ user cùng tenant mới access được
}
```

## 5. Custom Policies

### Tạo Policy mới
```typescript
import { PolicyEngine } from './modules/abac';

constructor(private policyEngine: PolicyEngine) {}

addPolicy() {
  this.policyEngine.addPolicy({
    id: 'policy-custom',
    name: 'Custom Policy',
    effect: 'allow',
    conditions: [
      {
        attribute: 'subject.clearanceLevel',
        operator: 'greater',
        value: 3,
      },
      {
        attribute: 'resource.sensitivity',
        operator: 'equals',
        value: 'LOW',
      },
    ],
  });
}
```

## 6. Policy Evaluation Flow

```
User Request
    ↓
Extract Attributes
  - subject.id
  - subject.department
  - subject.tenantId
  - resource.ownerId
  - resource.department
  - action (GET/POST/PUT/DELETE)
  - environment.timeOfDay
    ↓
Policy Engine Evaluation
    ↓
Check Each Policy Conditions
    ↓
Return Decision (ALLOW/DENY)
```

## 7. Multiple Policy Rules

ABAC Guard sẽ check **theo thứ tự** và return khi **match đầu tiên**:

```typescript
// Policy 1: Admin → ALLOW (matched, return ngay)
// Policy 2: Owner → Skip
// Policy 3: Same Department → Skip
```

## 8. Best Practices

### ✅ Sử dụng ABAC khi:
- Cần check ownership (resource.ownerId)
- Multi-tenant systems
- Time-based access (business hours only)
- Location-based access
- Dynamic permissions

### ✅ Sử dụng RBAC khi:
- Simple role hierarchy (ADMIN, USER)
- Permission-based access
- Fast evaluation needed

### ✅ Hybrid Approach (Khuyến nghị)
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@Roles('MANAGER')
@RequireOwner()
async update() {
  // Check role AND owner
}
```

## 9. Extending ABAC

### Thêm attributes mới
1. Update schema
2. Update JWT strategy
3. Create new policies

### Example: Add Time-Based Policy
```typescript
this.policyEngine.addPolicy({
  id: 'business-hours-only',
  name: 'Business Hours Access',
  effect: 'allow',
  conditions: [
    {
      attribute: 'environment.timeOfDay',
      operator: 'greater',
      value: '09:00',
    },
    {
      attribute: 'environment.timeOfDay',
      operator: 'less',
      value: '18:00',
    },
  ],
});
```

## 10. Testing ABAC

```typescript
// Test owner access
const context: PolicyContext = {
  subject: { id: 'user123' },
  resource: { id: 'doc1', ownerId: 'user123' },
  action: 'UPDATE',
  environment: { timeOfDay: '14:00' },
};

const decision = await policyEngine.evaluate(context);
// decision = { effect: 'allow' }
```

