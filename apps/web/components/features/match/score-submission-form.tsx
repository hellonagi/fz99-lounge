'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { matchesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const F99_MACHINES = [
  { value: 'Blue Falcon', name: 'Blue Falcon', color: 'text-blue-400' },
  { value: 'Golden Fox', name: 'Golden Fox', color: 'text-yellow-400' },
  { value: 'Wild Goose', name: 'Wild Goose', color: 'text-green-400' },
  { value: 'Fire Stingray', name: 'Fire Stingray', color: 'text-red-400' },
] as const;

const scoreSchema = z.object({
  points: z
    .string()
    .min(1, 'Points is required')
    .refine((val) => !isNaN(parseInt(val, 10)), 'Points must be a number')
    .refine((val) => {
      const num = parseInt(val, 10);
      return num >= 0 && num <= 1000;
    }, 'Points must be between 0 and 1000'),
  machine: z.string().min(1, 'Machine is required'),
  assistEnabled: z.boolean(),
  targetUserId: z.string().optional(),
});

type ScoreFormData = z.infer<typeof scoreSchema>;

interface Participant {
  user: {
    id: string;
    profileId: number;
    discordId: string;
    displayName: string | null;
    avatarHash?: string | null;
  };
}

interface ScoreSubmissionFormProps {
  mode: string;
  season: number;
  game: number;
  participants: Participant[];
  onScoreSubmitted?: () => void;
}

export function ScoreSubmissionForm({ mode, season, game, participants, onScoreSubmitted }: ScoreSubmissionFormProps) {
  const [success, setSuccess] = useState(false);
  const { user } = useAuthStore();

  // Check if user is moderator or admin
  const isModerator = user?.role === 'MODERATOR' || user?.role === 'ADMIN';

  const form = useForm<ScoreFormData>({
    resolver: zodResolver(scoreSchema),
    defaultValues: {
      points: '',
      machine: 'Blue Falcon',
      assistEnabled: false,
      targetUserId: undefined,
    },
  });

  const { isSubmitting } = form.formState;
  const selectedMachine = form.watch('machine');

  const onSubmit = async (data: ScoreFormData) => {
    try {
      await matchesApi.submitScore(mode, season, game, {
        reportedPoints: parseInt(data.points, 10),
        machine: data.machine,
        assistEnabled: data.assistEnabled,
        targetUserId: data.targetUserId,
      });

      setSuccess(true);
      form.reset();

      if (onScoreSubmitted) {
        onScoreSubmitted();
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      form.setError('root', {
        type: 'manual',
        message: err.message || 'Failed to submit score',
      });
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">
        {isModerator ? 'Submit Score (Moderator)' : 'Submit Your Result'}
      </h3>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Participant Selection (Moderator only) */}
          {isModerator && (
            <FormField
              control={form.control}
              name="targetUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">
                    Select Participant <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Choose a participant..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {participants.map((p) => (
                        <SelectItem
                          key={p.user.id}
                          value={p.user.id}
                          className="text-white hover:bg-gray-600"
                        >
                          {p.user.displayName || p.user.discordId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-gray-500">
                    Select the participant you are submitting scores for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Points Input */}
          <FormField
            control={form.control}
            name="points"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">
                  Points <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0-1000"
                    min="0"
                    max="1000"
                    className="bg-gray-700 border-gray-600 text-white"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Machine Selection */}
          <FormField
            control={form.control}
            name="machine"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">
                  Machine <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <div className="grid grid-cols-2 gap-3">
                    {F99_MACHINES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => field.onChange(m.value)}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          selectedMachine === m.value
                            ? 'bg-gray-700 border-blue-500'
                            : 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                        }`}
                      >
                        <span className={`font-medium ${selectedMachine === m.value ? m.color : 'text-gray-400'}`}>
                          {m.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Assist Toggle */}
          <FormField
            control={form.control}
            name="assistEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                <div className="space-y-0.5">
                  <FormLabel className="text-gray-300">Assist Mode</FormLabel>
                  <FormDescription className="text-gray-500">
                    Was assist enabled during this race?
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Error Message */}
          {form.formState.errors.root && (
            <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert variant="success">Score submitted successfully!</Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Result'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
