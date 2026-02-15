import { Injectable, Logger } from '@nestjs/common';
import { TeamConfig, TeamConfigService } from './team-config.service';

/**
 * Player data for team assignment
 */
export interface PlayerForAssignment {
  userId: number;
  rating: number;
  joinedAt: Date;
}

/**
 * Result of team assignment
 */
export interface TeamAssignmentResult {
  config: TeamConfig;
  teams: number[][]; // teams[teamIndex] = userId[]
  excludedUserIds: number[];
}

@Injectable()
export class TeamAssignmentService {
  private readonly logger = new Logger(TeamAssignmentService.name);

  constructor(private teamConfigService: TeamConfigService) {}

  /**
   * Assign players to teams using snake draft based on rating
   *
   * Snake draft example with 3 teams:
   * - Round 1: Team 0 <- 1st, Team 1 <- 2nd, Team 2 <- 3rd
   * - Round 2: Team 2 <- 4th, Team 1 <- 5th, Team 0 <- 6th
   * - Round 3: Team 0 <- 7th, Team 1 <- 8th, Team 2 <- 9th
   * - ...
   *
   * This ensures balanced teams by giving lower-seeded teams earlier picks in alternating rounds.
   */
  assignTeams(players: PlayerForAssignment[]): TeamAssignmentResult | null {
    const playerCount = players.length;

    if (!this.teamConfigService.isValidPlayerCount(playerCount)) {
      this.logger.warn(
        `Invalid player count for TEAM_CLASSIC: ${playerCount}`,
      );
      return null;
    }

    // Step 1: Determine how many players to exclude
    const excludeCount = this.teamConfigService.getExcludeCount(playerCount);

    // Step 2: Identify excluded players (those who joined last)
    const sortedByJoinTime = [...players].sort(
      (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime(),
    );
    const excludedUserIds = sortedByJoinTime
      .slice(0, excludeCount)
      .map((p) => p.userId);

    // Step 3: Get eligible players (not excluded)
    const eligiblePlayers = players.filter(
      (p) => !excludedUserIds.includes(p.userId),
    );

    // Step 4: Select random team configuration
    const config = this.teamConfigService.selectRandomConfig(playerCount);
    if (!config) {
      this.logger.error(
        `No valid team configuration for ${playerCount} players`,
      );
      return null;
    }

    // Step 5: Sort eligible players by rating (descending)
    const sortedByRating = [...eligiblePlayers].sort(
      (a, b) => b.rating - a.rating,
    );

    // Step 6: Apply snake draft
    const teams = this.snakeDraft(sortedByRating, config.teamCount);

    // Step 7: Shuffle team labels so top-rated player isn't always Team A
    this.shuffleTeams(teams);

    this.logger.log(
      `Assigned ${eligiblePlayers.length} players to ${config.teamCount} teams (${config.configString}), excluded ${excludeCount}`,
    );

    return {
      config,
      teams,
      excludedUserIds,
    };
  }

  /**
   * Snake draft algorithm
   *
   * @param sortedPlayers - Players sorted by rating (highest first)
   * @param teamCount - Number of teams to create
   * @returns Array of teams, each containing user IDs
   */
  private snakeDraft(
    sortedPlayers: PlayerForAssignment[],
    teamCount: number,
  ): number[][] {
    const teams: number[][] = Array.from({ length: teamCount }, () => []);

    let direction = 1; // 1 = forward (0 -> teamCount-1), -1 = backward
    let currentTeam = 0;

    for (const player of sortedPlayers) {
      teams[currentTeam].push(player.userId);

      // Move to next team
      const nextTeam = currentTeam + direction;

      // Check if we need to reverse direction
      if (nextTeam >= teamCount || nextTeam < 0) {
        // Reverse direction but stay on same team
        direction *= -1;
      } else {
        currentTeam = nextTeam;
      }
    }

    return teams;
  }

  /**
   * Shuffle team label assignments (Fisher-Yates)
   * Swaps elements in-place so teamIndex 0/1/2/3 map to random groups
   */
  private shuffleTeams(teams: number[][]): void {
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }
  }

  /**
   * Calculate team scores from individual player scores
   */
  calculateTeamScores(
    participantScores: Map<number, number>, // userId -> score
    teams: number[][], // teams[teamIndex] = userId[]
  ): { teamIndex: number; score: number; rank: number }[] {
    // Calculate total score for each team
    const teamScores = teams.map((teamUserIds, teamIndex) => {
      const score = teamUserIds.reduce((sum, oderId) => {
        return sum + (participantScores.get(oderId) ?? 0);
      }, 0);
      return { teamIndex, score, rank: 0 };
    });

    // Sort by score descending
    const sorted = [...teamScores].sort((a, b) => b.score - a.score);

    // Assign ranks (same score = same rank)
    let currentRank = 1;
    let prevScore: number | null = null;
    let sameRankCount = 0;

    for (const team of sorted) {
      if (prevScore !== null && team.score === prevScore) {
        // Same score as previous team, keep same rank
        sameRankCount++;
      } else {
        // Different score, advance rank
        currentRank += sameRankCount;
        sameRankCount = 1;
      }
      team.rank = currentRank;
      prevScore = team.score;
    }

    // Update ranks in original array
    for (const sortedTeam of sorted) {
      teamScores[sortedTeam.teamIndex].rank = sortedTeam.rank;
    }

    return teamScores;
  }
}
