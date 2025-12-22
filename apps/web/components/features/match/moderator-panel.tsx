'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { gamesApi } from '@/lib/api';

interface RaceResult {
  raceNumber: number;
  position: number | null;
  points: number | null;
  isEliminated: boolean;
}

interface Participant {
  user: {
    id: number;
    displayName: string | null;
  };
  totalScore: number | null;
  eliminatedAtRace: number | null;
  machine: string;
  raceResults?: RaceResult[];
}

interface ModeratorPanelProps {
  gameId: number;
  matchId: number;
  matchStatus: string;
  participants: Participant[];
  category: string;
  season: number;
  match: number;
  onUpdate: () => void;
}

export function ModeratorPanel({
  gameId,
  matchId,
  matchStatus,
  participants,
  category,
  season,
  match,
  onUpdate,
}: ModeratorPanelProps) {
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    r1: string;
    r2: string;
    r3: string;
    r1Dnf: boolean;
    r2Dnf: boolean;
    r3Dnf: boolean;
  }>({ r1: '', r2: '', r3: '', r1Dnf: false, r2Dnf: false, r3Dnf: false });
  const [loading, setLoading] = useState(false);
  const [endingMatch, setEndingMatch] = useState(false);

  const startEditing = (participant: Participant) => {
    const r1 = participant.raceResults?.find(r => r.raceNumber === 1);
    const r2 = participant.raceResults?.find(r => r.raceNumber === 2);
    const r3 = participant.raceResults?.find(r => r.raceNumber === 3);

    setEditingUserId(participant.user.id);
    setEditValues({
      r1: r1?.position?.toString() || '',
      r2: r2?.position?.toString() || '',
      r3: r3?.position?.toString() || '',
      r1Dnf: r1?.isEliminated || false,
      r2Dnf: r2?.isEliminated || false,
      r3Dnf: r3?.isEliminated || false,
    });
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditValues({ r1: '', r2: '', r3: '', r1Dnf: false, r2Dnf: false, r3Dnf: false });
  };

  const saveScore = async (userId: number) => {
    setLoading(true);
    try {
      const raceResults = [
        {
          raceNumber: 1,
          position: editValues.r1Dnf ? undefined : (editValues.r1 ? parseInt(editValues.r1) : undefined),
          isEliminated: editValues.r1Dnf,
        },
        {
          raceNumber: 2,
          position: editValues.r2Dnf ? undefined : (editValues.r2 ? parseInt(editValues.r2) : undefined),
          isEliminated: editValues.r1Dnf || editValues.r2Dnf,
        },
        {
          raceNumber: 3,
          position: editValues.r3Dnf ? undefined : (editValues.r3 ? parseInt(editValues.r3) : undefined),
          isEliminated: editValues.r1Dnf || editValues.r2Dnf || editValues.r3Dnf,
        },
      ];

      await gamesApi.updateScore(category, season, match, userId, { raceResults });
      setEditingUserId(null);
      onUpdate();
    } catch (error) {
      console.error('Failed to update score:', error);
      alert('Failed to update score');
    } finally {
      setLoading(false);
    }
  };

  const handleEndMatch = async () => {
    if (!confirm('Are you sure you want to end this match and calculate ratings?')) {
      return;
    }

    setEndingMatch(true);
    try {
      await gamesApi.endMatch(category, season, match);
      onUpdate();
    } catch (error) {
      console.error('Failed to end match:', error);
      alert('Failed to end match');
    } finally {
      setEndingMatch(false);
    }
  };

  // Sort participants
  const sortedParticipants = [...participants].sort((a, b) => {
    const aElim = a.eliminatedAtRace;
    const bElim = b.eliminatedAtRace;
    if (aElim === null && bElim === null) {
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    }
    if (aElim === null) return -1;
    if (bElim === null) return 1;
    return bElim - aElim;
  });

  return (
    <div className="space-y-4">
      {/* Manual Match End / Finalize Button */}
      {(matchStatus === 'IN_PROGRESS' || matchStatus === 'COMPLETED') && (
        <div className="flex items-center justify-between p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <div>
            <p className="text-yellow-400 font-medium text-sm">
              {matchStatus === 'IN_PROGRESS' ? 'End Match Early' : 'Finalize Match'}
            </p>
            <p className="text-gray-400 text-xs">Calculate ratings and finalize results</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndMatch}
            disabled={endingMatch}
          >
            {endingMatch ? 'Processing...' : matchStatus === 'IN_PROGRESS' ? 'End Match' : 'Calculate Ratings'}
          </Button>
        </div>
      )}

      {/* Score Editing Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 px-2 font-medium">Player</th>
              <th className="text-center py-2 px-1 font-medium w-14">R1</th>
              <th className="text-center py-2 px-1 font-medium w-14">R2</th>
              <th className="text-center py-2 px-1 font-medium w-14">R3</th>
              <th className="text-right py-2 px-2 font-medium">Total</th>
              <th className="text-center py-2 px-2 font-medium w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant) => {
              const isEditing = editingUserId === participant.user.id;
              const r1 = participant.raceResults?.find(r => r.raceNumber === 1);
              const r2 = participant.raceResults?.find(r => r.raceNumber === 2);
              const r3 = participant.raceResults?.find(r => r.raceNumber === 3);

              return (
                <tr
                  key={participant.user.id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30"
                >
                  {/* Player Name */}
                  <td className="py-2 px-2 text-white truncate max-w-[100px]">
                    {participant.user.displayName || `User#${participant.user.id}`}
                  </td>

                  {/* R1 */}
                  <td className="py-1 px-1 text-center">
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={editValues.r1}
                          onChange={(e) => setEditValues({ ...editValues, r1: e.target.value })}
                          disabled={editValues.r1Dnf}
                          className="w-12 h-7 text-center p-1 text-xs"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={editValues.r1Dnf}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              r1Dnf: e.target.checked,
                              r2Dnf: e.target.checked ? true : editValues.r2Dnf,
                              r3Dnf: e.target.checked ? true : editValues.r3Dnf,
                            })}
                            className="w-3 h-3"
                          />
                          DNF
                        </label>
                      </div>
                    ) : (
                      <span className={r1?.isEliminated ? 'text-red-400' : 'text-gray-300'}>
                        {r1?.isEliminated ? 'DNF' : r1?.position ?? '-'}
                      </span>
                    )}
                  </td>

                  {/* R2 */}
                  <td className="py-1 px-1 text-center">
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={editValues.r2}
                          onChange={(e) => setEditValues({ ...editValues, r2: e.target.value })}
                          disabled={editValues.r1Dnf || editValues.r2Dnf}
                          className="w-12 h-7 text-center p-1 text-xs"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={editValues.r2Dnf}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              r2Dnf: e.target.checked,
                              r3Dnf: e.target.checked ? true : editValues.r3Dnf,
                            })}
                            disabled={editValues.r1Dnf}
                            className="w-3 h-3"
                          />
                          DNF
                        </label>
                      </div>
                    ) : (
                      <span className={r2?.isEliminated ? 'text-red-400' : 'text-gray-300'}>
                        {r2?.isEliminated ? 'DNF' : r2?.position ?? '-'}
                      </span>
                    )}
                  </td>

                  {/* R3 */}
                  <td className="py-1 px-1 text-center">
                    {isEditing ? (
                      <div className="flex flex-col items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={editValues.r3}
                          onChange={(e) => setEditValues({ ...editValues, r3: e.target.value })}
                          disabled={editValues.r1Dnf || editValues.r2Dnf || editValues.r3Dnf}
                          className="w-12 h-7 text-center p-1 text-xs"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={editValues.r3Dnf}
                            onChange={(e) => setEditValues({ ...editValues, r3Dnf: e.target.checked })}
                            disabled={editValues.r1Dnf || editValues.r2Dnf}
                            className="w-3 h-3"
                          />
                          DNF
                        </label>
                      </div>
                    ) : (
                      <span className={r3?.isEliminated ? 'text-red-400' : 'text-gray-300'}>
                        {r3?.isEliminated ? 'DNF' : r3?.position ?? '-'}
                      </span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="py-2 px-2 text-right text-white font-medium">
                    {participant.eliminatedAtRace !== null
                      ? <span className="text-red-400">DNF R{participant.eliminatedAtRace}</span>
                      : participant.totalScore ?? '-'}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-2 text-center">
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => saveScore(participant.user.id)}
                          disabled={loading}
                          className="h-6 px-2 text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          disabled={loading}
                          className="h-6 px-2 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(participant)}
                        className="h-6 px-2 text-xs"
                      >
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
