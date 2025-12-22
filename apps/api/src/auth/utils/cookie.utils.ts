import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

export const COOKIE_NAME = 'jwt';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
}

export function getCookieOptions(configService: ConfigService): CookieOptions {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

export function setAuthCookie(
  res: Response,
  token: string,
  configService: ConfigService,
): void {
  const options = getCookieOptions(configService);
  res.cookie(COOKIE_NAME, token, options);
}

export function clearAuthCookie(
  res: Response,
  configService: ConfigService,
): void {
  const options = getCookieOptions(configService);
  res.clearCookie(COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}
