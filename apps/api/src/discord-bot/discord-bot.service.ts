import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  OverwriteType,
} from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePasscodeChannelParams {
  gameId: number;
  category: string;
  seasonNumber: number;
  matchNumber: number;
  passcode: string;
  leagueType: string;
  participantDiscordIds: string[];
}

export interface PostNewPasscodeParams {
  gameId: number;
  passcode: string;
  passcodeVersion: number;
}

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private readonly logger = new Logger(DiscordBotService.name);
  private isReady = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error:', error);
    });
  }

  async onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.warn('Discord bot is disabled (DISCORD_BOT_ENABLED=false)');
      return;
    }

    const token = this.getToken();
    if (!token) {
      this.logger.warn('Discord bot token not configured');
      return;
    }

    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private isEnabled(): boolean {
    return this.configService.get<string>('DISCORD_BOT_ENABLED') === 'true';
  }

  private getToken(): string | undefined {
    return this.configService.get<string>('DISCORD_BOT_TOKEN');
  }

  private getGuildId(): string | undefined {
    return this.configService.get<string>('DISCORD_GUILD_ID');
  }

  private getCategoryId(): string | undefined {
    return this.configService.get<string>('DISCORD_MATCH_ROOM_CATEGORY_ID');
  }

  private async connect(): Promise<void> {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await this.client.login(this.getToken());
        this.logger.log('Discord bot connected successfully');
        return;
      } catch (error) {
        retries++;
        this.logger.error(
          `Discord connection attempt ${retries}/${maxRetries} failed:`,
          error,
        );
        if (retries < maxRetries) {
          await this.sleep(Math.pow(2, retries) * 1000);
        }
      }
    }

    this.logger.error('Discord bot failed to connect after max retries');
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.isReady = false;
      this.logger.log('Discord bot disconnected');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a private passcode channel for match participants
   */
  async createPasscodeChannel(
    params: CreatePasscodeChannelParams,
  ): Promise<string | null> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping channel creation');
      return null;
    }

    const guildId = this.getGuildId();
    if (!guildId) {
      this.logger.warn('Discord guild ID not configured');
      return null;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const channelName = `${params.category}-s${params.seasonNumber}-game${params.matchNumber}`;

      // Build permission overwrites
      const permissionOverwrites: Array<{
        id: string;
        type: OverwriteType;
        deny?: bigint[];
        allow?: bigint[];
      }> = [
        // Deny @everyone
        {
          id: guild.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        // Allow bot itself
        {
          id: this.client.user!.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];

      // Allow participants (skip invalid Discord IDs)
      for (const discordId of params.participantDiscordIds) {
        // Discord snowflake IDs are 17-19 digit numbers
        if (!/^\d{17,19}$/.test(discordId)) {
          this.logger.debug(`Skipping invalid Discord ID: ${discordId}`);
          continue;
        }
        permissionOverwrites.push({
          id: discordId,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: this.getCategoryId() || undefined,
        permissionOverwrites,
      });

      // Post initial passcode message
      const matchUrl = `https://fz99lounge.com/matches/${params.category}/${params.seasonNumber}/${params.matchNumber}`;
      const leagueDisplay = params.leagueType.replace(/_/g, ' ');

      await channel.send({
        content: '@here',
        embeds: [
          {
            title: `${leagueDisplay} passcode: ${params.passcode}`,
            color: 0x00ff00,
            fields: [
              {
                name: 'Score Submission',
                value: `Submit your scores here: ${matchUrl}`,
                inline: false,
              },
              {
                name: 'Streamers',
                value: 'Please hide the passcode on your stream!',
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Save channel ID to database
      await this.prisma.game.update({
        where: { id: params.gameId },
        data: { discordChannelId: channel.id },
      });

      this.logger.log(
        `Created Discord channel ${channelName} (${channel.id}) for game ${params.gameId}`,
      );

      return channel.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Discord channel for game ${params.gameId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Post new passcode to existing channel (for Split Vote)
   */
  async postNewPasscode(params: PostNewPasscodeParams): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping passcode post');
      return false;
    }

    try {
      const game = await this.prisma.game.findUnique({
        where: { id: params.gameId },
        select: { discordChannelId: true },
      });

      if (!game?.discordChannelId) {
        this.logger.debug(`No Discord channel found for game ${params.gameId}`);
        return false;
      }

      const channel = await this.client.channels.fetch(game.discordChannelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Channel ${game.discordChannelId} not found or not text-based`,
        );
        return false;
      }

      await (channel as TextChannel).send({
        content: '@here',
        embeds: [
          {
            title: `New Passcode: ${params.passcode}`,
            description: 'Split Vote triggered. Please rejoin with the new passcode.',
            color: 0xffaa00,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      this.logger.log(
        `Posted new passcode to channel ${game.discordChannelId} for game ${params.gameId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post new passcode for game ${params.gameId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Post cancellation message to existing channel
   */
  async postCancellationMessage(gameId: number): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping cancellation message');
      return false;
    }

    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: { discordChannelId: true },
      });

      if (!game?.discordChannelId) {
        this.logger.debug(`No Discord channel found for game ${gameId}`);
        return false;
      }

      const channel = await this.client.channels.fetch(game.discordChannelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Channel ${game.discordChannelId} not found or not text-based`,
        );
        return false;
      }

      await (channel as TextChannel).send({
        embeds: [
          {
            title: 'Match Cancelled',
            description: 'This match has been cancelled by an administrator.',
            color: 0xff0000,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      this.logger.log(
        `Posted cancellation message to channel ${game.discordChannelId} for game ${gameId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post cancellation message for game ${gameId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Delete passcode channel when match is finalized or cancelled
   */
  async deletePasscodeChannel(gameId: number): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping channel deletion');
      return false;
    }

    try {
      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: { discordChannelId: true },
      });

      if (!game?.discordChannelId) {
        this.logger.debug(`No Discord channel to delete for game ${gameId}`);
        return true;
      }

      try {
        const channel = await this.client.channels.fetch(game.discordChannelId);
        if (channel) {
          await channel.delete('Match finalized');
          this.logger.log(
            `Deleted Discord channel ${game.discordChannelId} for game ${gameId}`,
          );
        }
      } catch (fetchError) {
        // Channel might already be deleted
        this.logger.debug(
          `Channel ${game.discordChannelId} not found, may already be deleted`,
        );
      }

      // Clear channel ID in database
      await this.prisma.game.update({
        where: { id: gameId },
        data: { discordChannelId: null },
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete Discord channel for game ${gameId}:`,
        error,
      );
      return false;
    }
  }
}
