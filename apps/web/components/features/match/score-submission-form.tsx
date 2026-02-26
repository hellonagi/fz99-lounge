'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
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

// Race field names for up to 5 races
type RaceField = `race${1 | 2 | 3 | 4 | 5}${'Position' | 'Out' | 'Dc'}`;

// Per-race max positions
const GP_MAX_POSITIONS = [99, 80, 60, 40, 20];
const CLASSIC_MAX_POSITIONS = [20, 16, 12];

// Build dynamic race schema based on race count and max position
function buildRaceSchema(raceCount: number, maxPosition: number, isGpMode: boolean) {
  const fields: Record<string, z.ZodTypeAny> = {
    machine: z.string().min(1, 'Machine is required'),
    ...(!isGpMode && { assistEnabled: z.boolean() }),
  };

  for (let i = 1; i <= raceCount; i++) {
    fields[`race${i}Position`] = z.string().optional();
    fields[`race${i}Out`] = z.boolean();
    fields[`race${i}Dc`] = z.boolean();
  }

  return z.object(fields).superRefine((data: Record<string, unknown>, ctx) => {
    const validatePosition = (pos: unknown, path: string, label: string, raceMax: number) => {
      const posStr = pos as string | undefined;
      if (!posStr || (posStr as string).trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} position is required`,
          path: [path],
        });
        return false;
      }
      const num = parseInt(posStr as string, 10);
      if (isNaN(num) || num < 1 || num > raceMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} position must be between 1 and ${raceMax}`,
          path: [path],
        });
        return false;
      }
      return true;
    };

    // Check each race: required unless previous race was out/dc, or this race is dc
    let eliminated = false;
    for (let i = 1; i <= raceCount; i++) {
      if (eliminated) break;
      const dc = data[`race${i}Dc`] as boolean;
      const out = data[`race${i}Out`] as boolean;
      const raceMax = isGpMode ? GP_MAX_POSITIONS[i - 1] : CLASSIC_MAX_POSITIONS[i - 1];

      if (!dc && !eliminated) {
        validatePosition(data[`race${i}Position`], `race${i}Position`, `Race ${i}`, raceMax);
      }

      if (out || dc) {
        eliminated = true;
      }
    }
  });
}

type RaceFormData = Record<string, string | boolean | undefined>;

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
  const t = useTranslations('scoreSubmission');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  const isModeratorMode = !!participants && participants.length > 0;
  const isGpMode = mode.toLowerCase() === 'gp' || mode.toLowerCase() === 'team_gp';
  const raceCount = isGpMode ? 5 : 3;
  const maxPosition = isGpMode ? 99 : 20;

  // Per-race max positions and elimination thresholds
  const raceMaxPositions = isGpMode ? [99, 80, 60, 40, 20] : [20, 16, 12];
  const eliminationThresholds: (number | null)[] = isGpMode
    ? [81, 61, 41, 21, null]
    : [17, 13, 9];
  const getRaceMaxPosition = (raceNum: number) => raceMaxPositions[raceNum - 1];
  const getEliminationThreshold = (raceNum: number) => eliminationThresholds[raceNum - 1];

  const deadlineDate = new Date(deadline);
  const formattedDeadline = deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const schema = useMemo(() => buildRaceSchema(raceCount, maxPosition, isGpMode), [raceCount, maxPosition, isGpMode]);

  const defaultValues = useMemo(() => {
    const vals: Record<string, string | boolean> = {
      machine: '',
      ...(!isGpMode && { assistEnabled: false }),
    };
    for (let i = 1; i <= raceCount; i++) {
      vals[`race${i}Position`] = '';
      vals[`race${i}Out`] = false;
      vals[`race${i}Dc`] = false;
    }
    return vals;
  }, [raceCount]);

  const form = useForm<RaceFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { isSubmitting } = form.formState;
  const selectedMachine = form.watch('machine') as string;

  // Watch all out/dc flags
  const watchedValues = form.watch();

  // Calculate disabled state for each race
  const isRaceDisabled = useCallback((raceNum: number): boolean => {
    for (let i = 1; i < raceNum; i++) {
      if (watchedValues[`race${i}Out`] || watchedValues[`race${i}Dc`]) return true;
    }
    return false;
  }, [watchedValues]);

  const isPositionDisabled = useCallback((raceNum: number): boolean => {
    return isRaceDisabled(raceNum) || !!watchedValues[`race${raceNum}Dc`];
  }, [isRaceDisabled, watchedValues]);

  // Auto-check elimination when position is in elimination range
  useEffect(() => {
    for (let i = 1; i <= raceCount; i++) {
      const posStr = watchedValues[`race${i}Position`] as string;
      const threshold = getEliminationThreshold(i);
      if (!posStr || !threshold) continue;
      const pos = parseInt(posStr, 10);
      if (!isNaN(pos) && pos >= threshold) {
        if (!watchedValues[`race${i}Out`]) {
          form.setValue(`race${i}Out`, true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Array.from({ length: raceCount }, (_, i) => watchedValues[`race${i + 1}Position`])]);

  // Clear subsequent race values when a race is marked as out or dc
  useEffect(() => {
    for (let i = 1; i <= raceCount; i++) {
      const isOut = watchedValues[`race${i}Out`] as boolean;
      const isDc = watchedValues[`race${i}Dc`] as boolean;

      if (isOut || isDc) {
        // Clear all subsequent races
        for (let j = i + 1; j <= raceCount; j++) {
          form.setValue(`race${j}Position`, '');
          form.setValue(`race${j}Out`, false);
          form.setValue(`race${j}Dc`, false);
        }
        // DC clears own position and out
        if (isDc) {
          form.setValue(`race${i}Position`, '');
          form.setValue(`race${i}Out`, false);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Array.from({ length: raceCount }, (_, i) => watchedValues[`race${i + 1}Out`]),
     ...Array.from({ length: raceCount }, (_, i) => watchedValues[`race${i + 1}Dc`])]);

  const onSubmit = async (data: RaceFormData) => {
    if (isModeratorMode && !targetUserId) {
      form.setError('root' as any, {
        type: 'manual',
        message: 'Please select a player',
      });
      return;
    }

    try {
      const raceResults = [];
      let eliminated = false;

      for (let i = 1; i <= raceCount; i++) {
        const isDc = data[`race${i}Dc`] as boolean;
        const isOut = data[`race${i}Out`] as boolean;

        if (eliminated) {
          raceResults.push({
            raceNumber: i,
            position: undefined,
            isEliminated: false,
            isDisconnected: false,
          });
        } else if (isDc) {
          raceResults.push({
            raceNumber: i,
            position: undefined,
            isEliminated: false,
            isDisconnected: true,
          });
          eliminated = true;
        } else {
          const posStr = data[`race${i}Position`] as string | undefined;
          raceResults.push({
            raceNumber: i,
            position: posStr ? parseInt(posStr, 10) : undefined,
            isEliminated: isOut,
            isDisconnected: false,
          });
          if (isOut) eliminated = true;
        }
      }

      await gamesApi.submitScore(mode, season, game, {
        machine: data.machine as string,
        ...(!isGpMode && { assistEnabled: data.assistEnabled as boolean }),
        raceResults,
        targetUserId: isModeratorMode ? targetUserId! : undefined,
      });

      setSuccess(true);
      setSuccessMessage(t('scoreSuccess'));
      form.reset();
      if (isModeratorMode) setTargetUserId(null);
      if (onScoreSubmitted) onScoreSubmitted();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      form.setError('root' as any, {
        type: 'manual',
        message: axiosError.response?.data?.message || axiosError.message || 'Failed to submit score',
      });
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-1">
        {title || (isModeratorMode ? t('moderatorTitle') : t('title'))}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        {isModeratorMode
          ? t('moderatorDescription')
          : t('description', { deadline: formattedDeadline })}
      </p>

      {isModeratorMode && (
        <div className="mb-4">
          <Label className="text-gray-300 mb-2 block">
            {t('targetPlayer')}
          </Label>
          <select
            value={targetUserId ?? ''}
            onChange={(e) => setTargetUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('selectPlayer')}</option>
            {participants!.map((p) => (
              <option key={p.user.id} value={p.user.id}>
                {p.user.displayName || `User#${p.user.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Machine Selection */}
          <FormField
            control={form.control}
            name="machine"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-300">{t('machine')}</FormLabel>
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

          {/* Race Results */}
          <div className="space-y-3">
            <FormLabel className="text-gray-300">{t('raceResults')}</FormLabel>
            <p className="text-sm text-gray-400">{t('raceResultsDescription')}</p>

            {Array.from({ length: raceCount }, (_, idx) => {
              const raceNum = idx + 1;
              const disabled = isRaceDisabled(raceNum);
              const posDisabled = isPositionDisabled(raceNum);
              const dcValue = !!watchedValues[`race${raceNum}Dc`];
              const raceMax = getRaceMaxPosition(raceNum);

              return (
                <div key={raceNum} className="p-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-14 text-sm font-medium text-gray-300">
                      {t('race', { number: raceNum })}
                    </div>
                    <FormField
                      control={form.control}
                      name={`race${raceNum}Position`}
                      render={({ field, fieldState }) => (
                        <FormItem className="w-14">
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="#"
                              min="1"
                              max={raceMax}
                              disabled={posDisabled}
                              className={`bg-gray-700 border-gray-600 text-white text-sm h-8 px-2 disabled:opacity-50 ${fieldState.error ? 'border-red-500' : ''}`}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3 ml-2">
                      <FormField
                        control={form.control}
                        name={`race${raceNum}Out`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-1.5 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                                disabled={disabled || dcValue}
                                id={`race${raceNum}Out`}
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <Label
                              htmlFor={`race${raceNum}Out`}
                              className={`text-xs cursor-pointer ${disabled || dcValue ? 'text-gray-500' : 'text-gray-300'}`}
                            >
                              {t('rankedOutShort')}
                            </Label>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`race${raceNum}Dc`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-1.5 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                                disabled={disabled}
                                id={`race${raceNum}Dc`}
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <Label
                              htmlFor={`race${raceNum}Dc`}
                              className={`text-xs cursor-pointer ${disabled ? 'text-gray-500' : 'text-gray-300'}`}
                            >
                              {t('disconnectedShort')}
                            </Label>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Validation Errors */}
            {(() => {
              const errors = form.formState.errors;
              const maxPositions = isGpMode ? GP_MAX_POSITIONS : CLASSIC_MAX_POSITIONS;
              const rangeErrors: { race: string; max: number }[] = [];
              for (let i = 1; i <= raceCount; i++) {
                const err = errors[`race${i}Position`];
                if (err && typeof err.message === 'string' && err.message.includes('between')) {
                  rangeErrors.push({ race: t('race', { number: i }), max: maxPositions[i - 1] });
                }
              }
              if (rangeErrors.length > 0) {
                return (
                  <div className="space-y-1">
                    {rangeErrors.map(({ race, max }) => (
                      <p key={race} className="text-sm text-red-400">
                        {t('positionRange', { races: race, max })}
                      </p>
                    ))}
                  </div>
                );
              }
              const hasAnyError = Array.from({ length: raceCount }, (_, i) => errors[`race${i + 1}Position`]).some(Boolean);
              if (hasAnyError) {
                return <p className="text-sm text-red-400">{t('enterAllResults')}</p>;
              }
              return null;
            })()}
          </div>

          {/* Steer Assist (Classic only) */}
          {!isGpMode && (
            <FormField
              control={form.control}
              name="assistEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value as boolean}
                      onCheckedChange={field.onChange}
                      id="steerAssist"
                    />
                  </FormControl>
                  <Label htmlFor="steerAssist" className="text-gray-300 cursor-pointer">
                    {t('steerAssist')}
                  </Label>
                </FormItem>
              )}
            />
          )}

          {/* Error Message */}
          {(form.formState.errors as any).root && (
            <Alert variant="destructive">{(form.formState.errors as any).root.message}</Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert variant="success">{successMessage}</Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? t('submitting') : t('submitButton')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
