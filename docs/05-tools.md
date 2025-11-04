# Development Tools & Infrastructure

## Tổng quan

Dự án sử dụng nhiều công cụ hỗ trợ cho development, monitoring, và debugging. Tất cả tools được containerized với Docker Compose.

## Bull Board

### Mục đích

**Bull Board** là UI dashboard để monitor và quản lý Bull queues (background jobs).

### Access

- **URL**: http://localhost:3001
- **Container**: `base-nodejs-bull-board`

### Features

- Xem tất cả queues và jobs
- Monitor job status (waiting, active, completed, failed)
- Retry failed jobs
- Clean jobs (remove old jobs)
- View job details và data

### Configuration

```dockerfile
# bull-board/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY index.js .
EXPOSE 3001
CMD ["node", "index.js"]
```

```javascript
// bull-board/index.js
const emailQueue = new Queue('email', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
});
```

### Usage

1. **Start services**: `docker-compose up -d`
2. **Access dashboard**: http://localhost:3001
3. **Monitor queues**: Xem email queue và các jobs
4. **Debug jobs**: Check failed jobs và retry nếu cần

### Queue Names

- `email`: Email sending jobs

### Troubleshooting

- **Dashboard không load**: Check Redis connection
- **Jobs không hiển thị**: Verify queue name matches
- **Connection errors**: Check REDIS_HOST và REDIS_PORT

## Jaeger & OpenTelemetry

### Mục đích

**Jaeger** là distributed tracing system để monitor và debug microservices. **OpenTelemetry** là instrumentation framework.

### Access

- **Jaeger UI**: http://localhost:16686
- **OTLP gRPC**: localhost:4317
- **OTLP HTTP**: localhost:4318
- **Container**: `base-nodejs-jaeger`

### Features

- **Distributed Tracing**: Track requests across services
- **Service Map**: Visualize service dependencies
- **Performance Analysis**: Identify bottlenecks
- **Error Tracking**: Find và debug errors

### Configuration

```typescript
// src/instrumentation.ts
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: otlpEndpoint,
    })
  ),
  instrumentations: [
    getNodeAutoInstrumentations(),
    new PrismaInstrumentation(), // Prisma query tracing
  ],
});
```

### Environment Variables

```env
JAEGER_ENABLED=true
OTEL_SERVICE_NAME=nestjs-app-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### Usage

1. **Start Jaeger**: `docker-compose up -d jaeger`
2. **Access UI**: http://localhost:16686
3. **Make requests**: Send requests to API
4. **View traces**: Search traces trong Jaeger UI

### Trace Structure

```
Request
  ↓
HTTP Span (Express)
  ↓
Controller Span
  ↓
Service Span
  ↓
Prisma Query Span
  ↓
Database
```

### Instrumented Libraries

- **Express**: HTTP requests/responses
- **Prisma**: Database queries
- **Custom spans**: Manual instrumentation với `@opentelemetry/api`

### Manual Instrumentation

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');

async function processOrder() {
  return tracer.startActiveSpan('process-order', async (span) => {
    try {
      // Your logic here
      span.setAttribute('order.id', orderId);
      return result;
    } finally {
      span.end();
    }
  });
}
```

### Troubleshooting

- **No traces**: Check JAEGER_ENABLED=true
- **Connection errors**: Verify OTLP endpoint
- **Missing spans**: Ensure instrumentation được load đúng

## MailHog

### Mục đích

**MailHog** là email testing tool cho development. Capture và display emails thay vì send thật.

### Access

- **SMTP**: localhost:1025
- **Web UI**: http://localhost:8025
- **Container**: `base-nodejs-mailhog`

### Features

- Capture all outgoing emails
- View emails trong web UI
- Test email templates
- Verify email content

### Configuration

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@example.com
```

### Usage

1. **Start MailHog**: `docker-compose up -d mailhog`
2. **Send emails**: Trigger email sending từ app
3. **View emails**: http://localhost:8025
4. **Test**: Click emails để verify content

### Production Setup

Trong production, thay MailHog bằng real SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Troubleshooting

- **Emails không đến**: Check SMTP configuration
- **Connection refused**: Verify MailHog đang chạy
- **Port conflicts**: Check port 1025 available

## PgAdmin

### Mục đích

**PgAdmin** là web-based PostgreSQL administration tool.

### Access

- **URL**: http://localhost:5050
- **Email**: admin@admin.com
- **Password**: admin
- **Container**: `base-nodejs-pgadmin`

### Features

- Connect to PostgreSQL databases
- Execute SQL queries
- View và edit data
- Manage database schema
- Import/Export data

### Configuration

1. **Login**: admin@admin.com / admin
2. **Add Server**:
   - Name: Local PostgreSQL
   - Host: postgres (container name)
   - Port: 5432
   - Username: postgres
   - Password: postgres
   - Database: base_nodejs

### Usage

1. **Start PgAdmin**: `docker-compose up -d pgadmin`
2. **Access**: http://localhost:5050
3. **Login**: admin@admin.com / admin
4. **Connect**: Add PostgreSQL server
5. **Query**: Execute SQL queries

### Common Queries

```sql
-- View all users
SELECT * FROM users;

-- View categories
SELECT * FROM categories;

-- View audit logs
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100;

-- Check tenant data
SELECT * FROM categories WHERE tenant_id = 'tenant-1';
```

### Troubleshooting

- **Cannot connect**: Check postgres container running
- **Connection timeout**: Verify network connectivity
- **Authentication failed**: Verify credentials

## Redis

### Mục đích

**Redis** được sử dụng cho:
- Bull queue storage
- Caching (nếu implement)
- Session storage (nếu implement)

### Access

- **Port**: localhost:6379
- **Container**: `base-nodejs-redis`

### Configuration

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Usage

1. **Start Redis**: `docker-compose up -d redis`
2. **Use in code**: Bull queues tự động connect
3. **Monitor**: Use Bull Board để monitor queues

### Redis CLI

```bash
# Connect to Redis
docker exec -it base-nodejs-redis redis-cli

# Monitor commands
MONITOR

# Check keys
KEYS *

# Get queue info
HGETALL bull:email:*
```

## PostgreSQL

### Mục đích

Primary database cho application.

### Access

- **Port**: localhost:5432
- **User**: postgres
- **Password**: postgres
- **Database**: base_nodejs
- **Container**: `base-nodejs-postgres`

### Configuration

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/base_nodejs?schema=public
```

### Usage

1. **Start PostgreSQL**: `docker-compose up -d postgres`
2. **Connect**: Use Prisma Studio hoặc PgAdmin
3. **Migrations**: `pnpm prisma:migrate:dev`
4. **Seed**: `pnpm prisma:seed`

### Prisma Studio

Visual database browser:

```bash
pnpm prisma:studio
# Access: http://localhost:5555
```

## Docker Compose

### Start All Services

```bash
docker-compose up -d
```

### Start Specific Service

```bash
docker-compose up -d postgres redis
```

### View Logs

```bash
docker-compose logs -f jaeger
docker-compose logs -f bull-board
```

### Stop Services

```bash
docker-compose stop
docker-compose down  # Remove containers
docker-compose down -v  # Remove volumes too
```

## Development Workflow

### Typical Setup

1. **Start infrastructure**:
   ```bash
   docker-compose up -d postgres redis mailhog jaeger
   ```

2. **Setup database**:
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate:dev
   pnpm prisma:seed
   ```

3. **Start application**:
   ```bash
   pnpm start:dev
   ```

4. **Access tools**:
   - API: http://localhost:3000
   - Swagger: http://localhost:3000/api
   - Bull Board: http://localhost:3001
   - Jaeger: http://localhost:16686
   - MailHog: http://localhost:8025
   - PgAdmin: http://localhost:5050

## Troubleshooting

### Port Conflicts

Nếu port đã được sử dụng, thay đổi trong `docker-compose.yml`:

```yaml
ports:
  - '3002:3001'  # Use different host port
```

### Container Issues

```bash
# Check container status
docker-compose ps

# Restart container
docker-compose restart jaeger

# View container logs
docker-compose logs -f <service-name>
```

### Network Issues

```bash
# Check network
docker network ls
docker network inspect base-nodejs_default
```

## References

- Bull Board: https://github.com/felixmosh/bull-board
- Jaeger: https://www.jaegertracing.io/
- OpenTelemetry: https://opentelemetry.io/
- MailHog: https://github.com/mailhog/MailHog
- PgAdmin: https://www.pgadmin.org/

