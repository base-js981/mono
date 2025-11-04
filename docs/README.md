# Documentation Index

Chào mừng đến với tài liệu của dự án Base NodeJS. Đây là một NestJS application với đầy đủ tính năng enterprise-grade.

## 📚 Danh sách tài liệu

### 1. [Architecture Overview](./01-architecture.md)
Tổng quan về kiến trúc ứng dụng, tech stack, module structure, và design patterns.

**Nội dung:**
- Tech stack và dependencies
- Kiến trúc module
- Request flow
- Design patterns
- Shared services

### 2. [RBAC & ABAC Authorization](./02-rbac-abac.md)
Hệ thống phân quyền kết hợp Role-Based và Attribute-Based Access Control.

**Nội dung:**
- RBAC implementation
- ABAC implementation
- Policy evaluation
- Usage examples
- Best practices

### 3. [Multi-Tenancy](./03-multi-tenancy.md)
Hệ thống multi-tenancy với data isolation.

**Nội dung:**
- Tenant resolution
- Tenant-aware services
- Data isolation
- Security considerations
- Performance optimization

### 4. [Authentication & Authorization](./04-authentication-authorization.md)
JWT-based authentication và authorization flows.

**Nội dung:**
- Registration và login flow
- JWT token structure
- Guards implementation
- Password security
- Security best practices

### 5. [Development Tools & Infrastructure](./05-tools.md)
Các công cụ hỗ trợ development và monitoring.

**Nội dung:**
- Bull Board (Queue monitoring)
- Jaeger & OpenTelemetry (Distributed tracing)
- MailHog (Email testing)
- PgAdmin (Database administration)
- Redis & PostgreSQL

### 6. [Database & Prisma](./06-database-prisma.md)
Quản lý database với Prisma ORM.

**Nội dung:**
- Prisma setup và configuration
- Database models và relations
- Migrations
- Seeding
- Performance optimization

### 7. [Testing Guide](./07-testing.md)
Hướng dẫn viết và chạy tests.

**Nội dung:**
- Unit tests
- E2E tests
- Mocking strategies
- Test patterns
- Best practices

### 8. [Deployment Guide](./08-deployment.md)
Hướng dẫn deploy ứng dụng lên production.

**Nội dung:**
- Pre-deployment checklist
- Docker deployment
- Cloud deployment (AWS, Kubernetes)
- Database migrations
- Monitoring và observability
- Security hardening

### 9. [API Documentation](./09-api-documentation.md)
Tài liệu API endpoints và usage.

**Nội dung:**
- Authentication endpoints
- Resource endpoints
- Error handling
- Pagination và filtering
- Rate limiting

## 🚀 Quick Start

1. **Setup môi trường development**:
   ```bash
   docker-compose up -d
   pnpm install
   pnpm prisma:generate
   pnpm prisma:migrate:dev
   pnpm prisma:seed
   ```

2. **Chạy application**:
   ```bash
   pnpm start:dev
   ```

3. **Access tools**:
   - API: http://localhost:3000
   - Swagger: http://localhost:3000/api
   - Bull Board: http://localhost:3001
   - Jaeger: http://localhost:16686
   - MailHog: http://localhost:8025
   - PgAdmin: http://localhost:5050

## 📖 Đọc thêm

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

## 🤝 Đóng góp

Khi cập nhật code, hãy nhớ cập nhật documentation tương ứng:

- Thêm tính năng mới → Update relevant docs
- Thay đổi architecture → Update architecture doc
- Thêm endpoints → Update API documentation
- Thay đổi deployment → Update deployment guide

## 📝 Notes

- Tất cả documentation được viết bằng tiếng Việt
- Code examples sử dụng TypeScript
- Documentation được cập nhật thường xuyên
- Có questions? Mở issue hoặc contact team

