import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { COOKIE_NAME } from '../utils/cookie.utils';

export interface JwtPayload {
  sub: number;
  discordId: string;
  username: string;
}

// Extract JWT from cookie
const extractJwtFromCookie = (req: Request): string | null => {
  if (req?.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Priority: 1. Cookie, 2. Authorization Bearer (backward compatibility)
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        permissions: { select: { permission: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('User is permanently banned');
    }

    if (user.status === 'SUSPENDED') {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        throw new UnauthorizedException('User is currently suspended');
      }
    }

    // Flatten permissions to string array for easy checking
    const { permissions, ...rest } = user;
    return {
      ...rest,
      permissions: permissions?.map((p) => p.permission) || [],
    };
  }
}
