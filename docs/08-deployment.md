# Deployment Guide

## Tổng quan

Hướng dẫn deploy ứng dụng NestJS lên production environment với Docker và các best practices.

## Pre-Deployment Checklist

### 1. Environment Variables

Đảm bảo tất cả environment variables được set:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# JWT
JWT_SECRET=your-production-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com

# Redis
REDIS_HOST=redis-host
REDIS_PORT=6379

# SMTP
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@yourdomain.com

# OpenTelemetry (optional)
JAEGER_ENABLED=true
OTEL_SERVICE_NAME=your-service-name
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger-collector:4317

# AWS S3 (file storage)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 2. Database Setup

```bash
# Run migrations
pnpm prisma:migrate deploy

# Verify migrations
pnpm prisma:migrate status

# Seed initial data (optional)
pnpm prisma:seed
```

### 3. Build Application

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Generate Prisma Client
pnpm prisma:generate

# Build application
pnpm build
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma:generate

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Install production dependencies only
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy instrumentation
COPY --from=builder /app/dist/src/instrumentation.js ./dist/src/

# Set non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "-r", "./dist/src/instrumentation.js", "./dist/src/main"]
```

### Docker Compose for Production

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: base-nodejs-app
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    container_name: base-nodejs-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: base-nodejs-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### Build and Run

```bash
# Build image
docker build -t base-nodejs:latest .

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## Cloud Deployment

### AWS ECS/Fargate

1. **Build và push image**:
```bash
docker build -t your-ecr-repo/base-nodejs:latest .
docker push your-ecr-repo/base-nodejs:latest
```

2. **Configure ECS Task Definition**:
   - Set environment variables
   - Configure health checks
   - Set resource limits

3. **Deploy Service**:
   - Create ECS service với task definition
   - Configure load balancer
   - Set auto-scaling policies

### Kubernetes

#### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: base-nodejs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: base-nodejs
  template:
    metadata:
      labels:
        app: base-nodejs
    spec:
      containers:
      - name: app
        image: base-nodejs:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: base-nodejs-service
spec:
  selector:
    app: base-nodejs
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Database Migration

### Production Migration Process

1. **Backup database**:
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

2. **Test migration locally** với production data snapshot

3. **Run migration**:
```bash
pnpm prisma:migrate deploy
```

4. **Verify migration**:
```bash
pnpm prisma:migrate status
```

5. **Rollback plan**: Có sẵn rollback migration nếu cần

## Monitoring & Observability

### Health Checks

Implement health check endpoint:

```typescript
@Controller('health')
export class HealthController {
  @Get()
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
```

### Logging

- Use structured logging (Pino, Winston)
- Log levels: error, warn, info, debug
- Include request IDs cho traceability
- Avoid logging sensitive data

### Metrics

- Track request rates, latency, errors
- Monitor database connection pool
- Monitor queue job processing
- Set up alerts cho critical metrics

### Distributed Tracing

- Jaeger/OpenTelemetry đã được setup
- Ensure OTEL collector accessible từ production
- Monitor trace sampling rate

## Security Hardening

### 1. Secrets Management

- **Never commit secrets** to git
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

### 2. HTTPS/TLS

- Always use HTTPS trong production
- Configure TLS certificates (Let's Encrypt, AWS ACM)
- Enable HSTS headers

### 3. Rate Limiting

Implement rate limiting để prevent abuse:

```typescript
@Throttle(100, 60) // 100 requests per minute
@Get()
async findAll() {
  // ...
}
```

### 4. CORS Configuration

```typescript
app.enableCors({
  origin: ['https://yourdomain.com'],
  credentials: true,
});
```

### 5. Security Headers

```typescript
app.use(helmet()); // Set security headers
```

## Performance Optimization

### 1. Database Connection Pooling

Configure trong `DATABASE_URL`:
```
?connection_limit=10&pool_timeout=20
```

### 2. Caching

- Use Redis cho caching frequently accessed data
- Implement cache invalidation strategies
- Set appropriate TTLs

### 3. Horizontal Scaling

- Stateless application → easy horizontal scaling
- Use load balancer để distribute traffic
- Scale based on CPU/memory metrics

### 4. Background Jobs

- Offload heavy tasks to Bull queues
- Monitor queue processing time
- Scale workers based on queue length

## Backup Strategy

### Database Backups

1. **Automated daily backups**
2. **Retention policy**: 30 days
3. **Test restore procedures** regularly

### Application Backups

- Backup uploaded files (S3 bucket)
- Backup configuration files
- Document recovery procedures

## Rollback Procedures

### Application Rollback

1. **Docker**: Deploy previous image version
2. **Kubernetes**: Rollback deployment
3. **ECS**: Update service với previous task definition

### Database Rollback

1. **Restore from backup**
2. **Run rollback migrations** (if available)
3. **Verify data integrity**

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t base-nodejs:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          docker tag base-nodejs:${{ github.sha }} registry/base-nodejs:latest
          docker push registry/base-nodejs:latest
      
      - name: Deploy to production
        run: |
          ssh deploy@server "cd /app && docker-compose pull && docker-compose up -d"
      
      - name: Run migrations
        run: |
          ssh deploy@server "cd /app && docker-compose exec app pnpm prisma:migrate deploy"
```

## Troubleshooting

### Common Issues

1. **Application crashes on startup**
   - Check environment variables
   - Verify database connection
   - Check logs for errors

2. **Database connection errors**
   - Verify DATABASE_URL
   - Check network connectivity
   - Verify database credentials

3. **Performance issues**
   - Check database query performance
   - Monitor memory usage
   - Review connection pool settings

4. **Memory leaks**
   - Monitor memory usage over time
   - Review code for potential leaks
   - Set memory limits trong container

## References

- NestJS Deployment: https://docs.nestjs.com/fundamentals/lifecycle-events
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
- Production Checklist: Review trước khi deploy

