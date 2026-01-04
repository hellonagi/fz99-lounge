import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { League } from '@prisma/client';
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
