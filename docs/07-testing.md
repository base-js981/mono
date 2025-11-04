# Testing Guide

## Tổng quan

Dự án sử dụng **Jest** làm test runner và **@nestjs/testing** cho NestJS integration tests.

## Test Structure

```
src/
├── modules/
│   ├── users/
│   │   ├── users.service.ts
│   │   └── users.service.spec.ts  # Unit tests
│   └── categories/
│       └── categories.service.spec.ts
└── test/
    └── app.e2e-spec.ts            # E2E tests
```

## Test Types

### Unit Tests

Test individual components với mocked dependencies.

**Location**: `*.spec.ts` files cùng với source files

**Example**:
```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should return all users', async () => {
    const mockUsers = [{ id: '1', email: 'test@test.com' }];
    toMock(prisma.user.findMany).mockResolvedValue(mockUsers);

    const result = await service.findAll();

    expect(result).toEqual(mockUsers);
    expect(prisma.user.findMany).toHaveBeenCalled();
  });
});
```

### E2E Tests

Test complete request flows với real HTTP requests.

**Location**: `test/` directory

**Example**:
```typescript
describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users (GET)', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

## Mocking Prisma

### Setup Mock PrismaService

```typescript
const mockPrismaService = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userRole: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockPrismaService)),
};
```

### Cast Helper Function

Prisma delegate methods cần cast sang `jest.Mock`:

```typescript
const toMock = <T>(fn: T): jest.Mock => fn as unknown as jest.Mock;

// Usage
toMock(prisma.user.findMany).mockResolvedValue(mockUsers);
toMock(prisma.user.findFirst).mockResolvedValueOnce(user1)
  .mockResolvedValueOnce(user2);
```

### Mocking Examples

```typescript
// Simple mock
toMock(prisma.user.findUnique).mockResolvedValue(mockUser);

// Multiple calls
toMock(prisma.user.findFirst)
  .mockResolvedValueOnce(null)
  .mockResolvedValueOnce(mockUser);

// Error cases
toMock(prisma.user.create).mockRejectedValue(new Error('Database error'));

// Transactions
toMock(prisma.$transaction).mockImplementation(async (cb) => {
  return cb(mockPrismaService);
});
```

## Test Patterns

### Arrange-Act-Assert

```typescript
it('should create user', async () => {
  // Arrange
  const dto = { email: 'test@test.com', password: 'pass123' };
  toMock(prisma.user.findFirst).mockResolvedValue(null);
  toMock(prisma.user.create).mockResolvedValue({ ...dto, id: '1' });

  // Act
  const result = await service.create(dto);

  // Assert
  expect(result).toBeDefined();
  expect(prisma.user.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ email: dto.email }),
  });
});
```

### Test Edge Cases

```typescript
it('should throw ConflictException when email exists', async () => {
  toMock(prisma.user.findFirst).mockResolvedValue(mockUser);

  await expect(service.create(createDto)).rejects.toThrow(ConflictException);
});
```

### Test Tenant Isolation

```typescript
it('should filter by tenant', async () => {
  const tenant = { id: 'tenant-1' };
  const mockCategories = [{ id: '1', tenantId: 'tenant-1' }];
  toMock(prisma.category.findMany).mockResolvedValue(mockCategories);

  const result = await service.findAll(tenant);

  expect(result.every(c => c.tenantId === 'tenant-1')).toBe(true);
  expect(prisma.category.findMany).toHaveBeenCalledWith({
    where: { tenantId: 'tenant-1' },
  });
});
```

## Testing Guards

### Test RolesGuard

```typescript
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access for user with required role', () => {
    const context = createMockExecutionContext({
      user: { roles: ['ADMIN'] },
    });
    Reflect.defineMetadata('roles', ['ADMIN'], context.getHandler());

    expect(guard.canActivate(context)).toBe(true);
  });
});
```

### Test AbacGuard

```typescript
describe('AbacGuard', () => {
  let guard: AbacGuard;
  let policyEngine: jest.Mocked<PolicyEngine>;

  beforeEach(() => {
    policyEngine = {
      evaluate: jest.fn(),
    };
    guard = new AbacGuard(policyEngine);
  });

  it('should allow access when policy passes', async () => {
    policyEngine.evaluate.mockResolvedValue(true);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(policyEngine.evaluate).toHaveBeenCalled();
  });
});
```

## Testing DTOs

### Validation Tests

```typescript
describe('CreateUserDto', () => {
  it('should validate email format', () => {
    const dto = new CreateUserDto();
    dto.email = 'invalid-email';
    dto.password = 'ValidPass123!';

    const errors = validateSync(dto);
    expect(errors.find(e => e.property === 'email')).toBeDefined();
  });

  it('should validate password strength', () => {
    const dto = new CreateUserDto();
    dto.email = 'valid@example.com';
    dto.password = 'weak';

    const errors = validateSync(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });
});
```

## Test Utilities

### Mock Factory

```typescript
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    password: 'hashed',
    emailVerified: true,
    tenantId: 'tenant-1',
    ...overrides,
  };
}
```

### Test Helpers

```typescript
export function createMockExecutionContext(
  overrides?: Partial<ExecutionContext>,
): ExecutionContext {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        user: { id: 'user-1', roles: ['USER'] },
        ...overrides?.request,
      }),
      getResponse: jest.fn(),
    }),
    ...overrides,
  } as ExecutionContext;
}
```

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Tests in Watch Mode

```bash
pnpm test:watch
```

### Run Specific Test File

```bash
pnpm test users.service.spec
```

### Run Tests with Coverage

```bash
pnpm test:cov
```

### Run E2E Tests

```bash
pnpm test:e2e
```

### Run Tests in Debug Mode

```bash
pnpm test:debug
```

## Test Coverage

### Coverage Thresholds

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 85,
        "statements": 85
      }
    }
  }
}
```

### View Coverage Report

```bash
pnpm test:cov
```

Report được generate tại `coverage/` directory.

## Best Practices

### 1. Test Naming

```typescript
describe('UsersService', () => {
  describe('findAll', () => {
    it('should return all users when no tenant context', async () => {
      // ...
    });

    it('should filter users by tenant when tenant context provided', async () => {
      // ...
    });
  });
});
```

### 2. Test Isolation

- Mỗi test độc lập, không phụ thuộc vào test khác
- Reset mocks trong `afterEach`
- Không share state giữa tests

### 3. Test Structure

- **Arrange**: Setup mocks và test data
- **Act**: Execute code under test
- **Assert**: Verify results

### 4. Mock Only Dependencies

- Mock external dependencies (database, HTTP, etc.)
- Test business logic với real implementations

### 5. Test Error Cases

```typescript
it('should throw NotFoundException when user not found', async () => {
  toMock(prisma.user.findFirst).mockResolvedValue(null);

  await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm test:cov
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

1. **Type errors với Prisma mocks**
   - Sử dụng `toMock()` helper function
   - Cast `prisma` variable: `as jest.Mocked<PrismaService>`

2. **Tests fail intermittently**
   - Check async/await usage
   - Verify mocks được reset trong `afterEach`
   - Check test isolation

3. **E2E tests timeout**
   - Increase timeout values
   - Check database connection
   - Verify test database setup

## References

- Jest Docs: https://jestjs.io/docs/getting-started
- NestJS Testing: https://docs.nestjs.com/fundamentals/testing
- Xem examples trong `src/modules/users/users.service.spec.ts`

