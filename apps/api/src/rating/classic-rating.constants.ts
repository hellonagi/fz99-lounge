/**
 * Classic Mode Rating System - Constants & Configuration
 *
 * This file contains all configuration values and type definitions
 * for the Classic mode rating system.
 */

// ==================== CONFIGURATION ====================

export const CLASSIC_CONFIG = {
  // Rating calculation parameters
  K_FACTOR: 10000,
  K_MULTIPLIER: 0.01, // Effective K = K_FACTOR × K_MULTIPLIER = 100
  SCALE: 1000, // Rating difference where expected win rate is ~90%
  INITIAL_RATING: 2750, // Starting internal rating for new players

  // Comparison mode parameters
  CONVERGENCE_THRESHOLD: 15, // Display rating fully converges at this point
  INITIAL_COMPARISON_GAMES: 5, // First 5 games use all-player comparison
  COMPARISON_RANGE: 3, // Compare with ±3 players by rating rank

  // Position bonuses (applied to top 3)
  POSITION_BONUS: { 1: 20, 2: 10, 3: 5 } as Record<number, number>,
  MIN_GUARANTEE: { 1: 10, 2: 5, 3: 2 } as Record<number, number>,

  // Rating change cap
  MAX_RATING_CHANGE: 200,
};

// ==================== INTERFACES ====================

/**
 * Participant data with current rating information
 */
export interface ParticipantWithRating {
  participantId: number;
  userId: number;
  position: number; // Calculated position (1-based)
  totalScore: number;
  eliminatedAtRace: number | null;
  currentRating: number;
  currentSeasonHigh: number;
  gamesPlayed: number;
  currentDisplayRating: number;
  currentConvergencePoints: number;
}

/**
 * Rating change result for a single participant
 */
export interface RatingChange {
  userId: number;
  participantId: number;
  oldInternalRating: number;
  newInternalRating: number;
  internalRatingChange: number;
  oldSeasonHigh: number;
  newSeasonHigh: number;
  oldDisplayRating: number;
  newDisplayRating: number;
  oldGamesPlayed: number;
  newGamesPlayed: number;
  oldConvergencePoints: number;
  newConvergencePoints: number;
}
