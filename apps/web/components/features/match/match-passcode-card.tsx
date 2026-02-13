'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { gamesApi } from '@/lib/api';
import { Split } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface SplitVoteStatus {
  currentVotes: number;
  requiredVotes: number;
  hasVoted: boolean;
}

interface MatchPasscodeCardProps {
  passcode: string | null;
  isParticipant?: boolean;
  matchStatus?: string;
  category?: string;
  season?: number;
  match?: number;
  splitVoteStatus?: SplitVoteStatus | null;
  onSplitVote?: () => void;
  passcodeRevealTime?: string | null;
  onPasscodeRevealed?: () => void;
  inGameMode?: string | null;
}

export function MatchPasscodeCard({
  passcode,
  isParticipant = false,
  matchStatus,
  category,
  season,
  match,
  splitVoteStatus,
  onSplitVote,
  passcodeRevealTime,
  onPasscodeRevealed,
  inGameMode,
}: MatchPasscodeCardProps) {
  const [voting, setVoting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [revealed, setRevealed] = useState(false);
  const t = useTranslations('splitVote');
  const tTeam = useTranslations('teamClassic');

  const isCountdown = !!passcodeRevealTime && !revealed;

  // Countdown timer
  useEffect(() => {
    if (!passcodeRevealTime) return;

    const updateTimer = () => {
      const now = Date.now();
      const revealTime = new Date(passcodeRevealTime).getTime();
      const remaining = Math.max(0, revealTime - now);
      setTimeRemaining(remaining);

      if (remaining <= 0 && !revealed) {
        setRevealed(true);
        onPasscodeRevealed?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [passcodeRevealTime, revealed, onPasscodeRevealed]);

  // If no passcodeRevealTime, always show passcode
  useEffect(() => {
    if (!passcodeRevealTime) {
      setRevealed(true);
    }
  }, [passcodeRevealTime]);

  // Check initial state
  useEffect(() => {
    if (passcodeRevealTime) {
      const revealTime = new Date(passcodeRevealTime).getTime();
      if (Date.now() >= revealTime) {
        setRevealed(true);
      }
    }
  }, [passcodeRevealTime]);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Don't render if no passcode and not in countdown mode
  if (!passcode && !isCountdown) {
    return null;
  }

  const handleSplitVote = async () => {
    if (!category || season === undefined || match === undefined) return;

    setVoting(true);
    try {
      const response = await gamesApi.castSplitVote(category, season, match);
      if (response.data.regenerated) {
        alert(`${t('newPasscode')}\n${t('newPasscodeDescription', { passcode: response.data.passcode })}`);
      }
      onSplitVote?.();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      alert(axiosError.response?.data?.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  const showSplitButton = isParticipant && matchStatus === 'IN_PROGRESS' && category && season !== undefined && match !== undefined;
  const hasVoted = splitVoteStatus?.hasVoted ?? false;
  const progressPercent = splitVoteStatus && splitVoteStatus.requiredVotes > 0
    ? Math.min((splitVoteStatus.currentVotes / splitVoteStatus.requiredVotes) * 100, 100)
    : 0;

  return (
    <Card showGradient className="bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border-indigo-500/30">
      <CardContent className="text-center">
        {inGameMode && (
          <p className="text-sm text-gray-400 mb-1">
            {inGameMode.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
          </p>
        )}
        <p className="text-sm text-gray-400 mb-2">Passcode</p>

        {isCountdown && timeRemaining > 0 ? (
          // Countdown mode
          <div className="text-center">
            <p className="text-gray-300 mb-1">{tTeam('passcodeRevealIn')}</p>
            <span className="font-mono text-4xl text-white">
              {formatTime(timeRemaining)}
            </span>
            <p className="text-sm text-gray-400 mt-2">
              {tTeam('passcodeHidden')}
            </p>
          </div>
        ) : (
          // Passcode revealed
          <>
            <p className="text-5xl font-black text-white tracking-wider font-mono">
              {passcode}
            </p>

            {showSplitButton && revealed && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-sm text-gray-400 mb-1">
                  {t('description')}
                </p>
                <Button
                  variant={hasVoted ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={handleSplitVote}
                  disabled={voting || hasVoted}
                  className="flex items-center gap-2"
                >
                  <Split className="w-4 h-4" />
                  {hasVoted ? t('voted') : t('button')}
                </Button>
                {splitVoteStatus && splitVoteStatus.currentVotes > 0 && (
                  <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
