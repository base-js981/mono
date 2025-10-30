import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../shared/prisma.service';
import { JwtPayload } from '../types/jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-key',
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
      throw new UnauthorizedException('User not found');
    }

    // Flatten permissions
    const permissions = user.userRoles.flatMap(ur =>
      ur.role.rolePermissions.map(rp => rp.permission.name),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map(ur => ur.role.name),
      permissions,
      // ABAC attributes
      department: user.department,
      tenantId: user.tenantId,
      clearanceLevel: user.clearanceLevel,
    };
  }
}

