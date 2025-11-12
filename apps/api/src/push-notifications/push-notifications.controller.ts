import { Controller, Get, Post, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PushNotificationsService } from './push-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private pushNotificationsService: PushNotificationsService,
    private configService: ConfigService,
  ) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    const publicKey = this.configService.get('VAPID_PUBLIC_KEY');
    return { publicKey };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req: Request, @Body() subscription: any) {
    const user = req.user as any;
    await this.pushNotificationsService.subscribe(user.id, subscription);
    return { message: 'Subscription saved' };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Req() req: Request, @Body() body: { endpoint: string }) {
    const user = req.user as any;
    await this.pushNotificationsService.unsubscribe(user.id, body.endpoint);
    return { message: 'Subscription removed' };
  }
}
