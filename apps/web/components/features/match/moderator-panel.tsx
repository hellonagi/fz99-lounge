'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gamesApi, tracksApi, Track } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, AlertTriangle } from 'lucide-react';
import { ScoreSubmissionForm } from './score-submission-form';
import {
  detectAllPositionConflicts,
  type ConflictResult,
} from '@/lib/position-conflict-detector';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/lib/permissions';

interface RaceResult {
  raceNumber: number;
  position: number | null;
  points: number | null;
  isEliminated: boolean;
  isDisconnected: boolean;
}

interface Participant {
  user: {
    id: number;
    displayName: string | null;
    profile?: { country: string | null } | null;
  };
  totalScore: number | null;
  eliminatedAtRace: number | null;
  machine: string;
  assistEnabled: boolean;
  raceResults?: RaceResult[];
  // Score verification status (UNSUBMITTED | PENDING | VERIFIED | REJECTED)
  status?: string;
  // Screenshot request
  screenshotRequested?: boolean;
}

interface MatchParticipant {
  user: {
    id: number;
    displayName: string | null;
    profile?: { country: string | null } | null;
  };
}

interface ModeratorPanelProps {
  gameId: number;
  matchId: number;
  matchStatus: string;
  participants: Participant[];
  matchParticipants: MatchParticipant[];
  category: string;
  season: number;
  match: number;
  deadline: string;
  tracks?: number[] | null;
  onUpdate: () => void;
}

export function ModeratorPanel(props: ModeratorPanelProps) {
  const { user } = useAuthStore();
  const t = useTranslations('screenshotStatus');
  const tConflict = useTranslations('positionConflict');
  const tMod = useTranslations('moderatorPanel');
  const {
    matchStatus,
    participants,
    category,
    season,
    match,
    deadline,
    tracks,
    onUpdate,
  } = props;
  const [endingMatch, setEndingMatch] = useState(false);
  const [regeneratingPasscode, setRegeneratingPasscode] = useState(false);
  // Score verification state
  const [verifyingScoreUserId, setVerifyingScoreUserId] = useState<number | null>(null);
  const [rejectingScoreUserId, setRejectingScoreUserId] = useState<number | null>(null);
  const [markingNoShowUserId, setMarkingNoShowUserId] = useState<number | null>(null);
  const [notifyingConflict, setNotifyingConflict] = useState(false);
  const [conflictNotified, setConflictNotified] = useState(false);

  const isGpMode = category.toUpperCase() === 'GP' || category.toUpperCase() === 'TEAM_GP';
  const raceCount = isGpMode ? 5 : 3;

  // Track selection state (CLASSIC only)
  const [selectedTracks, setSelectedTracks] = useState<(number | null)[]>([
    tracks?.[0] ?? null,
    tracks?.[1] ?? null,
    tracks?.[2] ?? null,
  ]);
  const [savingTracks, setSavingTracks] = useState(false);
  const [allTracks, setAllTracks] = useState<Track[]>([]);

  // Fetch tracks from API (CLASSIC only)
  const isClassic = category.toUpperCase() === 'CLASSIC' || category.toUpperCase() === 'TEAM_CLASSIC';
  useEffect(() => {
    if (isClassic) {
      tracksApi.getAll().then((res) => setAllTracks(res.data));
    }
  }, [isClassic]);

  // Calculate verification progress (scores only, based on total match participants)
  const verifiedCount = participants.filter(p => p.status === 'VERIFIED').length;
  const totalRequired = props.matchParticipants.length;
  const noShowCount = participants.filter(p => p.status === 'NO_SHOW').length;
  const effectiveTotal = totalRequired - noShowCount;

  // Position conflict detection (CLASSIC mode only)
  const submittedCount = participants.filter(p =>
    p.status !== 'UNSUBMITTED' && p.status !== 'NO_SHOW'
  ).length;
  const unsubmittedCount = effectiveTotal - submittedCount;
  const allSubmitted = submittedCount >= effectiveTotal && effectiveTotal > 0;

  const positionConflicts = useMemo<ConflictResult[]>(() => {
    if (!allSubmitted) return [];
    return detectAllPositionConflicts(participants, isGpMode);
  }, [allSubmitted, participants, isGpMode]);

  const conflictUserIds = useMemo(() => {
    const ids = new Set<number>();
    for (const conflict of positionConflicts) {
      for (const u of conflict.allInvolvedUsers) {
        ids.add(u.userId);
      }
    }
    return ids;
  }, [positionConflicts]);

  // Verify a participant's score
  const handleVerifyScore = async (userId: number) => {
    setVerifyingScoreUserId(userId);
    try {
      await gamesApi.verifyScore(category, season, match, userId);
      onUpdate();
    } catch (error) {
      console.error('Failed to verify score:', error);
      alert('Failed to verify score');
    } finally {
      setVerifyingScoreUserId(null);
    }
  };

  // Reject a participant's score
  const handleRejectScore = async (userId: number) => {
    setRejectingScoreUserId(userId);
    try {
      await gamesApi.rejectScore(category, season, match, userId);
      onUpdate();
    } catch (error) {
      console.error('Failed to reject score:', error);
      alert('Failed to reject score');
    } finally {
      setRejectingScoreUserId(null);
    }
  };

  // Mark a participant as no-show (DNS)
  const handleMarkNoShow = async (userId: number) => {
    if (!confirm(tMod('markNoShowConfirm'))) return;
    setMarkingNoShowUserId(userId);
    try {
      await gamesApi.markNoShow(category, season, match, userId);
      onUpdate();
    } catch (error) {
      console.error('Failed to mark no-show:', error);
      alert('Failed to mark no-show');
    } finally {
      setMarkingNoShowUserId(null);
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

  const handleRegeneratePasscode = async () => {
    if (!confirm('Are you sure you want to regenerate the passcode?')) {
      return;
    }

    setRegeneratingPasscode(true);
    try {
      await gamesApi.regeneratePasscode(category, season, match);
      onUpdate();
    } catch (error) {
      console.error('Failed to regenerate passcode:', error);
      alert('Failed to regenerate passcode');
    } finally {
      setRegeneratingPasscode(false);
    }
  };

  // Helper to get race position display (same as match-details-table)
  const getRaceDisplay = (result: RaceResult | undefined) => {
    if (!result) return '-';
    // Disconnected: show "D" in blue
    if (result.isDisconnected) {
      return <span className="text-blue-400 font-medium">D</span>;
    }
    if (result.position === null) return '-';
    // Eliminated: show position in red
    if (result.isEliminated) {
      return <span className="text-red-400">{result.position}</span>;
    }
    return result.position;
  };

  // Merge matchParticipants with game participants to show all players
  const allParticipants = useMemo<Participant[]>(() => {
    const gameParticipantMap = new Map<number, Participant>();
    for (const p of participants) {
      gameParticipantMap.set(p.user.id, p);
    }
    return props.matchParticipants.map((mp) => {
      const gp = gameParticipantMap.get(mp.user.id);
      if (gp) return gp;
      // Not yet submitted - create placeholder
      return {
        user: {
          id: mp.user.id,
          displayName: mp.user.displayName,
          profile: mp.user.profile,
        },
        totalScore: null,
        eliminatedAtRace: null,
        machine: '',
        assistEnabled: false,
        raceResults: [],
        status: 'UNSUBMITTED',
      };
    });
  }, [participants, props.matchParticipants]);

  // Sort: submitted players by totalScore descending, then unsubmitted/no-show at the bottom
  const sortedParticipants = useMemo(() => {
    return [...allParticipants].sort((a, b) => {
      const aSubmitted = a.status !== 'UNSUBMITTED' && a.status !== 'NO_SHOW';
      const bSubmitted = b.status !== 'UNSUBMITTED' && b.status !== 'NO_SHOW';
      if (aSubmitted !== bSubmitted) return aSubmitted ? -1 : 1;
      return (b.totalScore ?? 0) - (a.totalScore ?? 0);
    });
  }, [allParticipants]);

  const handleTrackChange = (raceIndex: number, value: string) => {
    const trackId = value === 'none' ? null : parseInt(value, 10);
    setSelectedTracks((prev) => {
      const newTracks = [...prev];
      newTracks[raceIndex] = trackId;
      return newTracks;
    });
  };

  const getAvailableTracks = (raceIndex: number) => {
    // Filter to CLASSIC tracks (ID 201-220) only, and exclude tracks already selected in other races
    const otherSelectedTracks = selectedTracks.filter((_, i) => i !== raceIndex);
    return allTracks
      .filter((track) => track.id >= 201 && track.id <= 220)
      .filter((track) => !otherSelectedTracks.includes(track.id));
  };

  const handleSaveTracks = async () => {
    setSavingTracks(true);
    try {
      // Send tracks array preserving null positions
      await gamesApi.updateTracks(category, season, match, selectedTracks);
      onUpdate();
    } catch (error) {
      console.error('Failed to save tracks:', error);
      alert('Failed to save tracks');
    } finally {
      setSavingTracks(false);
    }
  };

  const tracksChanged =
    JSON.stringify(selectedTracks) !== JSON.stringify([tracks?.[0] ?? null, tracks?.[1] ?? null, tracks?.[2] ?? null]);

  return (
    <div className="space-y-4">
      {/* Regenerate Passcode Button */}
      {matchStatus === 'IN_PROGRESS' && hasPermission(user, 'REGENERATE_PASSCODE') && (
        <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <div>
            <p className="text-blue-400 font-medium text-sm">Regenerate Passcode</p>
            <p className="text-gray-400 text-xs">Force generate a new passcode for split lobby</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegeneratePasscode}
            disabled={regeneratingPasscode}
            className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
          >
            {regeneratingPasscode ? 'Regenerating...' : 'Regenerate'}
          </Button>
        </div>
      )}

      {/* Manual Match End / Finalize Button */}
      {(matchStatus === 'IN_PROGRESS' || matchStatus === 'COMPLETED') && hasPermission(user, 'END_MATCH') && (
        <div className="flex items-center justify-between p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <div>
            <p className="text-yellow-400 font-medium text-sm">
              {matchStatus === 'IN_PROGRESS' ? 'End Match' : 'Finalize Match'}
            </p>
            <p className="text-gray-400 text-xs">Calculate ratings and finalize results</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndMatch}
            disabled={endingMatch || effectiveTotal === 0 || verifiedCount < effectiveTotal}
          >
            {endingMatch ? 'Processing...' : matchStatus === 'IN_PROGRESS' ? 'End Match' : 'Finalize'}
          </Button>
        </div>
      )}

      {/* Track Selection (CLASSIC only) */}
      {isClassic && hasPermission(user, 'UPDATE_TRACKS') && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h3 className="text-sm font-medium text-white mb-3">Track Selection</h3>
          <div className="grid grid-cols-3 gap-3">
            {['R1', 'R2', 'R3'].map((label, index) => (
              <div key={label}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <Select
                  value={selectedTracks[index]?.toString() ?? 'none'}
                  onValueChange={(value) => handleTrackChange(index, value)}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-sm">
                    <SelectValue placeholder="Select track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {getAvailableTracks(index).map((track) => (
                      <SelectItem key={track.id} value={track.id.toString()}>
                        {track.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {tracksChanged && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveTracks}
                disabled={savingTracks}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingTracks ? 'Saving...' : 'Save Tracks'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Verification Progress */}
      <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Verification Progress</span>
          <span className={cn(
            "font-medium",
            verifiedCount >= effectiveTotal ? "text-green-400" : "text-yellow-400"
          )}>
            {verifiedCount} / {effectiveTotal} verified
            {noShowCount > 0 && (
              <span className="text-orange-400 ml-2">({noShowCount} DNS)</span>
            )}
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              verifiedCount >= effectiveTotal ? "bg-green-500" : "bg-yellow-500"
            )}
            style={{ width: `${Math.min((verifiedCount / Math.max(effectiveTotal, 1)) * 100, 100)}%` }}
          />
        </div>
        {!allSubmitted && unsubmittedCount > 0 && (
          <p className="mt-2 text-yellow-400 text-xs">
            {tMod('waitingForAllSubmissions', { count: unsubmittedCount })}
          </p>
        )}
      </div>

      {/* Position Conflict Detection */}
      {(isClassic || isGpMode) && (
        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Position Conflict Check</span>
          </div>

          {/* Show conflicts if all submitted, otherwise show waiting message */}
          {!allSubmitted ? (
            <p className="text-gray-400 text-xs">{tConflict('waitingForSubmissions')}</p>
          ) : (
            <div className="mt-2">
              {positionConflicts.length === 0 ? (
                <p className="text-green-400 text-sm">{tConflict('noConflicts')}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium text-sm">{tConflict('title')}</span>
                  </div>
                  {positionConflicts.map((conflict, idx) => (
                    <div
                      key={`${conflict.raceNumber}-${conflict.invalidPosition}-${idx}`}
                      className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-sm"
                    >
                      <p className="text-yellow-300 font-medium">
                        {tConflict('race', { raceNumber: conflict.raceNumber })}: {tConflict('conflictFound')}
                      </p>
                      <p className="text-gray-400 mt-1">{tConflict('requireScreenshot')}</p>
                      <ul className="ml-4 text-yellow-100">
                        {conflict.allInvolvedUsers.map((user) => (
                          <li key={user.userId}>
                            - {user.userName} {tConflict('positionLabel', { position: user.position })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {hasPermission(user, 'REJECT_SCORE') && (
                    <Button
                      size="sm"
                      variant={conflictNotified ? 'outline' : 'default'}
                      disabled={notifyingConflict || conflictNotified}
                      className={cn(
                        'mt-2',
                        conflictNotified
                          ? 'border-green-600 text-green-400'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      )}
                      onClick={async () => {
                        setNotifyingConflict(true);
                        try {
                          // Group conflicts by race, collecting all involved users
                          const conflictsByRace = new Map<number, Array<{ userId: number; position: number }>>();
                          for (const c of positionConflicts) {
                            if (!conflictsByRace.has(c.raceNumber)) {
                              conflictsByRace.set(c.raceNumber, []);
                            }
                            const existing = conflictsByRace.get(c.raceNumber)!;
                            for (const u of c.allInvolvedUsers) {
                              if (!existing.some((e) => e.userId === u.userId)) {
                                existing.push({ userId: u.userId, position: u.position });
                              }
                            }
                          }
                          const conflicts = Array.from(conflictsByRace.entries()).map(
                            ([raceNumber, users]) => ({ raceNumber, users })
                          );
                          await gamesApi.notifyPositionConflict(category, season, match, conflicts);
                          setConflictNotified(true);
                        } catch {
                          alert(tConflict('notifyFailed'));
                        } finally {
                          setNotifyingConflict(false);
                        }
                      }}
                    >
                      {conflictNotified
                        ? tConflict('notified')
                        : notifyingConflict
                          ? tConflict('notifying')
                          : tConflict('notifyDiscord')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 px-2 font-medium">#</th>
              <th className="py-2 px-1 w-6"></th>
              <th className="text-left py-2 px-2 font-medium">Player</th>
              <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Machine</th>
              {Array.from({ length: raceCount }, (_, i) => (
                <th key={`rh${i + 1}`} className="text-center py-2 px-1 font-medium w-10">R{i + 1}</th>
              ))}
              <th className="text-right py-2 px-2 font-medium">Pts</th>
              <th className="text-center py-2 px-2 font-medium">Status</th>
              <th className="text-center py-2 px-2 font-medium">Verify</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant, index) => {
              return (
                <tr
                  key={participant.user.id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30"
                >
                  {/* Rank */}
                  <td className={cn(
                    'py-2 px-2 font-bold',
                    index < 3 ? 'text-yellow-400' : 'text-gray-100'
                  )}>
                    {index + 1}
                  </td>

                  {/* Country */}
                  <td className="py-2 px-1 w-6">
                    <span
                      className={`fi fi-${participant.user.profile?.country?.toLowerCase() || 'un'}`}
                      title={participant.user.profile?.country || 'Unknown'}
                    />
                  </td>

                  {/* Player Name */}
                  <td className="py-2 px-2 text-white truncate max-w-[100px]">
                    <span className="flex items-center gap-1">
                      {participant.user.displayName || `User#${participant.user.id}`}
                      {participant.assistEnabled && !isClassic && (
                        <span className="text-xs text-yellow-400 font-bold" title="Assist Mode">A</span>
                      )}
                    </span>
                  </td>

                  {/* Machine - hidden on mobile */}
                  <td className="py-2 px-2 text-gray-100 truncate max-w-[100px] hidden sm:table-cell">
                    {participant.machine || '-'}
                  </td>

                  {/* Race columns */}
                  {Array.from({ length: raceCount }, (_, i) => (
                    <td key={`r${i + 1}`} className="py-2 px-1 text-center text-gray-100">
                      {getRaceDisplay(participant.raceResults?.find(r => r.raceNumber === i + 1))}
                    </td>
                  ))}

                  {/* Points */}
                  <td className="py-2 px-2 text-right font-medium text-white">
                    {participant.totalScore ?? '-'}
                  </td>

                  {/* Status */}
                  <td className="py-2 px-2 text-center">
                    {participant.status === 'NO_SHOW' ? (
                      <span className="text-xs font-medium text-orange-400">
                        {t('noShow')}
                      </span>
                    ) : participant.status !== 'UNSUBMITTED' ? (
                      <span className={cn(
                        "text-xs font-medium",
                        participant.status === 'VERIFIED'
                          ? 'text-green-400'
                          : participant.status === 'REJECTED'
                          ? 'text-red-400'
                          : 'text-blue-400'
                      )}>
                        {participant.status === 'VERIFIED'
                          ? t('ok')
                          : participant.status === 'REJECTED'
                          ? t('ng')
                          : t('pending')}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>

                  {/* Score Verify/Reject - Based on participant.status */}
                  <td className="py-2 px-2 text-center">
                    {(() => {
                      if (participant.status === 'VERIFIED') {
                        return <Check className="w-4 h-4 text-green-400 mx-auto" />;
                      }

                      if (participant.status === 'NO_SHOW') {
                        return <span className="text-orange-400 text-xs">{tMod('markNoShow')}</span>;
                      }

                      // Show buttons if pending or rejected
                      if (participant.status === 'PENDING' || participant.status === 'REJECTED') {
                        const canVerify = hasPermission(user, 'VERIFY_SCORE');
                        const canReject = hasPermission(user, 'REJECT_SCORE');
                        if (!canVerify && !canReject) {
                          return <span className="text-blue-400 text-xs">{t('pending')}</span>;
                        }
                        return (
                          <div className="flex items-center justify-center gap-1">
                            {canVerify && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVerifyScore(participant.user.id)}
                                disabled={!allSubmitted || participant.status === 'REJECTED' || verifyingScoreUserId === participant.user.id || rejectingScoreUserId === participant.user.id || conflictUserIds.has(participant.user.id)}
                                className="h-6 px-2 text-xs bg-green-600/20 border-green-600 text-green-400 hover:bg-green-600/40"
                              >
                                {verifyingScoreUserId === participant.user.id ? '...' : 'Verify'}
                              </Button>
                            )}
                            {canReject && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectScore(participant.user.id)}
                                disabled={participant.status === 'REJECTED' || verifyingScoreUserId === participant.user.id || rejectingScoreUserId === participant.user.id}
                                className="h-6 px-2 text-xs bg-red-600/20 border-red-600 text-red-400 hover:bg-red-600/40"
                              >
                                {rejectingScoreUserId === participant.user.id ? '...' : 'Reject'}
                              </Button>
                            )}
                          </div>
                        );
                      }

                      // UNSUBMITTED: show DNS button for moderators
                      if (participant.status === 'UNSUBMITTED' && hasPermission(user, 'VERIFY_SCORE')) {
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkNoShow(participant.user.id)}
                            disabled={markingNoShowUserId === participant.user.id}
                            className="h-6 px-2 text-xs bg-orange-600/20 border-orange-600 text-orange-400 hover:bg-orange-600/40"
                          >
                            {markingNoShowUserId === participant.user.id ? '...' : tMod('markNoShow')}
                          </Button>
                        );
                      }

                      return <span className="text-gray-500 text-xs">-</span>;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score Edit Form - available until match is finalized */}
      {(matchStatus === 'IN_PROGRESS' || matchStatus === 'COMPLETED') && hasPermission(user, 'EDIT_SCORE') && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <ScoreSubmissionForm
            mode={category}
            season={season}
            game={match}
            deadline={deadline}
            participants={props.matchParticipants}
            onScoreSubmitted={onUpdate}
          />
        </div>
      )}
    </div>
  );
}
