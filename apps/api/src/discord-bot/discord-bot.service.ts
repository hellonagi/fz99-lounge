import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  inGameMode: string;
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
  isRated?: boolean;
}

const IN_GAME_MODE_DISPLAY: Record<string, string> = {
  GRAND_PRIX: 'Grand Prix',
  MIRROR_GRAND_PRIX: 'Mirror Grand Prix',
  MINI_PRIX: 'Mini Prix',
  CLASSIC_MINI_PRIX: 'Classic Mini Prix',
  PRO: 'Pro',
  CLASSIC: 'Classic',
  NINETY_NINE: 'Ninety Nine',
  TEAM_BATTLE: 'Team Battle',
};

const EVENT_CATEGORY_DISPLAY: Record<EventCategory, string> = {
  GP: 'GP',
  CLASSIC: 'Classic',
  TEAM_CLASSIC: 'Team Classic',
  TEAM_GP: 'Team GP',
  TOURNAMENT: 'Tournament',
};

function formatGameModeDisplay(inGameMode: string): string {
  return IN_GAME_MODE_DISPLAY[inGameMode] || inGameMode;
}

function formatLeagueDisplay(leagueType: string | null): string | null {
  if (!leagueType) return null;
  return (
    leagueType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) + ' League'
  );
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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
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
      this.handleReactionAdd(reaction, user).catch((error) => {
        this.logger.error('Unhandled error in handleReactionAdd:', error);
      });
    });

    this.client.on('messageReactionRemove', (reaction, user) => {
      this.handleReactionRemove(reaction, user).catch((error) => {
        this.logger.error('Unhandled error in handleReactionRemove:', error);
      });
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

  private getTournamentPasscodeChannelId(): string | undefined {
    return this.configService.get<string>('DISCORD_TOURNAMENT_PASSCODE_CHANNEL_ID');
  }

  private getTournamentRoleId(): string | undefined {
    return this.configService.get<string>('DISCORD_TOURNAMENT_ROLE_ID');
  }

  private getReactionRoleChannelId(): string | undefined {
    return this.configService.get<string>('DISCORD_REACTION_ROLE_CHANNEL_ID');
  }

  private getReactionRoleEmoji(): string {
    return this.configService.get<string>('DISCORD_REACTION_ROLE_EMOJI') || '🔔';
  }

  private getReactionRoleMessageId(): string | undefined {
    return this.configService.get<string>('DISCORD_REACTION_ROLE_MESSAGE_ID');
  }

  /**
   * Verify reaction role message exists on bot ready
   */
  private async setupReactionRoleMessage(): Promise<void> {
    const messageId = this.getReactionRoleMessageId();
    if (!messageId) {
      this.logger.debug('DISCORD_REACTION_ROLE_MESSAGE_ID not configured');
      return;
    }

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
      try {
        await textChannel.messages.fetch(messageId);
        this.logger.log(`Reaction role message verified: ${messageId}`);
      } catch {
        this.logger.warn(
          `Reaction role message ${messageId} not found in channel ${channelId}. ` +
          'Please check DISCORD_REACTION_ROLE_MESSAGE_ID is correct.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to verify reaction role message:', error);
    }
  }

  /**
   * Handle reaction add event for role assignment
   */
  private async handleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    this.logger.log(
      `ReactionAdd event: messageId=${reaction.message.id}, emoji=${reaction.emoji.name || reaction.emoji.id}, userId=${user.id}, isBot=${user.bot}`,
    );

    if (user.bot) return;

    const targetMessageId = this.getReactionRoleMessageId();
    if (!targetMessageId || reaction.message.id !== targetMessageId) {
      this.logger.log(
        `ReactionAdd skipped: targetMessageId=${targetMessageId}, reactionMessageId=${reaction.message.id}`,
      );
      return;
    }

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
    if (reactionEmoji !== targetEmoji) {
      this.logger.log(
        `ReactionAdd emoji mismatch: expected="${targetEmoji}", got="${reactionEmoji}"`,
      );
      return;
    }

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
    this.logger.log(
      `ReactionRemove event: messageId=${reaction.message.id}, emoji=${reaction.emoji.name || reaction.emoji.id}, userId=${user.id}, isBot=${user.bot}`,
    );

    if (user.bot) return;

    const targetMessageId = this.getReactionRoleMessageId();
    if (!targetMessageId || reaction.message.id !== targetMessageId) {
      this.logger.log(
        `ReactionRemove skipped: targetMessageId=${targetMessageId}, reactionMessageId=${reaction.message.id}`,
      );
      return;
    }

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
    if (reactionEmoji !== targetEmoji) {
      this.logger.log(
        `ReactionRemove emoji mismatch: expected="${targetEmoji}", got="${reactionEmoji}"`,
      );
      return;
    }

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
      const seasonLabel = params.seasonNumber === -1 ? 'unrated' : `s${params.seasonNumber}`;
      const channelName = `${params.category}-${seasonLabel}-game${params.matchNumber}`;

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

      const fields: { name: string; value: string; inline?: boolean }[] = [
        { name: 'Game Mode', value: formatGameModeDisplay(params.inGameMode) },
      ];
      const leagueDisplay = formatLeagueDisplay(params.leagueType);
      if (leagueDisplay) {
        fields.push({ name: 'League', value: leagueDisplay });
      }
      fields.push(
        { name: 'Passcode', value: params.passcode },
        { name: 'Score Submission', value: matchUrl },
      );

      const embed = new EmbedBuilder()
        .setTitle('Match Started')
        .setColor(0x3498db)
        .setDescription(
          'Please hide the passcode on your stream!\n配信者はパスコードを隠してください！',
        )
        .addFields(...fields);

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
      const seasonLabel = params.seasonNumber === -1 ? 'unrated' : `s${params.seasonNumber}`;
      const channelName = `${params.category}-${seasonLabel}-game${params.matchNumber}`;

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
          'Please check the match page and change your machine color.\n試合ページを確認して、マシンカラーを変更してください。',
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
        select: { discordChannelId: true, inGameMode: true, leagueType: true },
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

      const fields: { name: string; value: string }[] = [
        { name: 'Game Mode', value: formatGameModeDisplay(game.inGameMode) },
      ];
      const leagueDisplay = formatLeagueDisplay(game.leagueType);
      if (leagueDisplay) {
        fields.push({ name: 'League', value: leagueDisplay });
      }
      fields.push({ name: 'Passcode', value: passcode });

      const embed = new EmbedBuilder()
        .setTitle('Passcode Revealed')
        .setColor(0x3498db)
        .setDescription(
          'Please hide the passcode on your stream!\n配信者はパスコードを隠してください！',
        )
        .addFields(...fields);

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
        select: { discordChannelId: true, inGameMode: true, leagueType: true },
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

      const fields: { name: string; value: string }[] = [
        { name: 'Game Mode', value: formatGameModeDisplay(game.inGameMode) },
      ];
      const leagueDisplay = formatLeagueDisplay(game.leagueType);
      if (leagueDisplay) {
        fields.push({ name: 'League', value: leagueDisplay });
      }
      fields.push({ name: 'New Passcode', value: params.passcode });

      const embed = new EmbedBuilder()
        .setTitle('Split Vote - New Passcode')
        .setColor(0xf1c40f)
        .setDescription(
          'Split Vote triggered. Please rejoin with the new passcode.\nスプリット投票が成立しました。新しいパスコードで再参加してください。',
        )
        .addFields(...fields);

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
        .addFields({ name: 'Match Page', value: matchUrl });

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
   * Post position conflict notification to match channel
   */
  async postPositionConflictNotification(
    channelId: string,
    conflicts: Array<{
      raceNumber: number;
      users: Array<{ userName: string; discordId: string | null; position: number }>;
    }>,
    matchUrl: string,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping position conflict notification',
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

      const conflictLines = conflicts.map((c) => {
        const userLines = c.users
          .map((u) => `${u.userName} (${u.position})`)
          .join('\n');
        return `**Race ${c.raceNumber}**\n${userLines}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('Position Conflict / 順位の不整合')
        .setColor(0xf1c40f)
        .setDescription(
          conflictLines +
          '\n\n' +
          'A position conflict was detected. One or more players above may have submitted an incorrect position. ' +
          'Please check your results and resubmit if needed.\n\n' +
          '上記プレイヤー間で順位の不整合が検出されました。' +
          '誤った順位で提出していないか確認し、必要であれば再提出してください。',
        )
        .addFields({ name: 'Match Page', value: matchUrl });

      // Mention all involved users with Discord IDs
      const mentions = conflicts
        .flatMap((c) => c.users)
        .filter((u) => u.discordId)
        .map((u) => `<@${u.discordId}>`)
        .filter((v, i, a) => a.indexOf(v) === i) // dedupe
        .join(' ');

      await (channel as TextChannel).send({
        content: mentions || undefined,
        embeds: [embed],
      });

      this.logger.log(
        `Posted position conflict notification to channel ${channelId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post position conflict notification to channel ${channelId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Post score submission reminder to match channel, mentioning unsubmitted players
   */
  async postScoreSubmissionReminder(
    channelId: string,
    unsubmittedDiscordIds: string[],
    matchUrl: string,
    deadline: Date,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug('Discord bot not ready or disabled, skipping score submission reminder');
      return false;
    }

    if (unsubmittedDiscordIds.length === 0) return false;

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`Channel ${channelId} not found or not text-based`);
        return false;
      }

      const mentions = unsubmittedDiscordIds.map((id) => `<@${id}>`).join(' ');

      // Discord auto-localizes <t:UNIX:t> to the viewer's timezone
      const deadlineUnix = Math.floor(deadline.getTime() / 1000);
      const deadlineStr = `<t:${deadlineUnix}:t> (<t:${deadlineUnix}:R>)`;

      const embed = new EmbedBuilder()
        .setTitle('Score Submission Reminder / スコア提出リマインダー')
        .setColor(0xf39c12)
        .setDescription(
          `Please submit your score on the match page.\n` +
          `If not submitted by **${deadlineStr}**, your score will be counted as 0 points.\n\n` +
          `試合ページからスコアを提出してください。\n` +
          `**${deadlineStr}** までに未提出の場合、0ポイント扱いになります。`,
        )
        .addFields({ name: 'Match Page', value: matchUrl });

      await (channel as TextChannel).send({ content: mentions, embeds: [embed] });

      this.logger.log(
        `Posted score submission reminder to channel ${channelId} for ${unsubmittedDiscordIds.length} users`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to post score submission reminder to channel ${channelId}:`,
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
    isRated?: boolean;
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

      const unratedLabel = params.isRated === false ? ' [Unrated]' : '';
      const embed = new EmbedBuilder()
        .setTitle(`Match Results${unratedLabel}`)
        .setColor(params.isRated === false ? 0x808080 : 0xf39c12)
        .setDescription(description)
        .setFooter({
          text:
            'This channel will be deleted in 24 hours. If you wish to dispute the result, please report it in this channel within 24 hours.\n' +
            'このチャンネルは24時間後に削除されます。結果に異議がある場合は24時間以内にこのチャンネル内で報告してください。',
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

      const message = await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      if (channel.type === ChannelType.GuildAnnouncement) {
        await message.crosspost();
      }

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
      const seasonSlug =
        params.seasonNumber === -1 ? 'unrated' : params.seasonNumber;
      const matchUrl = `${baseUrl}/matches/${params.category}/${seasonSlug}/${params.matchNumber}`;

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
      const unratedLabel = params.isRated === false ? ' [Unrated]' : '';
      const seasonLabelEn =
        params.seasonNumber === -1 ? 'Unrated' : `Season${params.seasonNumber}`;
      const seasonLabelJa =
        params.seasonNumber === -1 ? 'Unrated' : `シーズン${params.seasonNumber}`;
      const embed = new EmbedBuilder()
        .setTitle(`Match Results${unratedLabel}`)
        .setColor(params.isRated === false ? 0x808080 : 0xf39c12)
        .setDescription(
          `${params.seasonName} ${seasonLabelEn} #${params.matchNumber} has been finalized!\n${params.seasonName} ${seasonLabelJa} #${params.matchNumber} の結果が確定しました!\n\n${resultLines}`,
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

  /**
   * Announce today's lounge schedule to the match announce channel.
   * Posts a single message listing each match's start time and category.
   */
  async announceDailyLoungeSchedule(
    entries: Array<{ scheduledStart: Date; category: EventCategory }>,
  ): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping daily lounge announcement',
      );
      return false;
    }

    const channelId = this.getMatchAnnounceChannelId();
    if (!channelId) {
      this.logger.warn('Match announce channel not configured');
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

      const lines = entries.map((e) => {
        const ts = Math.floor(e.scheduledStart.getTime() / 1000);
        return `<t:${ts}:f>  ${EVENT_CATEGORY_DISPLAY[e.category]}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("Today's Lounge")
        .setColor(0x3498db)
        .setDescription(lines.join('\n'))
        .addFields({ name: 'Join', value: `👉 ${baseUrl}` });

      const message = await (channel as TextChannel).send({ embeds: [embed] });

      // Auto-publish if the channel is an announcement channel
      if (channel.type === ChannelType.GuildAnnouncement) {
        await message.crosspost();
        this.logger.log(
          `Published daily lounge announcement to channel ${channelId}`,
        );
      }

      this.logger.log(
        `Announced today's lounge schedule (${entries.length} matches) to channel ${channelId}`,
      );
      return true;
    } catch (error) {
      this.logger.error("Failed to announce today's lounge schedule:", error);
      return false;
    }
  }

  /**
   * Announce tournament countdown started to tournament channel.
   * Returns the message ID so it can be deleted when passcode is revealed.
   */
  async announceTournamentCountdownStarted(params: {
    tournamentName: string;
    roundLabel: string;
    inGameMode: string;
    league?: string;
    passcodeRevealTime: Date;
    description?: string;
  }): Promise<string | null> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping tournament countdown announcement',
      );
      return null;
    }

    const channelId = this.getTournamentPasscodeChannelId();
    if (!channelId) {
      this.logger.debug('Tournament passcode channel not configured');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Tournament passcode channel ${channelId} not found or not text-based`,
        );
        return null;
      }

      const revealTs = Math.floor(params.passcodeRevealTime.getTime() / 1000);

      const roleId = this.getTournamentRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      const fields = [
        { name: 'Game Mode', value: params.inGameMode.replace(/_/g, ' '), inline: true },
      ];
      if (params.league) {
        fields.push({ name: 'League', value: params.league.replace(/_/g, ' '), inline: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${params.tournamentName} — ${params.roundLabel}`)
        .setColor(0x9b59b6)
        .setDescription(params.description || `Passcode reveals <t:${revealTs}:R>`)
        .addFields(fields);

      const message = await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced tournament countdown for ${params.roundLabel} to channel ${channelId}`,
      );
      return message.id;
    } catch (error) {
      this.logger.error(
        `Failed to announce tournament countdown for ${params.roundLabel}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Announce tournament passcode revealed to tournament channel.
   * Deletes the countdown message if provided.
   */
  async announceTournamentPasscodeRevealed(params: {
    tournamentName: string;
    roundLabel: string;
    inGameMode: string;
    league?: string;
    passcode: string;
    scoreUrl: string;
    countdownMessageId?: string;
  }): Promise<string | null> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping tournament passcode announcement',
      );
      return null;
    }

    const channelId = this.getTournamentPasscodeChannelId();
    if (!channelId) {
      this.logger.debug('Tournament passcode channel not configured');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Tournament passcode channel ${channelId} not found or not text-based`,
        );
        return null;
      }

      // Delete countdown message
      if (params.countdownMessageId) {
        try {
          const msg = await (channel as TextChannel).messages.fetch(params.countdownMessageId);
          await msg.delete();
        } catch {
          this.logger.debug('Could not delete countdown message, may already be deleted');
        }
      }

      const roleId = this.getTournamentRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      const fields = [
        { name: 'Game Mode', value: params.inGameMode.replace(/_/g, ' '), inline: true },
      ];
      if (params.league) {
        fields.push({ name: 'League', value: params.league.replace(/_/g, ' '), inline: true });
      }
      fields.push({ name: 'Passcode', value: `**${params.passcode}**`, inline: false });
      fields.push({ name: 'Score Submission', value: params.scoreUrl, inline: false });

      const embed = new EmbedBuilder()
        .setTitle(`${params.roundLabel} Started`)
        .setColor(0x2ecc71)
        .setDescription(
          'Please hide the passcode on your stream!\n配信者はパスコードを隠してください！',
        )
        .addFields(fields);

      const message = await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced tournament passcode for ${params.roundLabel} to channel ${channelId}`,
      );
      return message.id;
    } catch (error) {
      this.logger.error(
        `Failed to announce tournament passcode for ${params.roundLabel}:`,
        error,
      );
      return null;
    }
  }

  async announceTournamentSplit(params: {
    tournamentName: string;
    roundLabel: string;
  }): Promise<string | null> {
    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping tournament split announcement',
      );
      return null;
    }

    const channelId = this.getTournamentPasscodeChannelId();
    if (!channelId) {
      this.logger.debug('Tournament passcode channel not configured');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(
          `Tournament passcode channel ${channelId} not found or not text-based`,
        );
        return null;
      }

      const roleId = this.getTournamentRoleId();
      const roleMention = roleId ? `<@&${roleId}>` : undefined;

      const embed = new EmbedBuilder()
        .setTitle(`${params.tournamentName} — ${params.roundLabel}`)
        .setColor(0xe74c3c)
        .setDescription(
          'A lobby split has occurred. Please exit the lobby.\nThe passcode will be regenerated within 2 minutes.\n\n部屋が分かれました。ロビーから退出してください。\n2分以内にパスコードを再生成します。',
        );

      const message = await (channel as TextChannel).send({ content: roleMention, embeds: [embed] });

      this.logger.log(
        `Announced tournament split for ${params.roundLabel} to channel ${channelId}`,
      );
      return message.id;
    } catch (error) {
      this.logger.error(
        `Failed to announce tournament split for ${params.roundLabel}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Delete a message from the tournament passcode channel
   */
  async deleteTournamentMessage(messageId: string): Promise<boolean> {
    if (!this.isReady || !this.isEnabled()) return false;

    const channelId = this.getTournamentPasscodeChannelId();
    if (!channelId) return false;

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return false;
      const msg = await (channel as TextChannel).messages.fetch(messageId);
      await msg.delete();
      this.logger.log(`Deleted tournament message ${messageId}`);
      return true;
    } catch {
      this.logger.debug(`Could not delete tournament message ${messageId}`);
      return false;
    }
  }

  /**
   * Assign tournament role to a list of Discord users
   */
  async assignTournamentRole(
    discordIds: string[],
  ): Promise<{ assigned: number; alreadyHad: number; notInServer: string[] }> {
    const result = { assigned: 0, alreadyHad: 0, notInServer: [] as string[] };

    if (!this.isReady || !this.isEnabled()) {
      this.logger.debug(
        'Discord bot not ready or disabled, skipping tournament role assignment',
      );
      return result;
    }

    const roleId = this.getTournamentRoleId();
    if (!roleId) {
      this.logger.debug('Tournament role ID not configured');
      return result;
    }

    const guildId = this.getGuildId();
    if (!guildId) {
      this.logger.debug('Guild ID not configured');
      return result;
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);

      for (const discordId of discordIds) {
        try {
          const member = await guild.members.fetch(discordId);
          if (member.roles.cache.has(roleId)) {
            result.alreadyHad++;
          } else {
            await member.roles.add(roleId);
            result.assigned++;
          }
        } catch (error: any) {
          // Unknown Member — user not in the server
          if (error.code === 10007 || error.code === 10013) {
            result.notInServer.push(discordId);
          } else {
            this.logger.warn(
              `Failed to assign role to ${discordId}: ${error.message}`,
            );
            result.notInServer.push(discordId);
          }
        }
        // Rate limit protection
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.logger.log(
        `Tournament role assignment: assigned=${result.assigned}, alreadyHad=${result.alreadyHad}, notInServer=${result.notInServer.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to assign tournament roles:', error);
      return result;
    }
  }
}
