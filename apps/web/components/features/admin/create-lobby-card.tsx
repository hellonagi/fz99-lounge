'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown } from 'lucide-react';
import { lobbiesApi } from '@/lib/api';

const LEAGUE_OPTIONS_99 = [
  { value: 'KNIGHT', label: 'Knight League' },
  { value: 'QUEEN', label: 'Queen League' },
  { value: 'KING', label: 'King League' },
  { value: 'ACE', label: 'Ace League' },
  { value: 'MIRROR_KNIGHT', label: 'Mirror Knight League' },
  { value: 'MIRROR_QUEEN', label: 'Mirror Queen League' },
  { value: 'MIRROR_KING', label: 'Mirror King League' },
  { value: 'MIRROR_ACE', label: 'Mirror Ace League' },
];

const LEAGUE_OPTIONS_CLASSIC = [
  { value: 'CLASSIC_MINI', label: 'Classic Mini' },
];

export function CreateLobbyCard() {
  const [gameMode, setGameMode] = useState<'GP' | 'CLASSIC'>('GP');
  const [leagueType, setLeagueType] = useState('KNIGHT');
  const [scheduledStart, setScheduledStart] = useState('');
  const [minPlayers, setMinPlayers] = useState('40');
  const [maxPlayers, setMaxPlayers] = useState('99');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const leagueOptions = gameMode === 'GP' ? LEAGUE_OPTIONS_99 : LEAGUE_OPTIONS_CLASSIC;

  const handleGameModeChange = (mode: 'GP' | 'CLASSIC') => {
    setGameMode(mode);
    if (mode === 'GP') {
      setLeagueType('KNIGHT');
      setMinPlayers('40');
      setMaxPlayers('99');
    } else {
      setLeagueType('CLASSIC_MINI');
      setMinPlayers('10');
      setMaxPlayers('20');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!scheduledStart) {
      setError('Please select a start time');
      return;
    }

    const min = parseInt(minPlayers);
    const max = parseInt(maxPlayers);

    if (isNaN(min) || isNaN(max)) {
      setError('Player counts must be numbers');
      return;
    }

    if (min < 1 || max < min) {
      setError('Invalid player count range');
      return;
    }

    setIsSubmitting(true);

    try {
      await lobbiesApi.create({
        gameMode,
        leagueType,
        scheduledStart: new Date(scheduledStart).toISOString(),
        minPlayers: min,
        maxPlayers: max,
        notes: notes || undefined,
      });

      setSuccess(true);
      // Reset form
      setScheduledStart('');
      setNotes('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create lobby');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Lobby</CardTitle>
        <CardDescription>Schedule a new match lobby</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game Mode */}
          <div className="space-y-2">
            <Label>Game Mode</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="GP"
                  checked={gameMode === 'GP'}
                  onChange={(e) => handleGameModeChange(e.target.value as 'GP')}
                  className="w-4 h-4"
                />
                <span className="text-sm">99 Mode</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="CLASSIC"
                  checked={gameMode === 'CLASSIC'}
                  onChange={(e) => handleGameModeChange(e.target.value as 'CLASSIC')}
                  className="w-4 h-4"
                />
                <span className="text-sm">Classic Mode</span>
              </label>
            </div>
          </div>

          {/* League Type */}
          <div className="space-y-2">
            <Label htmlFor="leagueType">League Type</Label>
            <div className="relative">
              <select
                id="leagueType"
                value={leagueType}
                onChange={(e) => setLeagueType(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-600 rounded-md bg-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {leagueOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-gray-700 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
            </div>
          </div>

          {/* Scheduled Start */}
          <div className="space-y-2">
            <Label htmlFor="scheduledStart">Scheduled Start Time</Label>
            <Input
              id="scheduledStart"
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              required
            />
          </div>

          {/* Player Count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPlayers">Min Players</Label>
              <Input
                id="minPlayers"
                type="number"
                min="1"
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Max Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                min="1"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes for this lobby..."
              rows={3}
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              Lobby created successfully!
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating...' : 'Create Lobby'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
