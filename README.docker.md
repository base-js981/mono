# Docker Setup Instructions

## Prerequisites

- Docker
- Docker Compose

## Quick Start

### 1. Start Services (PostgreSQL, Redis, MailHog)

```bash
docker compose up -d
```

### 2. Check Services Status

```bash
docker compose ps
```

### 3. View Logs

```bash
docker compose logs -f [service_name]
# Examples:
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f mailhog
```

### 4. Stop Services

```bash
docker compose down
```

### 5. Stop and Remove Volumes

```bash
docker compose down -v
```

## Services

### PostgreSQL
- **Host:** localhost
- **Port:** 5432
- **User:** postgres
- **Password:** postgres
- **Database:** base_nodejs
- **Connection String:** `postgresql://postgres:postgres@localhost:5432/base_nodejs?schema=public`

### Redis
- **Host:** localhost
- **Port:** 6379

### MailHog (Email Testing)
- **SMTP Port:** 1025
- **Web UI:** http://localhost:8025
- **SMTP Host:** localhost

### pgAdmin (PostgreSQL Admin)
- **Web UI:** http://localhost:5050
- **Email:** admin@admin.com
- **Password:** admin

## Environment Variables

Update your `.env` file with the following values for local development:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/base_nodejs?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"
SMTP_HOST="localhost"
SMTP_PORT="1025"
```

## Running Migrations

After starting the services:

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev

# Seed database
pnpm prisma:seed
```

## Running the Application

```bash
pnpm start:dev
```

## MailHog Web UI

Access the MailHog web interface at http://localhost:8025 to view all emails sent by the application.

## pgAdmin Setup

1. Access pgAdmin at http://localhost:5050
2. Login with:
   - Email: `admin@admin.com`
   - Password: `admin`
3. Add PostgreSQL Server:
   - **Name:** Local PostgreSQL
   - **Host:** postgres (or `host.docker.internal` if using Docker Desktop)
   - **Port:** 5432
   - **Username:** postgres
   - **Password:** postgres
   - **Save Password:** Yes

## Troubleshooting

### Services not starting

Check if ports are already in use:
```bash
# PostgreSQL
lsof -i :5432

# Redis
lsof -i :6379

# MailHog
lsof -i :8025
lsof -i :1025
```

### Database connection issues

Make sure PostgreSQL is healthy:
```bash
docker compose ps postgres
```

### Clean restart

```bash
docker compose down -v
docker compose up -d
```

## Production Notes

For production, use external managed services (AWS RDS, Elasticache, etc.) instead of Docker containers.

