import { Injectable } from '@nestjs/common';

/**
 * Team configuration for TEAM_CLASSIC / TEAM_GP mode
 */
export interface TeamConfig {
  teamSize: number; // Number of players per team
  teamCount: number; // Number of teams
  configString: string; // e.g., "4x3" (4 players x 3 teams)
}

/**
 * Machine color grid positions used for Team modes
 * Maps teamIndex → grid position (1-16) in the F-ZERO 99 color selection screen
 *
 * Grid layout:
 * Row 0:  1=Blue,   2=Green,  3=Yellow,  4=Pink
 * Row 1:  5=Red,    6=Purple, 7=Rose,    8=Cyan
 * Row 2:  9=Lime,  10=Orange, 11=Navy,  12=Magenta
 * Row 3: 13=Teal,  14=White,  15=Black,  16=Gold
 */
export const TEAM_GRID_NUMBERS: number[] = [1, 2, 3, 4, 5, 6, 8, 10, 14, 15];

/**
 * Full 16-position grid for TEAM_GP (supports up to 16 teams with unique colors)
 */
export const TEAM_GP_GRID_NUMBERS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

/**
 * Team colors for display (keyed by grid position)
 */
export const TEAM_COLORS: Record<number, string> = {
  1: 'Blue',
  2: 'Green',
  3: 'Yellow',
  4: 'Pink',
  5: 'Red',
  6: 'Purple',
  7: 'Rose',
  8: 'Cyan',
  9: 'Lime',
  10: 'Orange',
  11: 'Navy',
  12: 'Magenta',
  13: 'Teal',
  14: 'White',
  15: 'Black',
  16: 'Gold',
};

/**
 * Team color hex codes for UI (keyed by grid position)
 */
export const TEAM_COLOR_HEX: Record<number, string> = {
  1: '#3B82F6', // Blue
  2: '#22C55E', // Green
  3: '#EAB308', // Yellow
  4: '#EC4899', // Pink
  5: '#EF4444', // Red
  6: '#A855F7', // Purple
  7: '#F43F5E', // Rose
  8: '#06B6D4', // Cyan
  9: '#84CC16', // Lime
  10: '#F97316', // Orange
  11: '#1E3A5F', // Navy
  12: '#D946EF', // Magenta
  13: '#14B8A6', // Teal
  14: '#F5F5F5', // White
  15: '#6B7280', // Black
  16: '#F59E0B', // Gold
};

/**
 * Team configuration patterns by player count (TEAM_CLASSIC: 12-20)
 * Format: "AxB" = A players per team x B teams
 */
const TEAM_CONFIGS: Record<number, string[]> = {
  12: ['2x6', '3x4', '4x3', '6x2'],
  13: ['2x6', '3x4', '4x3', '6x2'], // 1 player excluded
  14: ['2x7', '7x2'],
  15: ['3x5', '5x3'],
  16: ['2x8', '4x4', '8x2'],
  17: ['2x8', '4x4', '8x2'], // 1 player excluded
  18: ['2x9', '3x6', '6x3', '9x2'],
  19: ['2x9', '3x6', '6x3', '9x2'], // 1 player excluded
  20: ['2x10', '4x5', '5x4', '10x2'],
};

/**
 * Player counts that require excluding 1 player (TEAM_CLASSIC)
 */
const EXCLUDE_ONE_PLAYER_COUNTS = [13, 17, 19];

/**
 * Check if a number is prime
 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Get divisor pairs for a number that satisfy TEAM_GP constraints
 * Returns array of { teamSize, teamCount } where both >= 2 and teamCount <= 16
 * (TEAM_GP_GRID_NUMBERS has only 16 unique colors)
 */
function getTeamGpDivisorPairs(n: number): TeamConfig[] {
  const configs: TeamConfig[] = [];
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) {
      const other = n / d;
      // d = teamSize, other = teamCount
      if (other >= 2 && other <= 16) {
        configs.push({ teamSize: d, teamCount: other, configString: `${d}x${other}` });
      }
      // other = teamSize, d = teamCount (avoid duplicate when d === other)
      if (d !== other && d <= 16) {
        configs.push({ teamSize: other, teamCount: d, configString: `${other}x${d}` });
      }
    }
  }
  return configs;
}

@Injectable()
export class TeamConfigService {
  // ===== TEAM_CLASSIC methods =====

  /**
   * Get the number of players to exclude for a given player count (TEAM_CLASSIC)
   */
  getExcludeCount(playerCount: number): number {
    if (EXCLUDE_ONE_PLAYER_COUNTS.includes(playerCount)) {
      return 1;
    }
    return 0;
  }

  /**
   * Get available team configurations for a player count (TEAM_CLASSIC)
   */
  getAvailableConfigs(playerCount: number): string[] {
    // Adjust for excluded players
    const effectiveCount = playerCount - this.getExcludeCount(playerCount);
    return TEAM_CONFIGS[effectiveCount] || [];
  }

  /**
   * Select a random team configuration for the given player count (TEAM_CLASSIC)
   */
  selectRandomConfig(playerCount: number): TeamConfig | null {
    const configs = this.getAvailableConfigs(playerCount);
    if (configs.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * configs.length);
    return this.parseConfig(configs[randomIndex]);
  }

  /**
   * Parse a config string like "4x3" into a TeamConfig object
   */
  parseConfig(configString: string): TeamConfig {
    const [teamSize, teamCount] = configString.split('x').map(Number);
    return {
      teamSize,
      teamCount,
      configString,
    };
  }

  /**
   * Check if a player count is valid for TEAM_CLASSIC
   */
  isValidPlayerCount(playerCount: number): boolean {
    return playerCount >= 12 && playerCount <= 20;
  }

  /**
   * Get team color name by grid position
   */
  getTeamColor(teamNumber: number): string {
    return TEAM_COLORS[teamNumber] || 'Unknown';
  }

  /**
   * Get team color hex by grid position
   */
  getTeamColorHex(teamNumber: number): string {
    return TEAM_COLOR_HEX[teamNumber] || '#808080';
  }

  /**
   * Get all supported player counts (TEAM_CLASSIC)
   */
  getSupportedPlayerCounts(): number[] {
    return [12, 13, 14, 15, 16, 17, 18, 19, 20];
  }

  // ===== TEAM_GP methods =====

  /**
   * Check if a player count is valid for TEAM_GP (30-99)
   */
  isValidTeamGpPlayerCount(playerCount: number): boolean {
    return playerCount >= 30 && playerCount <= 99;
  }

  /**
   * Get the minimum number of players to exclude for TEAM_GP
   * Tries 0, 1, 2, ... until a valid config is found
   */
  getTeamGpExcludeCount(playerCount: number): number {
    for (let i = 0; i < playerCount - 2; i++) {
      const configs = getTeamGpDivisorPairs(playerCount - i);
      if (configs.length > 0) {
        return i;
      }
    }
    return playerCount; // fallback (shouldn't happen for 30-99)
  }

  /**
   * Get available team configurations for TEAM_GP
   */
  getTeamGpConfigs(playerCount: number): TeamConfig[] {
    const excludeCount = this.getTeamGpExcludeCount(playerCount);
    const effectiveCount = playerCount - excludeCount;
    return getTeamGpDivisorPairs(effectiveCount);
  }

  /**
   * Select a random team configuration for TEAM_GP
   */
  selectRandomTeamGpConfig(playerCount: number): TeamConfig | null {
    const configs = this.getTeamGpConfigs(playerCount);
    if (configs.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * configs.length);
    return configs[randomIndex];
  }
}
