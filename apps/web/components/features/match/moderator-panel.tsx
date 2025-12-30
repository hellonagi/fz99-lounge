'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gamesApi, screenshotsApi, tracksApi, Track } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { ScoreSubmissionForm } from './score-submission-form';

interface RaceResult {
  raceNumber: number;
  position: number | null;
  points: number | null;
  isEliminated: boolean;
  isDisconnected: boolean;
}

interface Screenshot {
  id: number;
  userId: number;
  imageUrl: string | null;
  type: 'INDIVIDUAL' | 'FINAL_SCORE';
  isVerified: boolean;
  isRejected?: boolean;
  isDeleted?: boolean;
  user: {
    id: number;
    displayName: string | null;
  };
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
}

interface ModeratorPanelProps {
  gameId: number;
  matchId: number;
  matchStatus: string;
  participants: Participant[];
  screenshots?: Screenshot[];
  category: string;
  season: number;
  match: number;
  deadline: string;
  tracks?: number[] | null;
  onUpdate: () => void;
}

export function ModeratorPanel({
  gameId,
  matchId,
  matchStatus,
  participants,
  screenshots = [],
  category,
  season,
  match,
  deadline,
  tracks,
  onUpdate,
}: ModeratorPanelProps) {
  const [endingMatch, setEndingMatch] = useState(false);
  const [regeneratingPasscode, setRegeneratingPasscode] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Track selection state (CLASSIC only)
  const [selectedTracks, setSelectedTracks] = useState<(number | null)[]>([
    tracks?.[0] ?? null,
    tracks?.[1] ?? null,
    tracks?.[2] ?? null,
  ]);
  const [savingTracks, setSavingTracks] = useState(false);
  const [allTracks, setAllTracks] = useState<Track[]>([]);

  // Fetch tracks from API (CLASSIC only)
  const isClassic = category.toUpperCase() === 'CLASSIC';
  useEffect(() => {
    if (isClassic) {
      tracksApi.getAll().then((res) => setAllTracks(res.data));
    }
  }, [isClassic]);

  // Get screenshots by type
  const individualScreenshots = screenshots.filter(s => s.type === 'INDIVIDUAL');
  const finalScoreScreenshots = screenshots.filter(s => s.type === 'FINAL_SCORE');

  // Calculate verification progress
  const totalRequired = participants.length + 1; // participants + 1 final score
  const verifiedCount = screenshots.filter(s => s.isVerified).length;

  // Get screenshot for a specific user
  const getScreenshotForUser = (userId: number) => {
    return individualScreenshots.find(s => s.userId === userId);
  };

  // Verify a screenshot
  const handleVerify = async (submissionId: number) => {
    setVerifyingId(submissionId);
    try {
      await screenshotsApi.verify(submissionId);
      onUpdate();
    } catch (error) {
      console.error('Failed to verify screenshot:', error);
      alert('Failed to verify screenshot');
    } finally {
      setVerifyingId(null);
    }
  };

  // Reject a screenshot
  const handleReject = async (submissionId: number) => {
    setRejectingId(submissionId);
    try {
      await screenshotsApi.reject(submissionId);
      onUpdate();
    } catch (error) {
      console.error('Failed to reject screenshot:', error);
      alert('Failed to reject screenshot');
    } finally {
      setRejectingId(null);
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

  // Track selection handlers (CLASSIC only)
  const getTrackById = (id: number) => allTracks.find((t) => t.id === id);

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
      {matchStatus === 'IN_PROGRESS' && (
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
            {endingMatch ? 'Processing...' : matchStatus === 'IN_PROGRESS' ? 'End Match' : 'Finalize'}
          </Button>
        </div>
      )}

      {/* Track Selection (CLASSIC only) */}
      {isClassic && (
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
            verifiedCount >= totalRequired ? "text-green-400" : "text-yellow-400"
          )}>
            {verifiedCount} / {totalRequired} verified
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              verifiedCount >= totalRequired ? "bg-green-500" : "bg-yellow-500"
            )}
            style={{ width: `${Math.min((verifiedCount / totalRequired) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 px-2 font-medium">#</th>
              <th className="py-2 px-1 w-6"></th>
              <th className="text-left py-2 px-2 font-medium">Player</th>
              <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Machine</th>
              <th className="text-center py-2 px-1 font-medium w-10">R1</th>
              <th className="text-center py-2 px-1 font-medium w-10">R2</th>
              <th className="text-center py-2 px-1 font-medium w-10">R3</th>
              <th className="text-right py-2 px-2 font-medium">Pts</th>
              <th className="text-center py-2 px-2 font-medium">Status</th>
              <th className="text-center py-2 px-2 font-medium">Verify</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant, index) => {
              const r1 = participant.raceResults?.find(r => r.raceNumber === 1);
              const r2 = participant.raceResults?.find(r => r.raceNumber === 2);
              const r3 = participant.raceResults?.find(r => r.raceNumber === 3);
              const screenshot = getScreenshotForUser(participant.user.id);

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

                  {/* R1 */}
                  <td className="py-2 px-1 text-center text-gray-100">
                    {getRaceDisplay(r1)}
                  </td>

                  {/* R2 */}
                  <td className="py-2 px-1 text-center text-gray-100">
                    {getRaceDisplay(r2)}
                  </td>

                  {/* R3 */}
                  <td className="py-2 px-1 text-center text-gray-100">
                    {getRaceDisplay(r3)}
                  </td>

                  {/* Points */}
                  <td className="py-2 px-2 text-right font-medium text-white">
                    {participant.totalScore ?? '-'}
                  </td>

                  {/* Status */}
                  <td className="py-2 px-2 text-center">
                    {screenshot ? (
                      (() => {
                        const statusText = screenshot.isVerified
                          ? 'Verified'
                          : screenshot.isRejected
                          ? 'Rejected'
                          : 'Submitted';
                        const statusColor = screenshot.isVerified
                          ? 'text-green-400'
                          : screenshot.isRejected
                          ? 'text-red-400'
                          : 'text-blue-400';

                        return screenshot.imageUrl ? (
                          <button
                            onClick={() => setSelectedImage(screenshot.imageUrl!)}
                            className={cn("text-xs font-medium hover:underline", statusColor)}
                            title="View screenshot"
                          >
                            {statusText}
                          </button>
                        ) : (
                          <span className={cn("text-xs font-medium", statusColor)}>
                            {statusText}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>

                  {/* Verify/Reject */}
                  <td className="py-2 px-2 text-center">
                    {screenshot && !screenshot.isVerified && !screenshot.isRejected ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerify(screenshot.id)}
                          disabled={verifyingId === screenshot.id || rejectingId === screenshot.id}
                          className="h-6 px-2 text-xs bg-green-600/20 border-green-600 text-green-400 hover:bg-green-600/40"
                        >
                          {verifyingId === screenshot.id ? '...' : 'Verify'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(screenshot.id)}
                          disabled={verifyingId === screenshot.id || rejectingId === screenshot.id}
                          className="h-6 px-2 text-xs bg-red-600/20 border-red-600 text-red-400 hover:bg-red-600/40"
                        >
                          {rejectingId === screenshot.id ? '...' : 'Reject'}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Screenshots Section */}
      {finalScoreScreenshots.length > 0 && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-bold text-white mb-4">Screenshots</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finalScoreScreenshots.map((screenshot) => (
              <div key={screenshot.id} className="space-y-3">
                {/* Screenshot Image */}
                {screenshot.imageUrl ? (
                  <div
                    className="relative aspect-video rounded-lg overflow-hidden bg-gray-800 border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedImage(screenshot.imageUrl)}
                  >
                    <Image
                      src={screenshot.imageUrl}
                      alt="Final Score"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Image deleted</span>
                  </div>
                )}

                {/* Submitted by */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    Submitted by{' '}
                    <span className="text-white">
                      {screenshot.user.displayName || `User#${screenshot.user.id}`}
                    </span>
                  </p>

                  {/* Verify Status */}
                  {screenshot.isVerified ? (
                    <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" /> Verified
                    </span>
                  ) : screenshot.isRejected ? (
                    <span className="text-red-400 text-sm font-medium">Rejected</span>
                  ) : screenshot.imageUrl ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleVerify(screenshot.id)}
                        disabled={verifyingId === screenshot.id || rejectingId === screenshot.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {verifyingId === screenshot.id ? '...' : 'Verify'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleReject(screenshot.id)}
                        disabled={verifyingId === screenshot.id || rejectingId === screenshot.id}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {rejectingId === screenshot.id ? '...' : 'Reject'}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Edit Form - available until match is finalized */}
      {(matchStatus === 'IN_PROGRESS' || matchStatus === 'COMPLETED') && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <ScoreSubmissionForm
            mode={category}
            season={season}
            game={match}
            deadline={deadline}
            participants={participants}
            onScoreSubmitted={onUpdate}
          />
        </div>
      )}

      {/* Screenshot Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0" aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>Screenshot Preview</DialogTitle>
          </VisuallyHidden>
          {selectedImage && (
            <div className="relative w-full aspect-video">
              <Image
                src={selectedImage}
                alt="Screenshot"
                fill
                className="object-contain rounded-lg"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
