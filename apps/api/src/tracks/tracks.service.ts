import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { League } from '@prisma/client';

/** GP mode: 5 fixed tracks per league */
const GP_TRACKS_BY_LEAGUE: Record<string, number[]> = {
  KNIGHT: [1, 2, 3, 4, 5],
  QUEEN: [6, 7, 8, 9, 10],
  KING: [11, 12, 13, 14, 15],
  ACE: [16, 17, 18, 19, 20],
  MIRROR_KNIGHT: [101, 102, 103, 104, 105],
  MIRROR_QUEEN: [106, 107, 108, 109, 110],
  MIRROR_KING: [111, 112, 113, 114, 115],
  MIRROR_ACE: [116, 117, 118, 119, 120],
};
import {
  TRACKSET_REFERENCE_TIME,
  TRACKSET_REFERENCE_ID,
  TRACKSET_COUNT,
  CLASSIC_MINI_TRACKSETS,
} from './classic-mini-tracksets';

@Injectable()
export class TracksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all tracks, optionally filtered by league
   */
  async getAll(league?: League) {
    return this.prisma.track.findMany({
      where: league ? { league } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get a single track by ID
   */
  async getById(id: number) {
    return this.prisma.track.findUnique({
      where: { id },
    });
  }

  /**
   * Get GP track IDs by league (5 tracks per league)
   */
  getGpTracksByLeague(league: League): number[] {
    const tracks = GP_TRACKS_BY_LEAGUE[league];
    if (!tracks) {
      return [];
    }
    return [...tracks];
  }

  /**
   * 指定時刻からClassic Mini Prixのトラックセットを計算
   * @param scheduledStart 試合開始予定時刻
   * @returns トラックIDの配列 [track1Id, track2Id, track3Id]
   */
  calculateClassicMiniTracks(scheduledStart: Date): number[] {
    const setId = this.calculateTracksetId(scheduledStart);
    return [...CLASSIC_MINI_TRACKSETS[setId]];
  }

  /**
   * 指定時刻からトラックセットIDを計算
   * @param targetTime 計算対象時刻
   * @returns セットID (1-29)
   */
  calculateTracksetId(targetTime: Date): number {
    const diffMs = targetTime.getTime() - TRACKSET_REFERENCE_TIME.getTime();
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    // 基準時刻がセットID 2 なので調整
    let offset = diffMinutes % TRACKSET_COUNT;
    if (offset < 0) offset += TRACKSET_COUNT;

    let setId = offset + TRACKSET_REFERENCE_ID;
    if (setId > TRACKSET_COUNT) setId -= TRACKSET_COUNT;

    return setId;
  }
}
