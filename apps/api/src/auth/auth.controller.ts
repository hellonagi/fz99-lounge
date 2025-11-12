import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginTrackingService } from './login-tracking.service';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private loginTrackingService: LoginTrackingService,
    private configService: ConfigService,
  ) {}

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  async discordLogin() {
    // Guard redirects to Discord OAuth
  }

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  async discordCallback(@Req() req: Request, @Res() res: Response) {
    const discordUser = req.user as any;
    const { accessToken, user } = await this.authService.login(discordUser);

    // Track login if enabled (default: true)
    const enableTracking = this.configService.get<string>('ENABLE_LOGIN_TRACKING', 'true') !== 'false';
    if (enableTracking && user) {
      await this.loginTrackingService.recordLogin(user.id, req, 'discord');
    }

    // Redirect to frontend with token
    const frontendUrl = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:3001');
    return res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const user = req.user as any;
    return this.usersService.findById(user.id);
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return { message: 'Logged out successfully' };
  }
}
