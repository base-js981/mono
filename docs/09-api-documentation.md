# API Documentation

## Tổng quan

API documentation được tự động generate với **Swagger/OpenAPI** từ NestJS decorators.

## Access Swagger UI

### Development

```
http://localhost:3000/api
```

### Production

```
https://yourdomain.com/api
```

## API Structure

### Base URL

```
http://localhost:3000
```

### API Versioning

Hiện tại sử dụng version 1 (có thể mở rộng trong tương lai).

## Authentication

### Bearer Token

Tất cả protected endpoints require JWT Bearer token:

```
Authorization: Bearer <access_token>
```

### Get Access Token

1. **Register**: `POST /auth/register`
2. **Login**: `POST /auth/login`
3. **Use token** trong header của subsequent requests

## API Endpoints

### Authentication

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response**: `201 Created`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user-1",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**: `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user-1",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["USER"],
    "permissions": ["user.read"]
  }
}
```

#### Verify Email
```http
GET /auth/verify-email?token=verification_token
```

**Response**: `200 OK`
```json
{
  "message": "Email verified successfully"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

**Response**: `200 OK`
```json
{
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

### Users

#### List Users
```http
GET /users
Authorization: Bearer <token>
X-Tenant-Id: tenant-1 (optional)
```

**Response**: `200 OK`
```json
[
  {
    "id": "user-1",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "tenantId": "tenant-1",
    "roles": [
      {
        "id": "role-1",
        "name": "USER",
        "permissions": ["user.read"]
      }
    ]
  }
]
```

#### Get User
```http
GET /users/:id
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "id": "user-1",
  "email": "user@example.com",
  "name": "John Doe",
  "roles": [...]
}
```

#### Create User
```http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "name": "New User",
  "emailVerified": false
}
```

**Response**: `201 Created`

#### Update User
```http
PATCH /users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response**: `200 OK`

#### Delete User (Soft Delete)
```http
DELETE /users/:id
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "message": "User deleted successfully"
}
```

#### Assign Roles
```http
POST /users/:id/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleIds": ["role-1", "role-2"]
}
```

**Response**: `200 OK`

### Categories

#### List Categories
```http
GET /categories?includeDeleted=false
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
[
  {
    "id": "cat-1",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic products",
    "parentId": null,
    "isActive": true,
    "sortOrder": 0,
    "parent": null,
    "_count": {
      "children": 5
    }
  }
]
```

#### Get Category
```http
GET /categories/:id
Authorization: Bearer <token>
```

#### Create Category
```http
POST /categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Category",
  "slug": "new-category",
  "description": "Category description",
  "parentId": null,
  "isActive": true,
  "sortOrder": 0
}
```

#### Update Category
```http
PATCH /categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Category",
  "isActive": false
}
```

#### Delete Category
```http
DELETE /categories/:id
Authorization: Bearer <token>
```

### Files

#### Upload File
```http
POST /files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
```

**Response**: `201 Created`
```json
{
  "id": "file-1",
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "url": "https://s3.amazonaws.com/bucket/file-1.pdf",
  "uploadedById": "user-1",
  "tenantId": "tenant-1"
}
```

#### Get File
```http
GET /files/:id
Authorization: Bearer <token>
```

#### Download File
```http
GET /files/:id/download
Authorization: Bearer <token>
```

#### List Files
```http
GET /files?page=1&limit=20
Authorization: Bearer <token>
```

#### Delete File
```http
DELETE /files/:id
Authorization: Bearer <token>
```

### Roles

#### List Roles
```http
GET /roles
Authorization: Bearer <token>
```

#### Create Role
```http
POST /roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "MANAGER",
  "description": "Manager role",
  "permissionIds": ["perm-1", "perm-2"]
}
```

### Permissions

#### List Permissions
```http
GET /permissions
Authorization: Bearer <token>
```

#### Create Permission
```http
POST /permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "user.delete",
  "resource": "user",
  "action": "delete"
}
```

### Policies (ABAC)

#### List Policies
```http
GET /policies
Authorization: Bearer <token>
```

#### Create Policy
```http
POST /policies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "IT High Clearance",
  "description": "IT department with high clearance",
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

## Error Responses

### Standard Error Format

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### Common Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., email exists)
- `500 Internal Server Error`: Server error

### Example Error Responses

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

#### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

## Pagination

### Query Parameters

```
GET /users?page=1&limit=20
```

### Response Format

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Filtering & Sorting

### Filtering

```
GET /users?email=user@example.com&tenantId=tenant-1
```

### Sorting

```
GET /categories?sortBy=name&sortOrder=asc
GET /categories?sortBy=createdAt&sortOrder=desc
```

## Rate Limiting

API có rate limiting để prevent abuse:

- **Authentication endpoints**: 5 requests/minute
- **Other endpoints**: 100 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

## Testing API

### Swagger UI

1. Access Swagger UI tại `/api`
2. Click "Authorize" button
3. Enter Bearer token: `Bearer <your_token>`
4. Test endpoints directly từ UI

### cURL Examples

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!","name":"John"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!"}'

# Get Users (with token)
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer <access_token>"
```

### Postman Collection

Import Postman collection từ Swagger:

1. Export OpenAPI spec từ Swagger UI
2. Import vào Postman
3. Set environment variables cho base URL và tokens

## Best Practices

### 1. Always Include Authorization Header

```http
Authorization: Bearer <token>
```

### 2. Handle Errors Gracefully

Check status codes và handle errors appropriately.

### 3. Use Pagination for Large Datasets

Don't fetch all records at once.

### 4. Validate Input

Server validates all inputs, but client should also validate.

### 5. Cache Responses

Cache GET responses khi có thể để improve performance.

## References

- Swagger UI: http://localhost:3000/api
- OpenAPI Spec: http://localhost:3000/api-json
- NestJS Swagger: https://docs.nestjs.com/openapi/introduction

