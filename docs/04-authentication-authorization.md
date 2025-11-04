# Authentication & Authorization

## Tổng quan

Hệ thống sử dụng **JWT-based authentication** kết hợp với **RBAC/ABAC authorization** để bảo vệ API endpoints.

## Authentication Flow

### Registration

```
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Process:**
1. Validate input (email format, password strength)
2. Hash password với bcrypt (12 salt rounds)
3. Create user trong database
4. Assign default USER role
5. Generate email verification token
6. Send verification email qua queue
7. Return user info (without password)

### Login

```
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Process:**
1. Find user by email
2. Verify password với bcrypt
3. Check email verification status (optional)
4. Generate JWT access token (15-30 min expiry)
5. Generate refresh token (7-30 days expiry)
6. Optionally store refresh token in database hoặc cookie
7. Return tokens và user info

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user-1",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["USER"],
    "permissions": ["user.read", "user.update"]
  }
}
```

### Email Verification

```
GET /auth/verify-email?token=verification_token
```

**Process:**
1. Verify token từ email
2. Update `emailVerified = true` và `emailVerifiedAt`
3. Invalidate token
4. Return success message

### Refresh Token

```
POST /auth/refresh
{
  "refreshToken": "refresh_token_here"
}
```

**Process:**
1. Verify refresh token signature
2. Check token không expired
3. Optionally validate token trong database
4. Generate new access token
5. Optionally rotate refresh token
6. Return new tokens

## JWT Token Structure

### Access Token Payload

```json
{
  "sub": "user-1",
  "email": "user@example.com",
  "tenantId": "tenant-1",
  "roles": ["USER"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Refresh Token

Refresh token có thể là:
- **JWT token** với longer expiry
- **Random string** stored trong database
- **HttpOnly cookie** (recommended cho security)

## JWT Strategy

### Implementation

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.userRoles.map(ur => ur.role.name),
      permissions: // extract from rolePermissions
    };
  }
}
```

## Guards

### JwtAuthGuard

Verify JWT token và authenticate user:

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get('profile')
  getProfile(@Request() req) {
    return req.user; // User object từ JWT strategy
  }
}
```

### RolesGuard

Check user roles:

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  @Delete(':id')
  @Roles('ADMIN', 'USER_MANAGER')
  async remove(@Param('id') id: string) {
    // Only ADMIN or USER_MANAGER can delete users
  }
}
```

### AbacGuard

Evaluate ABAC policies:

```typescript
@Controller('files')
@UseGuards(JwtAuthGuard, AbacGuard)
export class FilesController {
  @Get(':id')
  @AbacPolicy('file.read')
  async findOne(@Param('id') id: string) {
    // ABAC policy evaluation
  }
}
```

## Request Flow với Authentication

```
Request
  ↓
JwtAuthGuard (Verify JWT token)
  ↓
JwtStrategy.validate() (Load user data)
  ↓
RolesGuard (Check roles) - if applied
  ↓
AbacGuard (Evaluate policies) - if applied
  ↓
Controller Handler
  ↓
Response
```

## Password Security

### Hashing

- **Algorithm**: bcrypt
- **Salt Rounds**: 12 (configurable)
- **Never store plain passwords**

### Password Validation

```typescript
// DTO validation
@IsString()
@MinLength(8)
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
  message: 'Password must contain uppercase, lowercase, number and special character',
})
password: string;
```

### Password Reset Flow

1. User requests password reset
2. Generate secure reset token
3. Send email với reset link
4. User clicks link và enters new password
5. Verify token và update password
6. Invalidate token

## Security Best Practices

### 1. Token Management

- **Short-lived access tokens** (15-30 minutes)
- **Long-lived refresh tokens** (7-30 days)
- **Token rotation** cho refresh tokens
- **Token revocation** support

### 2. HTTPS Only

- Always use HTTPS trong production
- Enforce HTTPS với HSTS headers
- Secure cookies với `Secure` flag

### 3. Token Storage

**Client-side:**
- **Access token**: In-memory (JavaScript variable)
- **Refresh token**: HttpOnly cookie (recommended) hoặc secure storage

**Server-side:**
- Optionally store refresh tokens trong database
- Track active sessions
- Support token blacklisting

### 4. Rate Limiting

Implement rate limiting cho auth endpoints:

```typescript
@Throttle(5, 60) // 5 requests per minute
@Post('login')
async login(@Body() dto: LoginDto) {
  // login logic
}
```

### 5. Input Validation

- Validate all inputs với class-validator
- Sanitize inputs
- Prevent injection attacks

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Email Verification
EMAIL_VERIFICATION_REQUIRED=true
VERIFICATION_TOKEN_EXPIRES_IN=24h

# Password
BCRYPT_ROUNDS=12
```

## Testing Authentication

### Unit Tests

```typescript
describe('AuthService', () => {
  it('should hash password correctly', async () => {
    const password = 'Test123!';
    const hashed = await bcrypt.hash(password, 12);
    expect(await bcrypt.compare(password, hashed)).toBe(true);
  });
  
  it('should generate valid JWT token', async () => {
    const token = await authService.login(loginDto);
    expect(token.accessToken).toBeDefined();
    expect(token.refreshToken).toBeDefined();
  });
});
```

### E2E Tests

```typescript
describe('Auth E2E', () => {
  it('should register and login', async () => {
    // Register
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@test.com', password: 'Test123!' });
    
    expect(registerResponse.status).toBe(201);
    
    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'Test123!' });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **Token expired**
   - Check token expiry time
   - Use refresh token để get new access token
   - Increase expiry time cho development

2. **Invalid token**
   - Verify JWT_SECRET matches
   - Check token format
   - Ensure token không bị tampered

3. **Unauthorized access**
   - Check user có đúng roles không
   - Verify ABAC policies
   - Review guard configurations

4. **Password verification fails**
   - Verify bcrypt hashing matches
   - Check password encoding
   - Ensure salt rounds consistent

## References

- Xem [RBAC & ABAC](./02-rbac-abac.md) để hiểu authorization
- Xem code tại `src/modules/auth/`
- Xem JWT strategy tại `src/modules/auth/strategies/jwt.strategy.ts`

