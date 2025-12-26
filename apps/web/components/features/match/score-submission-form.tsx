'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { gamesApi } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
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
});

// Position validation helper
const positionValidation = z
  .string()
  .min(1, 'Position is required')
  .refine((val) => !isNaN(parseInt(val, 10)), 'Must be a number')
  .refine((val) => {
    const num = parseInt(val, 10);
    return num >= 1 && num <= 20;
  }, 'Position must be between 1 and 20');

// CLASSIC mode schema (race-by-race positions with elimination status)
const classicScoreSchema = z
  .object({
    machine: z.string().min(1, 'Machine is required'),
    assistEnabled: z.boolean(),
    race1Position: z.string().optional(),
    race1Out: z.boolean(),
    race1Dc: z.boolean(),
    race2Position: z.string().optional(),
    race2Out: z.boolean(),
    race2Dc: z.boolean(),
    race3Position: z.string().optional(),
    race3Out: z.boolean(),
    race3Dc: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Helper to validate position
    const validatePosition = (pos: string | undefined, path: string, label: string) => {
      if (!pos || pos.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} position is required`,
          path: [path],
        });
        return false;
      }
      const num = parseInt(pos, 10);
      if (isNaN(num) || num < 1 || num > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} position must be between 1 and 20`,
          path: [path],
        });
        return false;
      }
      return true;
    };

    // Race 1: required unless disconnected
    if (!data.race1Dc) {
      validatePosition(data.race1Position, 'race1Position', 'Race 1');
    }

    // Race 2: required if race1 is not out/dc AND race2 is not dc
    if (!data.race1Out && !data.race1Dc && !data.race2Dc) {
      validatePosition(data.race2Position, 'race2Position', 'Race 2');
    }

    // Race 3: required if race1 and race2 are not out/dc AND race3 is not dc
    if (!data.race1Out && !data.race1Dc && !data.race2Out && !data.race2Dc && !data.race3Dc) {
      validatePosition(data.race3Position, 'race3Position', 'Race 3');
    }
  });

type GpScoreFormData = z.infer<typeof gpScoreSchema>;
type ClassicScoreFormData = z.infer<typeof classicScoreSchema>;

interface Participant {
  user: {
    id: number;
    displayName: string | null;
  };
}

interface ScoreSubmissionFormProps {
  mode: string;
  season: number;
  game: number;
  deadline: string;
  onScoreSubmitted?: () => void;
  // Moderator mode: show player selector
  participants?: Participant[];
  title?: string;
}

export function ScoreSubmissionForm({
  mode,
  season,
  game,
  deadline,
  onScoreSubmitted,
  participants,
  title,
}: ScoreSubmissionFormProps) {
  const [success, setSuccess] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  // Is this moderator mode?
  const isModeratorMode = !!participants && participants.length > 0;

  // Determine if this is CLASSIC mode
  const isClassicMode = mode.toLowerCase() === 'classic';

  // Format deadline for display
  const deadlineDate = new Date(deadline);
  const formattedDeadline = deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // GP mode form
  const gpForm = useForm<GpScoreFormData>({
    resolver: zodResolver(gpScoreSchema),
    defaultValues: {
      points: '',
      machine: 'Blue Falcon',
      assistEnabled: false,
    },
  });

  // CLASSIC mode form
  const classicForm = useForm<ClassicScoreFormData>({
    resolver: zodResolver(classicScoreSchema),
    defaultValues: {
      machine: 'Blue Falcon',
      assistEnabled: false,
      race1Position: '',
      race1Out: false,
      race1Dc: false,
      race2Position: '',
      race2Out: false,
      race2Dc: false,
      race3Position: '',
      race3Out: false,
      race3Dc: false,
    },
  });

  // Watch out/dc status to disable subsequent race inputs
  const race1Out = classicForm.watch('race1Out');
  const race1Dc = classicForm.watch('race1Dc');
  const race2Out = classicForm.watch('race2Out');
  const race2Dc = classicForm.watch('race2Dc');
  const race3Dc = classicForm.watch('race3Dc');

  // Disconnected disables position input for that race AND all subsequent races
  const isRace1PositionDisabled = race1Dc;
  const isRace2Disabled = race1Out || race1Dc;
  const isRace2PositionDisabled = isRace2Disabled || race2Dc;
  const isRace3Disabled = race1Out || race1Dc || race2Out || race2Dc;
  const isRace3PositionDisabled = isRace3Disabled || race3Dc;

  // Clear subsequent race values when a race is marked as out or dc
  useEffect(() => {
    if (race1Out || race1Dc) {
      classicForm.setValue('race2Position', '');
      classicForm.setValue('race2Out', false);
      classicForm.setValue('race2Dc', false);
      classicForm.setValue('race3Position', '');
      classicForm.setValue('race3Out', false);
      classicForm.setValue('race3Dc', false);
    }
    if (race1Dc) {
      classicForm.setValue('race1Position', '');
      classicForm.setValue('race1Out', false);
    }
  }, [race1Out, race1Dc, classicForm]);

  useEffect(() => {
    if ((race2Out || race2Dc) && !race1Out && !race1Dc) {
      classicForm.setValue('race3Position', '');
      classicForm.setValue('race3Out', false);
      classicForm.setValue('race3Dc', false);
    }
    if (race2Dc && !race1Out && !race1Dc) {
      classicForm.setValue('race2Position', '');
      classicForm.setValue('race2Out', false);
    }
  }, [race2Out, race2Dc, race1Out, race1Dc, classicForm]);

  useEffect(() => {
    if (race3Dc && !race1Out && !race1Dc && !race2Out && !race2Dc) {
      classicForm.setValue('race3Position', '');
      classicForm.setValue('race3Out', false);
    }
  }, [race3Dc, race1Out, race1Dc, race2Out, race2Dc, classicForm]);

  const form = isClassicMode ? classicForm : gpForm;
  const { isSubmitting } = form.formState;
  const selectedMachine = isClassicMode
    ? classicForm.watch('machine')
    : gpForm.watch('machine');

  const onSubmitGp = async (data: GpScoreFormData) => {
    // In moderator mode, require target user selection
    if (isModeratorMode && !targetUserId) {
      gpForm.setError('root', {
        type: 'manual',
        message: 'Please select a player',
      });
      return;
    }

    try {
      await gamesApi.submitScore(mode, season, game, {
        reportedPoints: parseInt(data.points, 10),
        machine: data.machine,
        assistEnabled: data.assistEnabled,
        targetUserId: isModeratorMode ? targetUserId! : undefined,
      });

      setSuccess(true);
      gpForm.reset();
      if (isModeratorMode) setTargetUserId(null);

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
    // In moderator mode, require target user selection
    if (isModeratorMode && !targetUserId) {
      classicForm.setError('root', {
        type: 'manual',
        message: 'Please select a player',
      });
      return;
    }

    try {
      // Build race results array
      const raceResults = [];

      // Race 1
      raceResults.push({
        raceNumber: 1,
        position: data.race1Dc ? undefined : (data.race1Position ? parseInt(data.race1Position, 10) : undefined),
        isEliminated: data.race1Out,
        isDisconnected: data.race1Dc,
      });

      // Race 2 - if race1 is out/dc, this race was not participated
      if (data.race1Out || data.race1Dc) {
        raceResults.push({
          raceNumber: 2,
          position: undefined,
          isEliminated: false,
          isDisconnected: false,
        });
      } else {
        raceResults.push({
          raceNumber: 2,
          position: data.race2Dc ? undefined : (data.race2Position ? parseInt(data.race2Position, 10) : undefined),
          isEliminated: data.race2Out,
          isDisconnected: data.race2Dc,
        });
      }

      // Race 3 - if race1/race2 is out/dc, this race was not participated
      if (data.race1Out || data.race1Dc || data.race2Out || data.race2Dc) {
        raceResults.push({
          raceNumber: 3,
          position: undefined,
          isEliminated: false,
          isDisconnected: false,
        });
      } else {
        raceResults.push({
          raceNumber: 3,
          position: data.race3Dc ? undefined : (data.race3Position ? parseInt(data.race3Position, 10) : undefined),
          isEliminated: data.race3Out,
          isDisconnected: data.race3Dc,
        });
      }

      await gamesApi.submitScore(mode, season, game, {
        machine: data.machine,
        assistEnabled: data.assistEnabled,
        raceResults,
        targetUserId: isModeratorMode ? targetUserId! : undefined,
      });

      setSuccess(true);
      classicForm.reset();
      if (isModeratorMode) setTargetUserId(null);

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
      <h3 className="text-lg font-bold text-white mb-1">
        {title || (isModeratorMode ? 'Edit Player Score' : 'Submit Your Result')}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        {isModeratorMode
          ? 'Select a player and enter their score.'
          : `Please submit your score by ${formattedDeadline}.`}
      </p>

      {/* Player Selector for Moderator Mode */}
      {isModeratorMode && (
        <div className="mb-4">
          <Label className="text-gray-300 mb-2 block">
            Target Player <span className="text-red-500">*</span>
          </Label>
          <select
            value={targetUserId ?? ''}
            onChange={(e) => setTargetUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a player...</option>
            {participants.map((p) => (
              <option key={p.user.id} value={p.user.id}>
                {p.user.displayName || `User#${p.user.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {isClassicMode ? (
        // CLASSIC mode form
        <Form {...classicForm}>
          <form onSubmit={classicForm.handleSubmit(onSubmitClassic)} className="space-y-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      {F99_MACHINES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => field.onChange(m.value)}
                          className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg border-2 transition-all ${
                            selectedMachine === m.value
                              ? 'bg-gray-700 border-blue-500'
                              : 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                          }`}
                        >
                          <span className={`font-medium text-sm sm:text-base ${selectedMachine === m.value ? m.color : 'text-gray-400'}`}>
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

            {/* Steer Assist */}
            <FormField
              control={classicForm.control}
              name="assistEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="steerAssist"
                    />
                  </FormControl>
                  <Label htmlFor="steerAssist" className="text-gray-300 cursor-pointer">
                    Steer Assist
                  </Label>
                </FormItem>
              )}
            />

            {/* Race Results */}
            <div className="space-y-3">
              <FormLabel className="text-gray-300">Race Results</FormLabel>

              {/* Race 1 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-16 font-medium text-gray-300">Race 1</div>
                  <FormField
                    control={classicForm.control}
                    name="race1Position"
                    render={({ field, fieldState }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace1PositionDisabled}
                            className={`bg-gray-700 border-gray-600 text-white disabled:opacity-50 ${fieldState.error ? 'border-red-500' : ''}`}
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
                            disabled={race1Dc}
                            id="race1Out"
                          />
                        </FormControl>
                        <Label htmlFor="race1Out" className={`text-sm cursor-pointer ${race1Dc ? 'text-gray-500' : 'text-gray-300'}`}>
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race1Dc"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="race1Dc"
                          />
                        </FormControl>
                        <Label htmlFor="race1Dc" className="text-gray-300 text-sm cursor-pointer">
                          Disconnected
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Race 2 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-16 font-medium text-gray-300">Race 2</div>
                  <FormField
                    control={classicForm.control}
                    name="race2Position"
                    render={({ field, fieldState }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace2PositionDisabled}
                            className={`bg-gray-700 border-gray-600 text-white disabled:opacity-50 ${fieldState.error ? 'border-red-500' : ''}`}
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
                            disabled={isRace2Disabled || race2Dc}
                            id="race2Out"
                          />
                        </FormControl>
                        <Label htmlFor="race2Out" className={`text-sm cursor-pointer ${isRace2Disabled || race2Dc ? 'text-gray-500' : 'text-gray-300'}`}>
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race2Dc"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isRace2Disabled}
                            id="race2Dc"
                          />
                        </FormControl>
                        <Label htmlFor="race2Dc" className={`text-sm cursor-pointer ${isRace2Disabled ? 'text-gray-500' : 'text-gray-300'}`}>
                          Disconnected
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Race 3 */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-16 font-medium text-gray-300">Race 3</div>
                  <FormField
                    control={classicForm.control}
                    name="race3Position"
                    render={({ field, fieldState }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1-20"
                            min="1"
                            max="20"
                            disabled={isRace3PositionDisabled}
                            className={`bg-gray-700 border-gray-600 text-white disabled:opacity-50 ${fieldState.error ? 'border-red-500' : ''}`}
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
                            disabled={isRace3Disabled || race3Dc}
                            id="race3Out"
                          />
                        </FormControl>
                        <Label htmlFor="race3Out" className={`text-sm cursor-pointer ${isRace3Disabled || race3Dc ? 'text-gray-500' : 'text-gray-300'}`}>
                          Ranked out / Crashed out
                        </Label>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={classicForm.control}
                    name="race3Dc"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isRace3Disabled}
                            id="race3Dc"
                          />
                        </FormControl>
                        <Label htmlFor="race3Dc" className={`text-sm cursor-pointer ${isRace3Disabled ? 'text-gray-500' : 'text-gray-300'}`}>
                          Disconnected
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Validation Errors */}
              {(() => {
                const errors = classicForm.formState.errors;
                const rangeErrors: string[] = [];

                // Check for range errors (1-20)
                if (errors.race1Position?.message?.includes('between')) {
                  rangeErrors.push('Race 1');
                }
                if (errors.race2Position?.message?.includes('between')) {
                  rangeErrors.push('Race 2');
                }
                if (errors.race3Position?.message?.includes('between')) {
                  rangeErrors.push('Race 3');
                }

                if (rangeErrors.length > 0) {
                  return (
                    <p className="text-sm text-red-400">
                      {rangeErrors.join(', ')}: Position must be between 1 and 20.
                    </p>
                  );
                }

                // Otherwise show generic required message
                if (errors.race1Position || errors.race2Position || errors.race3Position) {
                  return <p className="text-sm text-red-400">Please enter all race results.</p>;
                }

                return null;
              })()}

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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      {F99_MACHINES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => field.onChange(m.value)}
                          className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg border-2 transition-all ${
                            selectedMachine === m.value
                              ? 'bg-gray-700 border-blue-500'
                              : 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                          }`}
                        >
                          <span className={`font-medium text-sm sm:text-base ${selectedMachine === m.value ? m.color : 'text-gray-400'}`}>
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

            {/* Steer Assist */}
            <FormField
              control={gpForm.control}
              name="assistEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="steerAssistGp"
                    />
                  </FormControl>
                  <Label htmlFor="steerAssistGp" className="text-gray-300 cursor-pointer">
                    Steer Assist
                  </Label>
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
