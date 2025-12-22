'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { gamesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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

// GP mode schema (points-based)
const gpScoreSchema = z.object({
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

// CLASSIC mode schema (race-by-race positions with elimination status)
const classicScoreSchema = z.object({
  machine: z.string().min(1, 'Machine is required'),
  assistEnabled: z.boolean(),
  targetUserId: z.string().optional(),
  race1Position: z.string().optional(),
  race1Out: z.boolean(),
  race2Position: z.string().optional(),
  race2Out: z.boolean(),
  race3Position: z.string().optional(),
  race3Out: z.boolean(),
});

type GpScoreFormData = z.infer<typeof gpScoreSchema>;
type ClassicScoreFormData = z.infer<typeof classicScoreSchema>;

interface Participant {
  user: {
    id: number;
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

  // Determine if this is CLASSIC mode
  const isClassicMode = mode.toLowerCase() === 'classic';

  // Check if user is moderator or admin
  const isModerator = user?.role === 'MODERATOR' || user?.role === 'ADMIN';

  // GP mode form
  const gpForm = useForm<GpScoreFormData>({
    resolver: zodResolver(gpScoreSchema),
    defaultValues: {
      points: '',
      machine: 'Blue Falcon',
      assistEnabled: false,
      targetUserId: undefined,
    },
  });

  // CLASSIC mode form
  const classicForm = useForm<ClassicScoreFormData>({
    resolver: zodResolver(classicScoreSchema),
    defaultValues: {
      machine: 'Blue Falcon',
      assistEnabled: false,
      targetUserId: undefined,
      race1Position: '',
      race1Out: false,
      race2Position: '',
      race2Out: false,
      race3Position: '',
      race3Out: false,
    },
  });

  // Watch out status to disable position inputs
  const race1Out = classicForm.watch('race1Out');
  const race2Out = classicForm.watch('race2Out');
  // When race N is out, race N's position and all subsequent races' positions are disabled
  const isRace1PositionDisabled = race1Out;
  const isRace2PositionDisabled = race1Out || race2Out;
  const isRace3PositionDisabled = race1Out || race2Out || classicForm.watch('race3Out');

  const form = isClassicMode ? classicForm : gpForm;
  const { isSubmitting } = form.formState;
  const selectedMachine = form.watch('machine');

  const onSubmitGp = async (data: GpScoreFormData) => {
    try {
      await gamesApi.submitScore(mode, season, game, {
        reportedPoints: parseInt(data.points, 10),
        machine: data.machine,
        assistEnabled: data.assistEnabled,
        targetUserId: data.targetUserId ? parseInt(data.targetUserId, 10) : undefined,
      });

      setSuccess(true);
      gpForm.reset();

      if (onScoreSubmitted) {
        onScoreSubmitted();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      gpForm.setError('root', {
        type: 'manual',
        message: err.response?.data?.message || err.message || 'Failed to submit score',
      });
    }
  };

  const onSubmitClassic = async (data: ClassicScoreFormData) => {
    try {
      // Build race results array
      const raceResults = [];

      // Race 1 - position is null if out
      raceResults.push({
        raceNumber: 1,
        position: data.race1Out ? undefined : (data.race1Position ? parseInt(data.race1Position, 10) : undefined),
        isEliminated: data.race1Out,
      });

      // Race 2 - position is null if race1 or race2 is out
      const race2Eliminated = data.race1Out || data.race2Out;
      raceResults.push({
        raceNumber: 2,
        position: race2Eliminated ? undefined : (data.race2Position ? parseInt(data.race2Position, 10) : undefined),
        isEliminated: race2Eliminated,
      });

      // Race 3 - position is null if any previous race is out
      const race3Eliminated = data.race1Out || data.race2Out || data.race3Out;
      raceResults.push({
        raceNumber: 3,
        position: race3Eliminated ? undefined : (data.race3Position ? parseInt(data.race3Position, 10) : undefined),
        isEliminated: race3Eliminated,
      });

      await gamesApi.submitScore(mode, season, game, {
        machine: data.machine,
        assistEnabled: data.assistEnabled,
        targetUserId: data.targetUserId ? parseInt(data.targetUserId, 10) : undefined,
        raceResults,
      });

      setSuccess(true);
      classicForm.reset();

      if (onScoreSubmitted) {
        onScoreSubmitted();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      classicForm.setError('root', {
        type: 'manual',
        message: err.response?.data?.message || err.message || 'Failed to submit score',
      });
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-4">
        {isModerator ? 'Submit Score (Moderator)' : 'Submit Your Result'}
      </h3>

      {isClassicMode ? (
        // CLASSIC mode form
        <Form {...classicForm}>
          <form onSubmit={classicForm.handleSubmit(onSubmitClassic)} className="space-y-4">
            {/* Participant Selection (Moderator only) */}
            {isModerator && (
              <FormField
                control={classicForm.control}
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
                            value={String(p.user.id)}
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

            {/* Machine Selection */}
            <FormField
              control={classicForm.control}
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
              control={classicForm.control}
              name="assistEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel className="text-gray-300">Assist Mode</FormLabel>
                    <FormDescription className="text-gray-500">
                      Was assist enabled during this match?
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

            {/* Race Results */}
            <div className="space-y-3">
              <FormLabel className="text-gray-300">Race Results</FormLabel>

              {/* Race 1 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-16 font-medium text-gray-300">Race 1</div>
                  <FormField
                    control={classicForm.control}
                    name="race1Position"
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace1PositionDisabled}
                            className="bg-gray-700 border-gray-600 text-white disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race1Out"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="race1Out"
                          />
                        </FormControl>
                        <Label htmlFor="race1Out" className="text-gray-300 text-sm cursor-pointer">
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Race 2 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-16 font-medium text-gray-300">Race 2</div>
                  <FormField
                    control={classicForm.control}
                    name="race2Position"
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace2PositionDisabled}
                            className="bg-gray-700 border-gray-600 text-white disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race2Out"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={race1Out}
                            id="race2Out"
                          />
                        </FormControl>
                        <Label htmlFor="race2Out" className={`text-sm cursor-pointer ${race1Out ? 'text-gray-500' : 'text-gray-300'}`}>
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Race 3 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-16 font-medium text-gray-300">Race 3</div>
                  <FormField
                    control={classicForm.control}
                    name="race3Position"
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace3PositionDisabled}
                            className="bg-gray-700 border-gray-600 text-white disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race3Out"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={race1Out || race2Out}
                            id="race3Out"
                          />
                        </FormControl>
                        <Label htmlFor="race3Out" className={`text-sm cursor-pointer ${race1Out || race2Out ? 'text-gray-500' : 'text-gray-300'}`}>
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormDescription className="text-gray-500">
                1st = 100pts, 2nd = 95pts... (5pt decrements). Ranked/Crashed out = 0pts.
              </FormDescription>
            </div>

            {/* Error Message */}
            {classicForm.formState.errors.root && (
              <Alert variant="destructive">{classicForm.formState.errors.root.message}</Alert>
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
      ) : (
        // GP mode form (original)
        <Form {...gpForm}>
          <form onSubmit={gpForm.handleSubmit(onSubmitGp)} className="space-y-4">
            {/* Participant Selection (Moderator only) */}
            {isModerator && (
              <FormField
                control={gpForm.control}
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
                            value={String(p.user.id)}
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
              control={gpForm.control}
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
              control={gpForm.control}
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
              control={gpForm.control}
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
            {gpForm.formState.errors.root && (
              <Alert variant="destructive">{gpForm.formState.errors.root.message}</Alert>
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
      )}
    </div>
  );
}
