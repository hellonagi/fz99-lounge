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
  Partials,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  OverwriteType,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  EmbedBuilder,
} from 'discord.js';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTeamSetupChannelParams {
  gameId: number;
  category: string;
  seasonNumber: number;
  matchNumber: number;
  participantDiscordIds: string[];
  matchUrl: string;
  teams: Array<{
    label: string;
    memberNames: string[];
  }>;
}

export interface CreatePasscodeChannelParams {
  gameId: number;
  category: string;
  seasonNumber: number;
  matchNumber: number;
  passcode: string;
  leagueType: string | null;
  participantDiscordIds: string[];
}

export interface PostNewPasscodeParams {
  gameId: number;
  passcode: string;
  passcodeVersion: number;
}

export interface AnnounceMatchCreatedParams {
  matchNumber: number;
  seasonNumber: number;
  category: string;
  seasonName: string;
  inGameMode: string;
  leagueType: string | null;
  scheduledStart: Date;
  minPlayers: number;
  maxPlayers: number;
  creatorDisplayName: string;
}

export interface AnnounceMatchReminderParams {
  matchNumber: number;
  seasonNumber: number;
  category: string;
  seasonName: string;
}

export interface AnnounceMatchCancelledParams {
  matchNumber: number;
  seasonNumber: number;
  category: string;
  seasonName: string;
  reason?: 'insufficient_players' | 'admin_cancelled' | 'invalid_player_count';
}

export interface MatchResultParticipant {
  position: number;
  displayName: string;
  totalScore: number;
}

export interface AnnounceMatchResultsParams {
  matchNumber: number;
  seasonNumber: number;
  category: string;
  seasonName: string;
  topParticipants: MatchResultParticipant[];
  topTeams?: { teamLabel: string; score: number; rank: number; members: string[] }[];
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
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Reaction, Partials.User],
    });

    this.client.on('ready', async () => {
      this.isReady = true;
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
      await this.setupReactionRoleMessage();
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error:', error);
    });

    this.client.on('messageReactionAdd', (reaction, user) => {
      this.handleReactionAdd(reaction, user);
    });

    this.client.on('messageReactionRemove', (reaction, user) => {
      this.handleReactionRemove(reaction, user);
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

  private getMatchAnnounceChannelId(): string | undefined {
    return this.configService.get<string>('DISCORD_MATCH_ANNOUNCE_CHANNEL_ID');
  }

  private getMatchNotifyRoleId(): string | undefined {
    return this.configService.get<string>('DISCORD_MATCH_NOTIFY_ROLE_ID');
  }

  private getReactionRoleChannelId(): string | undefined {
    return this.configService.get<string>('DISCORD_REACTION_ROLE_CHANNEL_ID');
  }

  private getReactionRoleEmoji(): string {
    return this.configService.get<string>('DISCORD_REACTION_ROLE_EMOJI') || '🔔';
  }

  private async getReactionRoleMessageId(): Promise<string | undefined> {
    const config = await this.prisma.discordBotConfig.findUnique({
      where: { key: 'reaction_role_message_id' },
    });
    return config?.value;
  }

  private async setReactionRoleMessageId(messageId: string): Promise<void> {
    await this.prisma.discordBotConfig.upsert({
      where: { key: 'reaction_role_message_id' },
      update: { value: messageId },
      create: { key: 'reaction_role_message_id', value: messageId },
    });
  }

  /**
   * Setup reaction role message on bot ready
   */
  private async setupReactionRoleMessage(): Promise<void> {
    const channelId = this.getReactionRoleChannelId();
    if (!channelId) {
      this.logger.debug('Reaction role channel not configured');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`Reaction role channel ${channelId} not found or not text-based`);
        return;
      }

      const textChannel = channel as TextChannel;
      const existingMessageId = await this.getReactionRoleMessageId();

      // Check if existing message still exists
      if (existingMessageId) {
        try {
          await textChannel.messages.fetch(existingMessageId);
          this.logger.log(`Reaction role message already exists: ${existingMessageId}`);
          return;
        } catch {
          this.logger.log('Existing reaction role message not found, creating new one');
        }
      }

      // Create new message
      const emoji = this.getReactionRoleEmoji();
      const messageContent = `**Match Notifications / 試合通知設定**

React with the ${emoji} emoji to receive notifications when a new match is created.
Remove your reaction to stop receiving notifications.

このメッセージに ${emoji} の絵文字でリアクションすると、新しい試合が作成されたときに通知が届きます。
外すと通知は止まります。`;

      const message = await textChannel.send({ content: messageContent });
      await message.react(emoji);
      await this.setReactionRoleMessageId(message.id);

      this.logger.log(`Created reaction role message: ${message.id}`);
    } catch (error) {
      this.logger.error('Failed to setup reaction role message:', error);
    }
  }

  /**
   * Handle reaction add event for role assignment
   */
  private async handleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (user.bot) return;

    const targetMessageId = await this.getReactionRoleMessageId();
    if (!targetMessageId || reaction.message.id !== targetMessageId) return;

    // Fetch partial reaction if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        this.logger.error('Failed to fetch reaction:', error);
        return;
      }
    }

    // Check emoji
    const targetEmoji = this.getReactionRoleEmoji();
    const reactionEmoji = reaction.emoji.name || reaction.emoji.id;
    if (reactionEmoji !== targetEmoji) return;

    // Add role
    const roleId = this.getMatchNotifyRoleId();
    if (!roleId) {
      this.logger.warn('Match notify role ID not configured');
      return;
    }

    try {
      const guildId = this.getGuildId();
      if (!guildId) return;

      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(user.id);

      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
        this.logger.log(`Added match notify role to user ${user.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to add role to user ${user.id}:`, error);
    }
  }

  /**
   * Handle reaction remove event for role removal
   */
  private async handleReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (user.bot) return;

    const targetMessageId = await this.getReactionRoleMessageId();
    if (!targetMessageId || reaction.message.id !== targetMessageId) return;

    // Fetch partial reaction if needed
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        this.logger.error('Failed to fetch reaction:', error);
        return;
      }
    }

    // Check emoji
    const targetEmoji = this.getReactionRoleEmoji();
    const reactionEmoji = reaction.emoji.name || reaction.emoji.id;
    if (reactionEmoji !== targetEmoji) return;

    // Remove role
    const roleId = this.getMatchNotifyRoleId();
    if (!roleId) return;

    try {
      const guildId = this.getGuildId();
      if (!guildId) return;

      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(user.id);

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        this.logger.log(`Removed match notify role from user ${user.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove role from user ${user.id}:`, error);
    }
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
      const baseUrl = this.configService.get<string>('CORS_ORIGIN') || 'https://fz99lounge.com';
      const matchUrl = `${baseUrl}/matches/${params.category}/${params.seasonNumber}/${params.matchNumber}`;
      const leagueDisplay = params.leagueType
        ? params.leagueType
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Classic';

      const embed = new EmbedBuilder()
        .setTitle(`${leagueDisplay}\npasscode: ${params.passcode}`)
        .setColor(0x3498db)
        .setDescription(
          'Please hide the passcode on your stream!\n配信者はパスコードを隠してください！',
        )
        .addFields({ name: 'Score Submission', value: matchUrl });

      await channel.send({ content: '@here', embeds: [embed] });

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
   * Create a private channel for TEAM_CLASSIC match setup (before passcode reveal)
   */
  async createTeamSetupChannel(
    params: CreateTeamSetupChannelParams,
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
        {
          id: guild.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
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

      for (const discordId of params.participantDiscordIds) {
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

      // Build team fields
      const teamFields = params.teams.map((team) => {
        const members = team.memberNames.join('\n');
        return { name: `Team ${team.label}`, value: members, inline: true };
      });

      const embed = new EmbedBuilder()
        .setTitle('Match Setup')
        .setColor(0x3498db)
        .setDescription(
          'Please check the match page, and change your machine color and name.\n試合ページを確認して、マシンカラーと名前を変更してください。',
        )
        .addFields(
          ...teamFields,
          { name: 'Match Page', value: params.matchUrl },
        );

      await channel.send({ content: '@here', embeds: [embed] });

      // Save channel ID to database
      await this.prisma.game.update({
        where: { id: params.gameId },
        data: { discordChannelId: channel.id },
      });

      this.logger.log(
        `Created team setup channel ${channelName} (${channel.id}) for game ${params.gameId}`,
      );

      return channel.id;
    } catch (error) {
      this.logger.error(
        `Failed to create team setup channel for game ${params.gameId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Post passcode to an existing Discord channel (for TEAM_CLASSIC passcode reveal)
   */
  async postPasscodeToChannel(gameId: number, passcode: string): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping passcode post');
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

      const embed = new EmbedBuilder()
        .setTitle(`passcode: ${passcode}`)
        .setColor(0x3498db)
        .setDescription(
          'Please hide the passcode on your stream!\n配信者はパスコードを隠してください！',
        );

      await (channel as TextChannel).send({ content: '@here', embeds: [embed] });

      this.logger.log(
        `Posted passcode to channel ${game.discordChannelId} for game ${gameId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post passcode to channel for game ${gameId}:`,
        error,
      );
      return false;
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

      const embed = new EmbedBuilder()
        .setTitle(`New Passcode: ${params.passcode}`)
        .setColor(0xf1c40f)
        .setDescription(
          'Split Vote triggered. Please rejoin with the new passcode.\nスプリット投票が成立しました。新しいパスコードで再参加してください。',
        );

      await (channel as TextChannel).send({ content: '@here', embeds: [embed] });

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
   * Post screenshot request to channel with user mention
   */
  async postScreenshotRequest(
    channelId: string,
    discordId: string,
    matchUrl: string,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping screenshot request',
      );
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Channel ${channelId} not found or not text-based`,
        );
        return false;
      }

      const embed = new EmbedBuilder()
        .setTitle('Score Rejected / スコアが却下されました')
        .setColor(0xe74c3c)
        .setDescription(
          'Your score has been rejected by a moderator. Please:\n' +
          '1. Resubmit your score on the match page\n' +
          '2. Post your result screenshot in this channel\n\n' +
          'モデレーターによりスコアが却下されました:\n' +
          '1. 試合ページからスコアを再提出してください\n' +
          '2. 結果のスクリーンショットをこのチャンネルに投稿してください',
        )
        .addFields({ name: 'Match Page', value: matchUrl })
        .setFooter({
          text:
            'This channel will be deleted in 24 hours. If you wish to dispute the result, please report it in this channel within 24 hours.\n' +
            'このチャンネルは24時間後に削除されます。結果に異議がある場合は24時間以内にこのチャンネル内で報告してください。',
        });

      await (channel as TextChannel).send({ content: `<@${discordId}>`, embeds: [embed] });

      this.logger.log(
        `Posted screenshot request to channel ${channelId} for user ${discordId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post screenshot request to channel ${channelId}:`,
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

      const embed = new EmbedBuilder()
        .setTitle('Match Cancelled')
        .setColor(0xe74c3c)
        .setDescription(
          'This match has been cancelled by an administrator.\nこのマッチは管理者によってキャンセルされました。',
        )
        .setFooter({
          text: 'This channel will be deleted in 24 hours. / このチャンネルは24時間後に削除されます。',
        });

      await (channel as TextChannel).send({ embeds: [embed] });

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
   * Post match results embed to the match channel
   */
  async postMatchResultsToChannel(params: {
    gameId: number;
    participants: Array<{
      position: number;
      displayName: string;
      totalScore: number;
    }>;
    allTeams?: Array<{ label: string; score: number; rank: number; members: string[] }>;
  }): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping match results to channel');
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

      // Build result lines
      let description: string;

      if (params.allTeams && params.allTeams.length > 0) {
        const rankEmojis: Record<number, string> = {
          1: '\u{1F947}',
          2: '\u{1F948}',
          3: '\u{1F949}',
        };

        description = params.allTeams
          .map((team) => {
            const emoji = rankEmojis[team.rank] || `${team.rank}.`;
            const members = team.members.join(', ');
            return `${emoji} **Team ${team.label}** - ${team.score}\n${members}`;
          })
          .join('\n\n');
      } else {
        const positionEmojis: Record<number, string> = {
          1: '\u{1F947}',
          2: '\u{1F948}',
          3: '\u{1F949}',
        };

        description = params.participants
          .map((p) => {
            if (p.position <= 3) {
              const emoji = positionEmojis[p.position];
              return `${emoji} **${p.displayName}** - ${p.totalScore}`;
            }
            return `${p.position}. **${p.displayName}** - ${p.totalScore}`;
          })
          .join('\n');
      }

      const embed = new EmbedBuilder()
        .setTitle('Match Results')
        .setColor(0xf39c12)
        .setDescription(description)
        .setFooter({
          text: 'This channel will be deleted in 24 hours. / このチャンネルは24時間後に削除されます。',
        });

      await (channel as TextChannel).send({ embeds: [embed] });

      this.logger.log(
        `Posted match results to channel ${game.discordChannelId} for game ${params.gameId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post match results to channel for game ${params.gameId}:`,
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

  /**
   * Announce match creation to a dedicated channel with role mention
   */
  async announceMatchCreated(
    params: AnnounceMatchCreatedParams,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping match announcement',
      );
      return false;
    }

    const channelId = this.getMatchAnnounceChannelId();
    if (!channelId) {
      this.logger.debug('Match announce channel not configured');
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Announce channel ${channelId} not found or not text-based`,
        );
        return false;
      }

      // Format the scheduled start time as Discord timestamp
      const startTime = Math.floor(params.scheduledStart.getTime() / 1000);

      // Build join link
      const baseUrl =
        this.configService.get<string>('CORS_ORIGIN') || 'https://fz99lounge.com';

      // Build role mention
      const roleId = this.getMatchNotifyRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('New match scheduled!')
        .setColor(0x3498db)
        .addFields(
          {
            name: 'Match',
            value: `${params.seasonName} season${params.seasonNumber} #${params.matchNumber}`,
          },
          { name: 'Start', value: `<t:${startTime}:F> (<t:${startTime}:R>)` },
          {
            name: 'Players',
            value: `${params.minPlayers}-${params.maxPlayers}`,
            inline: true,
          },
          { name: 'Created by', value: params.creatorDisplayName, inline: true },
          { name: 'Join', value: baseUrl },
        );

      await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced match #${params.matchNumber} creation to channel ${channelId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to announce match #${params.matchNumber} creation:`,
        error,
      );
      return false;
    }
  }

  /**
   * Announce match reminder (5 minutes before start) to announce channel
   */
  async announceMatchReminder(
    params: AnnounceMatchReminderParams,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping match reminder',
      );
      return false;
    }

    const channelId = this.getMatchAnnounceChannelId();
    if (!channelId) {
      this.logger.debug('Match announce channel not configured');
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Announce channel ${channelId} not found or not text-based`,
        );
        return false;
      }

      const baseUrl =
        this.configService.get<string>('CORS_ORIGIN') || 'https://fz99lounge.com';

      // Build role mention
      const roleId = this.getMatchNotifyRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('Match starting in 5 minutes!')
        .setColor(0xf1c40f)
        .setDescription(
          `${params.seasonName} season${params.seasonNumber} #${params.matchNumber}`,
        )
        .addFields({ name: 'Join', value: baseUrl });

      await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced match #${params.matchNumber} reminder to channel ${channelId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to announce match #${params.matchNumber} reminder:`,
        error,
      );
      return false;
    }
  }

  /**
   * Announce match cancellation to announce channel
   */
  async announceMatchCancelled(
    params: AnnounceMatchCancelledParams,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping match cancellation announcement',
      );
      return false;
    }

    const channelId = this.getMatchAnnounceChannelId();
    if (!channelId) {
      this.logger.debug('Match announce channel not configured');
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Announce channel ${channelId} not found or not text-based`,
        );
        return false;
      }

      // Build role mention
      const roleId = this.getMatchNotifyRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('Match Cancelled')
        .setColor(0xe74c3c)
        .setDescription(
          `${params.seasonName} season${params.seasonNumber} #${params.matchNumber} has been cancelled.\n${params.seasonName} シーズン${params.seasonNumber} #${params.matchNumber} はキャンセルされました。`,
        );

      // Add reason field if provided
      if (params.reason === 'insufficient_players') {
        embed.addFields({
          name: 'Reason / 理由',
          value: 'Not enough players / 参加者が規定人数に達しませんでした',
        });
      } else if (params.reason === 'admin_cancelled') {
        embed.addFields({
          name: 'Reason / 理由',
          value: 'Cancelled by administrator / 管理者によりキャンセルされました',
        });
      }

      await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced match #${params.matchNumber} cancellation to channel ${channelId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to announce match #${params.matchNumber} cancellation:`,
        error,
      );
      return false;
    }
  }

  /**
   * Announce match results to announce channel
   */
  async announceMatchResults(
    params: AnnounceMatchResultsParams,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping match results announcement',
      );
      return false;
    }

    const channelId = this.getMatchAnnounceChannelId();
    if (!channelId) {
      this.logger.debug('Match announce channel not configured');
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Announce channel ${channelId} not found or not text-based`,
        );
        return false;
      }

      const baseUrl =
        this.configService.get<string>('CORS_ORIGIN') || 'https://fz99lounge.com';
      const matchUrl = `${baseUrl}/matches/${params.category}/${params.seasonNumber}/${params.matchNumber}`;

      // Build result lines
      const rankEmojis: Record<number, string> = {
        1: '\u{1F947}', // 🥇
        2: '\u{1F948}', // 🥈
        3: '\u{1F949}', // 🥉
      };

      let resultLines: string;

      if (params.topTeams && params.topTeams.length > 0) {
        resultLines = params.topTeams
          .sort((a, b) => a.rank - b.rank)
          .map((team) => {
            const emoji = rankEmojis[team.rank] || '';
            return `${emoji} **Team ${team.teamLabel}** - ${team.score}\n${team.members.join(', ')}`;
          })
          .join('\n\n');
      } else {
        resultLines = params.topParticipants
          .map((p) => {
            const emoji = rankEmojis[p.position] || '';
            return `${emoji} **${p.displayName}** - ${p.totalScore}`;
          })
          .join('\n');
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('Match Results')
        .setColor(0xf39c12)
        .setDescription(
          `${params.seasonName} Season${params.seasonNumber} #${params.matchNumber} has been finalized!\n${params.seasonName} シーズン${params.seasonNumber} #${params.matchNumber} の結果が確定しました!\n\n${resultLines}`,
        )
        .addFields({ name: 'View results', value: matchUrl });

      await (channel as TextChannel).send({ embeds: [embed] });

      this.logger.log(
        `Announced match #${params.matchNumber} results to channel ${channelId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to announce match #${params.matchNumber} results:`,
        error,
      );
      return false;
    }
  }
}
