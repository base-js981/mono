# REBAC (Relationship-Based Access Control) - Giải thích

## 1. Khái niệm cơ bản

**REBAC** là hệ thống phân quyền dựa trên **relationships** (mối quan hệ) giữa các entities (thực thể).

### Core Concept
```
Access được quyết định bởi RELATIONSHIPS giữa:
- Subject (User)
- Object (Resource)
- Và các entities khác
```

## 2. So sánh với các hệ thống khác

### RBAC (Role-Based)
```
"User có role ADMIN?"
→ Check: user.role === 'ADMIN'
```

### ABAC (Attribute-Based)
```
"User có department = resource.department 
 AND user.clearanceLevel >= resource.sensitivity?"
→ Check: Attributes của user và resource
```

### REBAC (Relationship-Based) ⭐
```
"User có relationship 'OWNS' với resource?"
"User có relationship 'COLLABORATOR' với resource?"
"User có relationship 'MANAGER' của resource owner?"
→ Check: RELATIONSHIP giữa user và resource
```

## 3. Types of Relationships

### 3.1. Ownership Relationship
```
User --[OWNS]--> Resource
```
**Use case**: Document ownership

### 3.2. Hierarchical Relationship
```
Manager --[MANAGES]--> Employee
Manager --[MANAGES]--> Resource (thông qua Employee)
```
**Use case**: Manager có thể access resources của nhân viên

### 3.3. Membership Relationship
```
User --[MEMBER_OF]--> Team
User --[MEMBER_OF]--> Organization
Resource --[BELONGS_TO]--> Organization
→ User có thể access resources của organization
```

### 3.4. Collaborative Relationship
```
User --[COLLABORATOR]--> Resource
User --[VIEWER]--> Resource
```
**Use case**: Google Docs permissions (owner, editor, viewer)

### 3.5. Social Relationship
```
User --[FRIEND]--> User
User --[FOLLOW]--> User
```
**Use case**: Social media (Facebook, Twitter)

## 4. Graph-Based Model

REBAC sử dụng **graph structure** để model relationships:

```
┌─────┐                  ┌──────────┐
│User│──[OWNS]─────────▶│Document  │
│John │                  │doc123.txt│
└─────┘                  └────┬─────┘
     │                         │
     │                    [SHARED_WITH]
     │                         ▼
     │                  ┌─────┐
     │                  │User │
     │                  │Mary │
     └──[MANAGES]──────▶│     │
                        └─────┘
```

## 5. Example: Document Management System

### Scenario
- John (MANAGER) owns document
- Mary (EMPLOYEE) được John manage
- Peter (VIEWER) được share document

### Policy Evaluation
```typescript
// Can Mary access John's document?

// Check direct relationship
Mary --[OWNS]--> Document? ❌ NO

// Check hierarchical relationship
Mary --[MANAGED_BY]--> John
John --[OWNS]--> Document
→ Decision: ✅ ALLOW (managed user can access manager's resources)

// Can Peter access document?
Peter --[VIEWER]--> Document? ✅ YES
→ Decision: ✅ ALLOW
```

## 6. Database Schema Design

### Option 1: Explicit Relationship Table
```prisma
model User {
  id    String @id
  // ...
  ownedResources UserResource[]
  managedUsers   UserRelationship[]
}

model UserResource {
  id        String @id
  userId    String
  resourceId String
  relationshipType String // 'OWNER', 'COLLABORATOR', 'VIEWER'
  
  user     User     @relation(fields: [userId], references: [id])
  resource Resource @relation(fields: [resourceId], references: [id])
}

model UserRelationship {
  id        String @id
  userId    String // Employee
  relatedUserId String // Manager
  relationshipType String // 'MANAGER', 'COLLABORATOR', 'TEAM_MEMBER'
  
  user         User @relation(fields: [userId], references: [id])
  relatedUser  User @relation(fields: [relatedUserId], references: [id])
}
```

### Option 2: Generic Relationship Model
```prisma
model Relationship {
  id        String @id
  sourceId  String // From entity
  targetId  String // To entity
  type      String // 'OWNS', 'MANAGES', 'COLLABORATOR'
  metadata  Json   // Extra info
  
  @@unique([sourceId, targetId, type])
}
```

## 7. Policy Examples

### Policy 1: Direct Ownership
```typescript
{
  rule: "owner_full_access",
  condition: "user --[OWNS]--> resource",
  decision: "ALLOW",
  permissions: ["READ", "UPDATE", "DELETE", "SHARE"]
}
```

### Policy 2: Hierarchy Access
```typescript
{
  rule: "manager_access_subordinate_resources",
  condition: "user --[MANAGES]--> resourceOwner",
  decision: "ALLOW",
  permissions: ["READ", "UPDATE"]
}
```

### Policy 3: Collaborative Access
```typescript
{
  rule: "collaborator_edit_access",
  condition: "user --[COLLABORATOR]--> resource",
  decision: "ALLOW",
  permissions: ["READ", "UPDATE"]
}
```

### Policy 4: Inherited Access
```typescript
{
  rule: "team_member_access",
  condition: "user --[MEMBER_OF]--> team AND resource --[BELONGS_TO]--> team",
  decision: "ALLOW",
  permissions: ["READ"]
}
```

### Policy 5: Indirect Access via Graph
```typescript
{
  rule: "friend_of_friend_access",
  condition: "user --[FRIEND]--> friend AND friend --[OWNS]--> resource AND resource.isPublic == true",
  decision: "ALLOW",
  permissions: ["READ"]
}
```

## 8. Implementation in NestJS

### 8.1. Relationship Service
```typescript
@Injectable()
export class RelationshipService {
  async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
  ): Promise<Relationship> {
    return this.prisma.relationship.create({
      data: { sourceId, targetId, type },
    });
  }

  async checkRelationship(
    userId: string,
    resourceId: string,
    allowedTypes: string[],
  ): Promise<boolean> {
    // Check direct relationship
    const direct = await this.prisma.relationship.findFirst({
      where: {
        sourceId: userId,
        targetId: resourceId,
        type: { in: allowedTypes },
      },
    });

    if (direct) return true;

    // Check indirect relationship (graph traversal)
    return this.checkIndirectRelationship(userId, resourceId, allowedTypes);
  }

  private async checkIndirectRelationship(
    userId: string,
    resourceId: string,
    allowedTypes: string[],
  ): Promise<boolean> {
    // Example: Check via hierarchy
    // User → [MANAGED_BY] → Manager → [OWNS] → Resource
    
    const manager = await this.prisma.relationship.findFirst({
      where: {
        targetId: userId, // user is managed by
        type: 'MANAGED_BY',
      },
    });

    if (!manager) return false;

    // Check if manager owns the resource
    const managerOwns = await this.prisma.relationship.findFirst({
      where: {
        sourceId: manager.sourceId,
        targetId: resourceId,
        type: 'OWNS',
      },
    });

    return !!managerOwns;
  }
}
```

### 8.2. REBAC Guard
```typescript
@Injectable()
export class RebacGuard implements CanActivate {
  constructor(private relationshipService: RelationshipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    // Check relationship
    const hasAccess = await this.relationshipService.checkRelationship(
      user.id,
      resourceId,
      ['OWNS', 'COLLABORATOR', 'MANAGER'], // Allowed relationship types
    );

    return hasAccess;
  }
}
```

### 8.3. Usage
```typescript
@Controller('documents')
export class DocumentsController {
  @Put(':id')
  @UseGuards(JwtAuthGuard, RebacGuard) // ← REBAC guard
  async update(@Param('id') id: string) {
    // User phải có relationship với document (owner/collaborator/manager)
  }
}
```

## 9. Advanced Features

### 9.1. Graph Traversal
```typescript
// Check relationship path: A → B → C → Resource
async checkPathAccess(userId: string, resourceId: string): Promise<boolean> {
  // Find all possible paths
  const paths = await this.findPaths(userId, resourceId);
  return paths.some(path => this.evaluatePath(path));
}
```

### 9.2. Transitive Relationships
```typescript
// If A MANAGES B, and B MANAGES C, then A can access C's resources
{
  rule: "transitive_management",
  condition: "user --[MANAGES*]--> resourceOwner",
  // * = transitive (multiple hops)
  decision: "ALLOW"
}
```

### 9.3. Relationship Expiry
```typescript
model Relationship {
  expiresAt DateTime? // Relationship có thể hết hạn
  
  @@map("relationships")
}
```

## 10. Use Cases

### Use Case 1: Google Docs Style Sharing
```
Owner → [OWNS] → Document
        ↓ [SHARED_WITH]
    Collaborator → [READ_WRITE] → Document
    Viewer → [READ_ONLY] → Document
```

### Use Case 2: GitHub Style Permissions
```
Repository Owner → [OWNS] → Repo
Team Member → [MEMBER] → Team → [HAS] → Repo Access
Organization → [HAS] → Repositories
```

### Use Case 3: Enterprise Hierarchy
```
CEO → [MANAGES] → VP Engineering
VP → [MANAGES] → Engineering Manager
Manager → [MANAGES] → Developer
Developer → [OWNS] → Code Repository

Policy: Manager can access subordinate's repositories
```

## 11. When to Use REBAC?

### ✅ Perfect cho:
- **Social networks**: Friend-based access
- **Document sharing**: Google Docs, Confluence
- **Code repositories**: GitHub, GitLab
- **Enterprise hierarchies**: Manager-employee relationships
- **Multi-tenant SaaS**: Organization-based access
- **Collaboration tools**: Slack channels, Teams

### ❌ Overkill cho:
- Simple permission systems
- Small applications
- Static role-based systems

## 12. REBAC vs Others

| Feature | RBAC | ABAC | REBAC |
|---------|------|------|-------|
| **Decides by** | Roles | Attributes | Relationships |
| **Complexity** | Low | Medium | High |
| **Flexibility** | Limited | Good | Excellent |
| **Use for** | Simple apps | Compliance | Social/Collab |
| **Example** | "Is admin?" | "Same dept?" | "Is friend?" |

## 13. Hybrid Approach

### RBAC + ABAC + REBAC ⭐
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard, RebacGuard)
@Roles('MANAGER')
@RequireSameDepartment()
@CheckRelationship(['OWNS', 'MANAGES'])
async update() {
  // User phải:
  // 1. Có role MANAGER (RBAC)
  // 2. Cùng department (ABAC)
  // 3. Có relationship với resource (REBAC)
}
```

## 14. Conclusion

REBAC là mạnh nhất nhưng phức tạp nhất:
- ✅ Cực kỳ flexible
- ✅ Perfect cho complex relationships
- ❌ Khó implement
- ❌ Cần graph database hoặc complex queries
- ❌ Performance overhead nếu không optimize

**Khuyến nghị**: Dùng khi cần fine-grained, relationship-based access control.

