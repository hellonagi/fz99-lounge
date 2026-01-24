import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventCategory, MatchStatus, ResultStatus, ScreenshotType } from '@prisma/client';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { UpdateScoreDto } from './dto/update-score.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassicRatingService } from '../rating/classic-rating.service';
import { DiscordBotService } from '../discord-bot/discord-bot.service';

export interface SplitVoteStatus {
  currentVotes: number;
  requiredVotes: number;
  hasVoted: boolean;
  passcode: string;
  passcodeVersion: number;
}

export interface SplitVoteResult {
  regenerated: boolean;
  currentVotes: number;
  requiredVotes: number;
  passcode: string;
  passcodeVersion: number;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private classicRatingService: ClassicRatingService,
    private discordBotService: DiscordBotService,
  ) {}

  async getById(gameId: number, userId?: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
                tournamentConfig: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                  },
                },
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                discordId: true,
                displayName: true,
                avatarHash: true,
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...gameWithoutPasscode } = game;
      return gameWithoutPasscode;
    }

    return game;
  }

  async getByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
    userId?: number,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
                tournamentConfig: true,
              },
            },
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    discordId: true,
                    displayName: true,
                    avatarHash: true,
                    profile: {
                      select: { country: true },
                    },
                    seasonStats: {
                      where: {
                        season: {
                          seasonNumber,
                          event: {
                            category: eventCategory,
                          },
                        },
                      },
                      select: {
                        displayRating: true,
                      },
                    },
                  },
                },
              },
            },
            ratingHistories: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                discordId: true,
                displayName: true,
                avatarHash: true,
                profile: {
                  select: { country: true },
                },
              },
            },
            raceResults: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Build rating map from rating histories
    const ratingMap = new Map<number, { displayRating: number }>();
    if (game.match?.ratingHistories) {
      for (const rh of game.match.ratingHistories) {
        ratingMap.set(rh.userId, { displayRating: rh.displayRating });
      }
    }

    // Get previous ratings for each user to calculate change
    const userIds = game.participants.map(p => p.userId);
    const previousRatings = await this.prisma.ratingHistory.findMany({
      where: {
        userId: { in: userIds },
        matchId: { lt: game.matchId }, // Matches before this one
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    });
    const previousRatingMap = new Map<number, number>();
    for (const pr of previousRatings) {
      previousRatingMap.set(pr.userId, pr.displayRating);
    }

    // Add rating info to participants
    const participantsWithRating = game.participants.map(p => {
      const currentRating = ratingMap.get(p.userId);
      const previousRating = previousRatingMap.get(p.userId) ?? 0; // 0 if first match
      const ratingAfter = currentRating?.displayRating ?? null;
      const ratingChange = ratingAfter !== null ? ratingAfter - previousRating : null;

      return {
        ...p,
        ratingAfter,
        ratingChange,
      };
    });

    // Replace participants with enhanced version
    const gameWithRatings = {
      ...game,
      participants: participantsWithRating,
    };

    // Check if user is a participant
    const isParticipant = userId
      ? game.match?.participants?.some((p) => p.userId === userId) || false
      : false;

    // Only show passcode to participants
    if (!isParticipant) {
      const { passcode, ...gameWithoutPasscode } = gameWithRatings;
      return gameWithoutPasscode;
    }

    return gameWithRatings;
  }

  /**
   * Submit score for a game
   * TODO: Refactor for new RaceResult-based schema
   * Current implementation creates GameParticipant with basic info,
   * RaceResult submission needs to be implemented separately
   */
  async submitScore(gameId: number, userId: number, submitScoreDto: SubmitScoreDto) {
    // Find the game and verify it's in progress
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
        participants: {
          where: { userId },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check match status - allow score submission during IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot submit score - match is not in progress');
    }

    const now = new Date();
    let participantId: number;

    // Check if user is a participant
    if (!game.participants.length) {
      // User is not a participant yet, add them
      const participant = await this.prisma.gameParticipant.create({
        data: {
          gameId,
          userId,
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.PENDING,
          submittedAt: now,
        },
      });
      participantId = participant.id;
    } else {
      // Update existing participant's status
      await this.prisma.gameParticipant.update({
        where: {
          id: game.participants[0].id,
        },
        data: {
          machine: submitScoreDto.machine,
          assistEnabled: submitScoreDto.assistEnabled,
          status: ResultStatus.PENDING,
          submittedAt: now,
          // Clear rejection metadata on resubmit
          rejectedBy: null,
          rejectedAt: null,
        },
      });
      participantId = game.participants[0].id;
    }

    // Handle race results for CLASSIC mode
    if (submitScoreDto.raceResults && submitScoreDto.raceResults.length > 0) {
      const race1 = submitScoreDto.raceResults.find(r => r.raceNumber === 1);
      const race2 = submitScoreDto.raceResults.find(r => r.raceNumber === 2);
      const race3 = submitScoreDto.raceResults.find(r => r.raceNumber === 3);

      // Validate: Race 1 position is required unless disconnected
      if (!race1?.isDisconnected) {
        if (!race1 || race1.position === undefined || race1.position === null) {
          throw new BadRequestException('Race 1 position is required');
        }
        if (race1.position < 1 || race1.position > 20) {
          throw new BadRequestException('Race 1 position must be between 1 and 20');
        }
      }

      // Validate: Race 2 position is required if race1 is not eliminated/dc AND race2 is not dc
      if (!race1?.isEliminated && !race1?.isDisconnected && !race2?.isDisconnected) {
        if (!race2 || race2.position === undefined || race2.position === null) {
          throw new BadRequestException('Race 2 position is required');
        }
        if (race2.position < 1 || race2.position > 20) {
          throw new BadRequestException('Race 2 position must be between 1 and 20');
        }
      }

      // Validate: Race 3 position is required if race1/2 are not eliminated/dc AND race3 is not dc
      if (!race1?.isEliminated && !race1?.isDisconnected && !race2?.isEliminated && !race2?.isDisconnected && !race3?.isDisconnected) {
        if (!race3 || race3.position === undefined || race3.position === null) {
          throw new BadRequestException('Race 3 position is required');
        }
        if (race3.position < 1 || race3.position > 20) {
          throw new BadRequestException('Race 3 position must be between 1 and 20');
        }
      }

      // Delete existing race results for this participant
      await this.prisma.raceResult.deleteMany({
        where: { gameParticipantId: participantId },
      });

      let totalScore = 0;
      let eliminatedAtRace: number | null = null;

      // Create new race results and calculate totals
      for (const raceResult of submitScoreDto.raceResults) {
        // 既にDNF/DCしている場合、以降のレースはnull（参加していない）
        const isAfterElimination = eliminatedAtRace !== null;

        // ポイント計算
        let points = 0;
        let position: number | null = null;
        let isEliminated = false;
        let isDisconnected = false;

        if (isAfterElimination) {
          // DNF/DC後のレースは参加していない扱い
          points = 0;
          position = null;
          isEliminated = false;
          isDisconnected = false;
        } else if (raceResult.isDisconnected) {
          // Disconnected: 0点、順位なし
          points = 0;
          position = null;
          isEliminated = false;
          isDisconnected = true;
          eliminatedAtRace = raceResult.raceNumber;
        } else if (raceResult.position) {
          // 順位がある場合
          points = this.calculateRacePoints(raceResult.position);
          position = raceResult.position;
          isEliminated = raceResult.isEliminated ?? false;
          isDisconnected = false;
          if (isEliminated) {
            eliminatedAtRace = raceResult.raceNumber;
          }
        }

        await this.prisma.raceResult.create({
          data: {
            gameParticipantId: participantId,
            raceNumber: raceResult.raceNumber,
            position,
            points,
            isEliminated,
            isDisconnected,
          },
        });

        totalScore += points;
      }

      // Update participant with calculated totals
      await this.prisma.gameParticipant.update({
        where: { id: participantId },
        data: {
          totalScore,
          eliminatedAtRace,
        },
      });
    }

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  async submitScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    submitScoreDto: SubmitScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return this.submitScore(game.id, userId, submitScoreDto);
  }

  /**
   * Update score for existing participant (moderator action)
   * Only updates race results, not machine/assist settings
   */
  async updateScoreByEventSeasonMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    userId: number,
    updateScoreDto: UpdateScoreDto,
    gameNumber: number = 1,
  ) {
    // Find game by event category, season number, match number, and sequence
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Find existing participant
    const participant = await this.prisma.gameParticipant.findFirst({
      where: {
        gameId: game.id,
        userId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this game');
    }

    // Validate race results
    const race1 = updateScoreDto.raceResults.find(r => r.raceNumber === 1);
    const race2 = updateScoreDto.raceResults.find(r => r.raceNumber === 2);
    const race3 = updateScoreDto.raceResults.find(r => r.raceNumber === 3);

    // Validate: Race 1 position is required unless disconnected
    if (!race1?.isDisconnected) {
      if (!race1 || race1.position === undefined || race1.position === null) {
        throw new BadRequestException('Race 1 position is required');
      }
      if (race1.position < 1 || race1.position > 20) {
        throw new BadRequestException('Race 1 position must be between 1 and 20');
      }
    }

    // Validate: Race 2 position is required if race1 is not eliminated/dc AND race2 is not dc
    if (!race1?.isEliminated && !race1?.isDisconnected && !race2?.isDisconnected) {
      if (!race2 || race2.position === undefined || race2.position === null) {
        throw new BadRequestException('Race 2 position is required');
      }
      if (race2.position < 1 || race2.position > 20) {
        throw new BadRequestException('Race 2 position must be between 1 and 20');
      }
    }

    // Validate: Race 3 position is required if race1/2 are not eliminated/dc AND race3 is not dc
    if (!race1?.isEliminated && !race1?.isDisconnected && !race2?.isEliminated && !race2?.isDisconnected && !race3?.isDisconnected) {
      if (!race3 || race3.position === undefined || race3.position === null) {
        throw new BadRequestException('Race 3 position is required');
      }
      if (race3.position < 1 || race3.position > 20) {
        throw new BadRequestException('Race 3 position must be between 1 and 20');
      }
    }

    // Delete existing race results
    await this.prisma.raceResult.deleteMany({
      where: { gameParticipantId: participant.id },
    });

    let totalScore = 0;
    let eliminatedAtRace: number | null = null;

    // Create new race results and calculate totals
    for (const raceResult of updateScoreDto.raceResults) {
      // 既にDNF/DCしている場合、以降のレースはnull（参加していない）
      const isAfterElimination = eliminatedAtRace !== null;

      // ポイント計算
      let points = 0;
      let position: number | null = null;
      let isEliminated = false;
      let isDisconnected = false;

      if (isAfterElimination) {
        // DNF/DC後のレースは参加していない扱い
        points = 0;
        position = null;
        isEliminated = false;
        isDisconnected = false;
      } else if (raceResult.isDisconnected) {
        // Disconnected: 0点、順位なし
        points = 0;
        position = null;
        isEliminated = false;
        isDisconnected = true;
        eliminatedAtRace = raceResult.raceNumber;
      } else if (raceResult.position) {
        // 順位がある場合
        points = this.calculateRacePoints(raceResult.position);
        position = raceResult.position;
        isEliminated = raceResult.isEliminated ?? false;
        isDisconnected = false;
        if (isEliminated) {
          eliminatedAtRace = raceResult.raceNumber;
        }
      }

      await this.prisma.raceResult.create({
        data: {
          gameParticipantId: participant.id,
          raceNumber: raceResult.raceNumber,
          position,
          points,
          isEliminated,
          isDisconnected,
        },
      });

      totalScore += points;
    }

    // Update participant with calculated totals
    await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        totalScore,
        eliminatedAtRace,
        status: ResultStatus.PENDING,
        submittedAt: new Date(),
        // Clear rejection metadata on resubmit
        rejectedBy: null,
        rejectedAt: null,
      },
    });

    // Get the updated participant
    const updatedParticipant = await this.prisma.gameParticipant.findUnique({
      where: { id: participant.id },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            avatarHash: true,
            profile: {
              select: { country: true },
            },
          },
        },
        raceResults: true,
      },
    });

    // Emit event for real-time update
    this.eventEmitter.emit('game.scoreUpdated', {
      gameId: game.id,
      participant: updatedParticipant,
    });

    return updatedParticipant;
  }

  /**
   * Calculate points from position (CLASSIC mode)
   * 1st = 100pts, 2nd = 95pts, 3rd = 90pts... (5pt decrements)
   * 20th = 5pts, eliminated = 0pts
   */
  private calculateRacePoints(position: number): number {
    if (position < 1 || position > 20) return 0;
    return 105 - (position * 5); // 1st=100, 2nd=95, 3rd=90...
  }

  /**
   * Finalize a match - calculate ratings and mark as FINALIZED
   * Can be called from IN_PROGRESS or COMPLETED status
   * Only MODERATOR/ADMIN can call this
   */
  async endMatch(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    gameNumber: number = 1,
  ) {
    // Find the game
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is in a state that can be finalized
    if (game.match.status !== MatchStatus.IN_PROGRESS && game.match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot finalize match - current status is ${game.match.status}`,
      );
    }

    // Calculate ratings
    await this.classicRatingService.calculateAndUpdateRatings(game.id);

    // Update match status to FINALIZED
    await this.prisma.match.update({
      where: { id: game.matchId },
      data: {
        status: MatchStatus.FINALIZED,
      },
    });

    // Emit event for real-time status update
    this.eventEmitter.emit('game.finalized', {
      gameId: game.id,
      matchId: game.matchId,
      finalizedAt: new Date(),
    });

    // Delete Discord passcode channel
    try {
      await this.discordBotService.deletePasscodeChannel(game.id);
    } catch (error) {
      this.logger.error('Failed to delete Discord channel:', error);
      // Continue even if Discord fails
    }

    return {
      success: true,
      message: `Match finalized and ratings calculated for game ${game.id}`,
      gameId: game.id,
      matchId: game.matchId,
    };
  }

  /**
   * Update tracks for a CLASSIC game
   * Only MODERATOR/ADMIN can call this
   */
  async updateTracks(
    eventCategory: EventCategory,
    seasonNumber: number,
    matchNumber: number,
    tracks: (number | null)[],
    gameNumber: number = 1,
  ) {
    // Validate tracks
    if (!Array.isArray(tracks)) {
      throw new BadRequestException('Tracks must be an array');
    }

    // Filter out nulls for validation
    const nonNullTracks = tracks.filter((t): t is number => t !== null);

    // Validate track IDs exist in database
    if (nonNullTracks.length > 0) {
      const validTracks = await this.prisma.track.findMany({
        where: { id: { in: nonNullTracks } },
        select: { id: true },
      });
      const validTrackIds = new Set(validTracks.map((t) => t.id));
      for (const trackId of nonNullTracks) {
        if (!validTrackIds.has(trackId)) {
          throw new BadRequestException(`Invalid track ID: ${trackId}`);
        }
      }
    }

    // Check for duplicates (excluding nulls)
    const uniqueTracks = new Set(nonNullTracks);
    if (uniqueTracks.size !== nonNullTracks.length) {
      throw new BadRequestException('Duplicate tracks are not allowed');
    }

    // Find the game
    const game = await this.prisma.game.findFirst({
      where: {
        gameNumber,
        match: {
          matchNumber,
          season: {
            seasonNumber,
            event: {
              category: eventCategory,
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Update tracks
    const updatedGame = await this.prisma.game.update({
      where: { id: game.id },
      data: {
        tracks,
      },
    });

    return {
      success: true,
      gameId: updatedGame.id,
      tracks: updatedGame.tracks,
    };
  }

  // ========================================
  // Split Vote Methods
  // ========================================

  /**
   * Get current split vote status for a game
   */
  async getSplitVoteStatus(gameId: number, userId: number): Promise<SplitVoteStatus> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
        splitVotes: {
          where: {
            passcodeVersion: undefined, // Will be set dynamically below
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Re-fetch split votes for current passcode version
    const splitVotes = await this.prisma.splitVote.findMany({
      where: {
        gameId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);
    const currentVotes = splitVotes.length;
    const hasVoted = splitVotes.some((v) => v.userId === userId);

    return {
      currentVotes,
      requiredVotes,
      hasVoted,
      passcode: game.passcode,
      passcodeVersion: game.passcodeVersion,
    };
  }

  /**
   * Cast a split vote
   */
  async castSplitVote(gameId: number, userId: number): Promise<SplitVoteResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only vote during an in-progress match');
    }

    // Check if user is a participant
    const isParticipant = game.match.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('Only participants can vote');
    }

    // Check if user already voted for this passcode version
    const existingVote = await this.prisma.splitVote.findUnique({
      where: {
        gameId_userId_passcodeVersion: {
          gameId,
          userId,
          passcodeVersion: game.passcodeVersion,
        },
      },
    });

    if (existingVote) {
      throw new BadRequestException('Already voted for this passcode version');
    }

    // Create the vote
    await this.prisma.splitVote.create({
      data: {
        gameId,
        userId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    // Count current votes
    const voteCount = await this.prisma.splitVote.count({
      where: {
        gameId,
        passcodeVersion: game.passcodeVersion,
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);

    // Emit vote update event
    this.eventEmitter.emit('game.splitVoteUpdated', {
      gameId,
      currentVotes: voteCount,
      requiredVotes,
      votedBy: userId,
    });

    // Check if threshold reached
    if (voteCount >= requiredVotes) {
      return this.regeneratePasscode(gameId);
    }

    return {
      regenerated: false,
      currentVotes: voteCount,
      requiredVotes,
      passcode: game.passcode,
      passcodeVersion: game.passcodeVersion,
    };
  }

  /**
   * Regenerate passcode (called when vote threshold reached or by moderator)
   */
  async regeneratePasscode(gameId: number): Promise<SplitVoteResult> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if match is IN_PROGRESS
    if (game.match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only regenerate passcode during an in-progress match');
    }

    // Generate new passcode
    const newPasscode = this.generatePasscode();
    const newVersion = game.passcodeVersion + 1;

    // Update game
    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        passcode: newPasscode,
        passcodeVersion: newVersion,
        passcodePublishedAt: new Date(),
      },
    });

    const totalParticipants = game.match.participants.length;
    const requiredVotes = Math.ceil(totalParticipants / 3);

    // Emit passcode regenerated event
    this.eventEmitter.emit('game.passcodeRegenerated', {
      gameId,
      passcode: newPasscode,
      passcodeVersion: newVersion,
      requiredVotes,
    });

    // Post new passcode to Discord channel
    try {
      await this.discordBotService.postNewPasscode({
        gameId,
        passcode: newPasscode,
        passcodeVersion: newVersion,
      });
    } catch (error) {
      this.logger.error('Failed to post new passcode to Discord:', error);
      // Continue even if Discord fails
    }

    return {
      regenerated: true,
      currentVotes: 0,
      requiredVotes,
      passcode: newPasscode,
      passcodeVersion: newVersion,
    };
  }

  /**
   * Force regenerate passcode (moderator only)
   * Permission check is done in controller
   */
  async forceRegeneratePasscode(gameId: number): Promise<SplitVoteResult> {
    return this.regeneratePasscode(gameId);
  }

  /**
   * Generate a random 4-digit passcode
   */
  private generatePasscode(): string {
    const passcode = Math.floor(Math.random() * 10000);
    return passcode.toString().padStart(4, '0');
  }

  /**
   * Verify a participant's score (moderator action)
   */
  async verifyParticipantScore(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { match: true },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Allow verification of PENDING or REJECTED scores (after screenshot resubmission)
    if (participant.status !== ResultStatus.PENDING && participant.status !== ResultStatus.REJECTED) {
      // Already verified or in other state
      if (participant.status === ResultStatus.VERIFIED) {
        return participant;
      }
      throw new BadRequestException('Can only verify pending or rejected scores');
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        status: ResultStatus.VERIFIED,
        verifiedBy: moderatorId,
        verifiedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    this.eventEmitter.emit('game.participantVerified', {
      gameId,
      participant: updated,
    });

    await this.checkAllScoresVerifiedAndFinalize(gameId);

    return updated;
  }

  /**
   * Reject a participant's score (moderator action)
   * Also requests screenshot and sends Discord notification
   */
  async rejectParticipantScore(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    if (participant.status === ResultStatus.VERIFIED) {
      throw new BadRequestException('Cannot reject a verified score');
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        status: ResultStatus.REJECTED,
        rejectedBy: moderatorId,
        rejectedAt: new Date(),
        // Also request screenshot
        screenshotRequested: true,
        screenshotRequestedBy: moderatorId,
        screenshotRequestedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    // Soft delete existing SS1/SS2 screenshots
    await this.prisma.gameScreenshotSubmission.updateMany({
      where: {
        gameId,
        userId: targetUserId,
        type: { in: [ScreenshotType.INDIVIDUAL_1, ScreenshotType.INDIVIDUAL_2] },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Discord notification via channel
    if (game.discordChannelId && updated.user.discordId) {
      const category =
        game.match.season?.event?.category?.toLowerCase() || 'classic';
      const seasonNumber = game.match.season?.seasonNumber ?? 1;
      const matchUrl = `${process.env.FRONTEND_URL}/matches/${category}/${seasonNumber}/${game.match.matchNumber}`;
      this.discordBotService.postScreenshotRequest(
        game.discordChannelId,
        updated.user.discordId,
        matchUrl,
      );
    }

    this.eventEmitter.emit('game.participantRejected', {
      gameId,
      participant: updated,
    });

    return updated;
  }

  /**
   * Request a participant to submit a screenshot (moderator action)
   */
  async requestScreenshot(
    gameId: number,
    targetUserId: number,
    moderatorId: number,
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: {
          include: {
            season: {
              include: {
                event: true,
              },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId: targetUserId },
      include: { user: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const updated = await this.prisma.gameParticipant.update({
      where: { id: participant.id },
      data: {
        screenshotRequested: true,
        screenshotRequestedBy: moderatorId,
        screenshotRequestedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            profile: { select: { country: true } },
          },
        },
        raceResults: true,
      },
    });

    // Discord notification via channel
    if (game.discordChannelId && updated.user.discordId) {
      const category = game.match.season?.event?.category?.toLowerCase() || 'classic';
      const seasonNumber = game.match.season?.seasonNumber ?? 1;
      const matchUrl = `${process.env.FRONTEND_URL}/matches/${category}/${seasonNumber}/${game.match.matchNumber}`;
      this.discordBotService.postScreenshotRequest(
        game.discordChannelId,
        updated.user.discordId,
        matchUrl,
      );
    }

    this.eventEmitter.emit('game.screenshotRequested', {
      gameId,
      participant: updated,
    });

    return updated;
  }

  /**
   * Check if all scores are verified and finalize match
   * Condition: All participants verified + FINAL_SCORE screenshot verified
   */
  private async checkAllScoresVerifiedAndFinalize(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        match: true,
        participants: true,
      },
    });

    if (!game || (game.match.status !== MatchStatus.IN_PROGRESS && game.match.status !== MatchStatus.COMPLETED)) {
      return;
    }

    if (game.participants.length === 0) {
      return;
    }

    const allScoresVerified = game.participants.every(p => p.status === ResultStatus.VERIFIED);

    const verifiedFinalScore = await this.prisma.gameScreenshotSubmission.count({
      where: {
        gameId,
        type: 'FINAL_SCORE',
        isVerified: true,
        deletedAt: null,
      },
    });

    this.logger.log(
      `Game ${gameId}: Scores ${allScoresVerified ? 'all verified' : 'pending'}, FINAL_SCORE ${verifiedFinalScore}/1`,
    );

    if (allScoresVerified && verifiedFinalScore >= 1) {
      try {
        await this.classicRatingService.calculateAndUpdateRatings(gameId);
        this.logger.log(`Rating calculation completed for game ${gameId}`);
      } catch (error) {
        this.logger.error(`Failed to calculate ratings for game ${gameId}: ${error}`);
      }

      await this.prisma.match.update({
        where: { id: game.matchId },
        data: { status: MatchStatus.FINALIZED },
      });

      this.logger.log(`Match ${game.matchId} automatically FINALIZED`);

      try {
        await this.discordBotService.deletePasscodeChannel(gameId);
      } catch (error) {
        this.logger.error(`Failed to delete Discord channel: ${error}`);
      }
    }
  }
}
