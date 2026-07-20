'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gamesApi, tracksApi, type Track } from '@/lib/api';
import { divisionForInGameMode, roundDisplayLabel } from '@/types';
import type { Match, Tournament } from '@/types';

// moderator-panel と同じ: Classic用トラックは ID 201-220
const CLASSIC_TRACK_ID_MIN = 201;
const CLASSIC_TRACK_ID_MAX = 220;
const RACE_COUNT = 3;

interface ClassicTrackSectionProps {
  tournament: Tournament;
  matches: Match[];
  onUpdate: () => void;
}

interface ApiErrorLike {
  response?: { data?: { message?: string } };
}

// Classicラウンドの各ゲームにコース(tracks)を割り当てる運営セクション。
// Classicゲームが存在しない大会では何も表示しない
export function ClassicTrackSection({
  tournament,
  matches,
  onUpdate,
}: ClassicTrackSectionProps) {
  const t = useTranslations('tournament');
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Record<number, (number | null)[]>>({});
  const [savingRound, setSavingRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      tournament.rounds
        .filter((r) => divisionForInGameMode(r.inGameMode) === 'CLASSIC')
        .sort((a, b) => a.roundNumber - b.roundNumber)
        .flatMap((round) => {
          const game = matches.find(
            (m) => m.matchNumber === round.roundNumber,
          )?.games?.[0];
          return game ? [{ round, game }] : [];
        }),
    [tournament.rounds, matches],
  );

  const seasonNumber = tournament.season?.seasonNumber;

  const hasRows = rows.length > 0;
  useEffect(() => {
    if (hasRows) {
      tracksApi.getAll().then((res) => setAllTracks(res.data));
    }
  }, [hasRows]);

  // 親のrefetchでゲームのtracksが変わったら選択状態を同期し直す
  useEffect(() => {
    setSelected(
      Object.fromEntries(
        rows.map(({ round, game }) => [
          round.roundNumber,
          Array.from({ length: RACE_COUNT }, (_, i) => game.tracks?.[i] ?? null),
        ]),
      ),
    );
  }, [rows]);

  if (rows.length === 0 || seasonNumber == null) return null;

  const classicTracks = allTracks.filter(
    (track) =>
      track.id >= CLASSIC_TRACK_ID_MIN && track.id <= CLASSIC_TRACK_ID_MAX,
  );

  const availableTracks = (roundNumber: number, raceIndex: number) => {
    const others = (selected[roundNumber] ?? []).filter(
      (_, i) => i !== raceIndex,
    );
    return classicTracks.filter((track) => !others.includes(track.id));
  };

  const handleChange = (
    roundNumber: number,
    raceIndex: number,
    value: string,
  ) => {
    setSelected((prev) => {
      const next = [...(prev[roundNumber] ?? Array(RACE_COUNT).fill(null))];
      next[raceIndex] = value === 'none' ? null : parseInt(value, 10);
      return { ...prev, [roundNumber]: next };
    });
  };

  const handleSave = async (roundNumber: number) => {
    setSavingRound(roundNumber);
    setError(null);
    try {
      await gamesApi.updateTracks(
        'TOURNAMENT',
        seasonNumber,
        roundNumber,
        selected[roundNumber] ?? [],
      );
      onUpdate();
    } catch (err) {
      setError(
        (err as ApiErrorLike).response?.data?.message ||
          'Failed to save tracks',
      );
    } finally {
      setSavingRound(null);
    }
  };

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
      <h3 className="text-sm font-medium text-white">
        {t('admin.trackSelection')}
      </h3>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {rows.map(({ round, game }) => {
        const roundNumber = round.roundNumber;
        const current = selected[roundNumber] ?? Array(RACE_COUNT).fill(null);
        const saved = Array.from(
          { length: RACE_COUNT },
          (_, i) => game.tracks?.[i] ?? null,
        );
        const changed = JSON.stringify(current) !== JSON.stringify(saved);
        return (
          <div key={roundNumber}>
            <p className="text-xs text-gray-400 mb-1.5">
              {roundDisplayLabel(tournament.rounds, roundNumber)}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid grid-cols-3 gap-3 grow max-w-2xl">
                {Array.from({ length: RACE_COUNT }, (_, index) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-400 mb-1">
                      {t('admin.gridRace', { number: index + 1 })}
                    </label>
                    <Select
                      value={current[index]?.toString() ?? 'none'}
                      onValueChange={(value) =>
                        handleChange(roundNumber, index, value)
                      }
                    >
                      <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t('admin.trackNotSet')}
                        </SelectItem>
                        {availableTracks(roundNumber, index).map((track) => (
                          <SelectItem
                            key={track.id}
                            value={track.id.toString()}
                          >
                            {track.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {changed && (
                <Button
                  size="sm"
                  onClick={() => handleSave(roundNumber)}
                  disabled={savingRound !== null}
                >
                  {savingRound === roundNumber && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  {t('admin.gridSave')}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
