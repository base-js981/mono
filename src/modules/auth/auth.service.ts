import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { AuthResponseDto } from './dtos/auth-response.dto';
import { EmailQueueService } from '../email/email-queue.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailQueueService: EmailQueueService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string; user: { id: string; email: string; name: string | null } }> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    return this.prisma.$transaction(async (tx) => {
      // Get USER role
      const userRole = await tx.role.findUnique({
        where: { name: 'USER' },
      });

      if (!userRole) {
        throw new BadRequestException('USER role not found. Please run seed script.');
      }

      try {
        const user = await tx.user.create({
          data: {
            email: registerDto.email,
            password: hashedPassword,
            name: registerDto.name,
            emailVerified: false,
            userRoles: {
              create: {
                roleId: userRole.id,
              },
            },
          },
        });

        // Generate verification token
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await tx.emailVerificationToken.create({
          data: {
            userId: user.id,
            token,
            expiresAt,
          },
        });

        // Send verification email via queue (outside transaction)
        // Queue operation should not be inside transaction
        this.emailQueueService.sendVerificationEmail(
          user.email,
          token,
          user.name || undefined,
        ).catch((error) => {
          console.error('Failed to queue verification email:', error);
        });

        return {
          message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        };
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('User with this email already exists');
        }
        throw error;
      }
    });
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email chưa được xác nhận. Vui lòng kiểm tra email để xác nhận tài khoản.');
    }

    const mainRole = user.userRoles?.[0]?.role?.name || 'USER';
    const tokens = await this.generateTokens(user.id, user.email, mainRole, user.tenantId || undefined);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.userRoles.map(ur => ur.role.name),
      },
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestException('Token không hợp lệ');
    }

    if (verificationToken.used) {
      throw new BadRequestException('Token đã được sử dụng');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token đã hết hạn');
    }

    if (verificationToken.user.emailVerified) {
      throw new BadRequestException('Email đã được xác nhận trước đó');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      });
    });

    return { message: 'Email đã được xác nhận thành công' };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Email không tồn tại');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email đã được xác nhận');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          used: false,
        },
        data: {
          used: true,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });
    });

    // Send verification email via queue (outside transaction)
    this.emailQueueService.sendVerificationEmail(
      user.email,
      token,
      user.name || undefined,
    ).catch((error) => {
      console.error('Failed to queue verification email:', error);
    });

    return { message: 'Email xác nhận đã được gửi lại' };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user || user.deletedAt || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const mainRole = user.userRoles?.[0]?.role?.name || 'USER';
      const tokens = await this.generateTokens(user.id, user.email, mainRole, user.tenantId || undefined);

      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.userRoles.map(ur => ur.role.name),
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map(ur => ur.role.name),
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: any = { sub: userId, email, role };
    if (tenantId) {
      payload.tenantId = tenantId;
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'default-secret-key',
        expiresIn: process.env.JWT_EXPIRATION_TIME || '15m',
      } as any),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
        expiresIn: '7d',
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}

