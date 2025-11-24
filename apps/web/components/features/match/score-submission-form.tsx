'use client';

import { useState } from 'react';
import { matchesApi } from '@/lib/api';

const F99_MACHINES = [
  { value: 'Blue Falcon', name: 'Blue Falcon', color: 'text-blue-400' },
  { value: 'Golden Fox', name: 'Golden Fox', color: 'text-yellow-400' },
  { value: 'Wild Goose', name: 'Wild Goose', color: 'text-green-400' },
  { value: 'Fire Stingray', name: 'Fire Stingray', color: 'text-red-400' },
];

interface ScoreSubmissionFormProps {
  mode: string;
  season: number;
  game: number;
  onScoreSubmitted?: () => void;
}

export function ScoreSubmissionForm({ mode, season, game, onScoreSubmitted }: ScoreSubmissionFormProps) {
  const [position, setPosition] = useState('');
  const [points, setPoints] = useState('');
  const [machine, setMachine] = useState('Blue Falcon');
  const [assistEnabled, setAssistEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await matchesApi.submitScore(mode, season, game, {
        position: parseInt(position, 10),
        reportedPoints: parseInt(points, 10),
        machine,
        assistEnabled,
      });

      setSuccess(true);
      setPosition('');
      setPoints('');
      setMachine('Blue Falcon');
      setAssistEnabled(false);

      if (onScoreSubmitted) {
        onScoreSubmitted();
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">Submit Your Result</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Position Input */}
          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-300 mb-1">
              Position <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1-99"
              required
              min="1"
              max="99"
            />
          </div>

          {/* Points Input */}
          <div>
            <label htmlFor="points" className="block text-sm font-medium text-gray-300 mb-1">
              Points <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="points"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0-1000"
              required
              min="0"
              max="1000"
            />
          </div>
        </div>

        {/* Machine Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Machine <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {F99_MACHINES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMachine(m.value)}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  machine === m.value
                    ? 'bg-gray-700 border-blue-500'
                    : 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                }`}
              >
                <span className={`font-medium ${machine === m.value ? m.color : 'text-gray-400'}`}>
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Assist Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
          <div>
            <label htmlFor="assist" className="text-sm font-medium text-gray-300">
              Assist Mode
            </label>
            <p className="text-xs text-gray-500 mt-1">Was assist enabled during this race?</p>
          </div>
          <button
            type="button"
            onClick={() => setAssistEnabled(!assistEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              assistEnabled ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                assistEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-900/50 border border-green-600 rounded-lg text-green-200">
            Score submitted successfully!
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !position || !points}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Result'}
        </button>
      </form>
    </div>
  );
}