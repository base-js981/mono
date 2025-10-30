# ABAC (Attribute-Based Access Control) - Giải thích

## 1. Khái niệm cơ bản

ABAC là hệ thống phân quyền dựa trên **attributes** (thuộc tính) của:
- **Subject** (người dùng): role, department, clearance level
- **Resource** (tài nguyên): owner, location, sensitivity level
- **Environment**: time, IP address, device type
- **Action**: read, write, delete

## 2. So sánh RBAC vs ABAC

### RBAC (hiện tại đang dùng)
```
Câu hỏi: "User có role ADMIN?"
✅ YES → Cho phép
❌ NO → Từ chối
```

### ABAC
```
Câu hỏi: "User có permission CREATE_DOCUMENT 
         VÀ ownerId = currentUserId 
         VÀ document.status = 'draft' 
         VÀ timeOfDay < '17:00'?"
✅ Tất cả điều kiện thỏa → Cho phép
❌ Một điều kiện fail → Từ chối
```

## 3. Cấu trúc ABAC

```
┌─────────────────────────────────────────┐
│         Policy Engine                   │
│  (PDP - Policy Decision Point)         │
│                                         │
│  IF: user.role = "MANAGER"             │
│       AND resource.department =        │
│           user.department               │
│       AND action = "DELETE"            │
│       AND env.timeOfDay < "22:00"      │
│  THEN: ALLOW                            │
│  ELSE: DENY                              │
└─────────────────────────────────────────┘
         ↑             ↑
         │             │
    ┌────┴────┐   ┌────┴────┐
    │ Subject │   │ Resource│
    │ User    │   │ Document│
    └─────────┘   └─────────┘
```

## 4. Ví dụ thực tế

### Ví dụ 1: Document System
```typescript
// Policy
{
  rule: "user_can_edit_own_documents",
  condition: {
    user: { department: "IT" },
    resource: { ownerId: user.id },
    action: "UPDATE",
    environment: { timeOfDay: "< 18:00" }
  },
  decision: "ALLOW"
}

// Evaluation
const user = { 
  id: "user123", 
  role: "MANAGER", 
  department: "IT" 
};

const document = { 
  id: "doc1", 
  ownerId: "user123", 
  status: "draft" 
};

const context = { 
  timeOfDay: "14:30", 
  ipAddress: "192.168.1.1" 
};

// Result: ✅ ALLOW
// - User là IT department ✓
// - Document owner = user.id ✓
// - Time < 18:00 ✓
```

### Ví dụ 2: Multi-tenant
```typescript
const policy = {
  rule: "access_same_tenant_only",
  condition: {
    user: { tenantId: "acme" },
    resource: { tenantId: "acme" },
    action: "READ"
  },
  decision: "ALLOW"
};

// User từ tenant "acme" chỉ truy cập được resources của "acme"
```

## 5. ABAC trong Database Schema

### Hiện tại (RBAC)
```prisma
model User {
  id    String @id
  role  String // ADMIN hoặc USER
}

// Chỉ check: if (user.role === "ADMIN")
```

### Với ABAC
```prisma
model User {
  id           String @id
  role         String
  department   String
  clearanceLevel Int
  tenantId     String
}

model Resource {
  id           String @id
  ownerId      String
  department   String
  sensitivity  String
  tenantId     String
}
```

## 6. Policy Definition (JSON)

```json
{
  "policies": [
    {
      "id": "policy-1",
      "name": "User can edit own documents during business hours",
      "effect": "allow",
      "target": {
        "resources": ["document"],
        "actions": ["UPDATE", "DELETE"]
      },
      "rules": [
        {
          "condition": "resource.ownerId == subject.id"
        },
        {
          "condition": "subject.department == resource.department"
        },
        {
          "condition": "environment.timeOfDay >= '08:00' AND environment.timeOfDay <= '18:00'"
        }
      ]
    },
    {
      "id": "policy-2",
      "name": "Admin can access any resource",
      "effect": "allow",
      "target": {
        "subjects": ["ADMIN"]
      },
      "rules": []
    }
  ]
}
```

## 7. Implementation trong NestJS

```typescript
// ABAC Guard
@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private policyDecisionPoint: PolicyEngine,
    private evaluator: PolicyEvaluator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const subject = {
      id: request.user.id,
      role: request.user.role,
      department: request.user.department,
      tenantId: request.user.tenantId,
    };
    
    const resource = {
      id: request.params.id,
      ownerId: request.params.ownerId,
      department: await this.getResourceDepartment(request.params.id),
      tenantId: request.params.tenantId,
    };
    
    const environment = {
      timeOfDay: new Date().toISOString(),
      ipAddress: request.ip,
      deviceType: request.headers['user-agent'],
    };
    
    return await this.policyDecisionPoint.evaluate({
      subject,
      resource,
      environment,
      action: request.method,
    });
  }
}
```

## 8. Lợi ích của ABAC

✅ **Flexible**: Dễ thêm điều kiện phức tạp
✅ **Fine-grained**: Control chi tiết đến từng attribute
✅ **Scalable**: Không cần tạo roles mới cho mỗi case
✅ **Dynamic**: Có thể thay đổi policy mà không thay đổi code
✅ **Context-aware**: Xem xét environment variables

## 9. Khi nào dùng ABAC?

### Dùng ABAC khi:
- ✅ Multi-tenant system
- ✅ Complex business rules
- ✅ Resource ownership matters
- ✅ Time/location based access
- ✅ Compliance requirements (HIPAA, GDPR)

### Dùng RBAC khi:
- ✅ Simple permission structure
- ✅ Clear role hierarchy
- ✅ Small team/startup
- ✅ Không cần fine-grained control

## 10. Migration từ RBAC sang ABAC

```typescript
// Bước 1: Add attributes vào models
// Bước 2: Tạo PolicyEngine
// Bước 3: Create policies (JSON/YAML)
// Bước 4: Implement ABAC Guard
// Bước 5: Replace RBAC guards với ABAC guards
```

