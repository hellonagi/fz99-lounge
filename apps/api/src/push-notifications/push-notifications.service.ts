import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Configure web-push with VAPID keys
    const vapidPublicKey = this.configService.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get('VAPID_SUBJECT');

    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('VAPID keys configured');
    } else {
      this.logger.warn(
        'VAPID keys not configured. Push notifications will not work. ' +
          'Run: npx web-push generate-vapid-keys',
      );
    }
  }

  async subscribe(userId: number, subscription: PushSubscriptionJSON) {
    const { endpoint, keys } = subscription;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('Invalid subscription object');
    }

    // Save subscription to database
    await this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint,
        },
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    this.logger.log(`Push subscription saved for user ${userId}`);
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });

    this.logger.log(`Push subscription removed for user ${userId}`);
  }

  async sendNotification(
    userId: number,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      data?: any;
      actions?: Array<{ action: string; title: string; icon?: string }>;
    },
  ) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      this.logger.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    const notificationPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            notificationPayload,
          );
          this.logger.log(`Push notification sent to user ${userId}`);
        } catch (error: any) {
          // If subscription is no longer valid, remove it
          if (error.statusCode === 410) {
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
            this.logger.warn(`Removed invalid subscription for user ${userId}`);
          } else {
            this.logger.error(`Failed to send push notification:`, error);
            throw error;
          }
        }
      }),
    );

    return results;
  }

  async notifyMatchStart(game: {
    id: number;
    passcode: string;
    leagueType: string;
    totalPlayers: number;
    url: string;
    match: {
      participants: Array<{ userId: number }>;
    };
  }) {
    const participantIds = game.match.participants.map((p) => p.userId);

    this.logger.log(
      `Sending match start notifications to ${participantIds.length} participants`,
    );

    const results = await Promise.allSettled(
      participantIds.map((userId) =>
        this.sendNotification(userId, {
          title: '🎮 マッチが開始されました！',
          body: `パスコード: ${game.passcode}`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: {
            gameId: game.id,
            passcode: game.passcode,
            url: game.url,
          },
          actions: [
            {
              action: 'open-game',
              title: 'ゲームページを開く',
            },
          ],
        }),
      ),
    );

    return results;
  }
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
