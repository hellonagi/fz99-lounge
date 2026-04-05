'use client';

import { memo, useState } from 'react';
import { useForm, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { tournamentsApi } from '@/lib/api';
import { useTranslations } from 'next-intl';

const IN_GAME_MODE_OPTIONS = [
  { value: 'GRAND_PRIX', label: 'Grand Prix' },
  { value: 'MIRROR_GRAND_PRIX', label: 'Mirror Grand Prix' },
  { value: 'MINI_PRIX', label: 'Mini Prix' },
  { value: 'CLASSIC', label: 'Classic' },
  { value: 'CLASSIC_MINI_PRIX', label: 'Classic Mini Prix' },
  { value: 'PRO', label: 'Pro' },
  { value: 'NINETY_NINE', label: '99' },
];

const GP_LEAGUES = [
  { value: 'KNIGHT', label: 'Knight' },
  { value: 'QUEEN', label: 'Queen' },
  { value: 'KING', label: 'King' },
  { value: 'ACE', label: 'Ace' },
];

const MIRROR_GP_LEAGUES = [
  { value: 'MIRROR_KNIGHT', label: 'Mirror Knight' },
  { value: 'MIRROR_QUEEN', label: 'Mirror Queen' },
  { value: 'MIRROR_KING', label: 'Mirror King' },
  { value: 'MIRROR_ACE', label: 'Mirror Ace' },
];

function getLeagueOptions(mode: string) {
  if (mode === 'GRAND_PRIX') return GP_LEAGUES;
  if (mode === 'MIRROR_GRAND_PRIX') return MIRROR_GP_LEAGUES;
  return null;
}

const roundSchema = z.object({
  roundNumber: z.number(),
  inGameMode: z.string().min(1),
  league: z.string().optional(),
  offsetMinutes: z.coerce.number().int().min(0).default(0),
});

const tournamentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  totalRounds: z.coerce.number().int().min(1).max(20),
  rounds: z.array(roundSchema),
  tournamentDate: z.string().min(1, 'Required'),
  registrationStart: z.string().min(1, 'Required'),
  registrationEnd: z.string().min(1, 'Required'),
  minPlayers: z.coerce.number().int().min(2).default(40),
  maxPlayers: z.coerce.number().int().min(2).max(99).default(99),
  contentEn: z.string().optional(),
  contentJa: z.string().optional(),
});

type TournamentFormData = z.infer<typeof tournamentSchema>;

const RoundRow = memo(function RoundRow({
  index,
  form,
  label,
  offsetLabel,
}: {
  index: number;
  form: UseFormReturn<TournamentFormData>;
  label: string;
  offsetLabel: string;
}) {
  const mode = useWatch({ control: form.control, name: `rounds.${index}.inGameMode` });
  const leagueOptions = getLeagueOptions(mode);

  return (
    <div className="grid grid-cols-[80px_1fr_1fr_100px] gap-2 items-center">
      <span className="text-sm text-gray-400">{label}</span>
      <FormField
        control={form.control}
        name={`rounds.${index}.inGameMode`}
        render={({ field }) => (
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={field.value}
            onChange={(e) => {
              field.onChange(e);
              // Clear league when switching to a mode without leagues
              const newLeagues = getLeagueOptions(e.target.value);
              if (!newLeagues) {
                form.setValue(`rounds.${index}.league`, undefined);
              } else {
                form.setValue(`rounds.${index}.league`, newLeagues[0].value);
              }
            }}
          >
            {IN_GAME_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      />
      {leagueOptions ? (
        <FormField
          control={form.control}
          name={`rounds.${index}.league`}
          render={({ field }) => (
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={field.value || leagueOptions[0].value}
              onChange={field.onChange}
            >
              {leagueOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        />
      ) : (
        <span className="text-sm text-gray-500">-</span>
      )}
      <FormField
        control={form.control}
        name={`rounds.${index}.offsetMinutes`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            className="h-9"
            placeholder={offsetLabel}
            {...field}
          />
        )}
      />
    </div>
  );
});

interface CreateTournamentFormProps {
  onCreated?: () => void;
}

export function CreateTournamentForm({ onCreated }: CreateTournamentFormProps) {
  const t = useTranslations('adminTournament');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: 'FZ99 Lounge Masters',
      totalRounds: 8,
      rounds: Array.from({ length: 8 }, (_, i) => ({
        roundNumber: i + 1,
        inGameMode: 'GRAND_PRIX',
        league: 'KNIGHT',
        offsetMinutes: i * 20,
      })),
      tournamentDate: '',
      registrationStart: '',
      registrationEnd: '',
      minPlayers: 40,
      maxPlayers: 99,
      contentEn: '',
      contentJa: '',
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'rounds',
  });

  // Sync rounds array when totalRounds changes
  const handleTotalRoundsChange = (value: number) => {
    const currentRounds = form.getValues('rounds');
    const lastOffset = currentRounds.length > 0
      ? currentRounds[currentRounds.length - 1].offsetMinutes
      : 0;
    const gap = currentRounds.length >= 2
      ? currentRounds[currentRounds.length - 1].offsetMinutes - currentRounds[currentRounds.length - 2].offsetMinutes
      : 20;
    if (value > currentRounds.length) {
      const newRounds = [
        ...currentRounds,
        ...Array.from({ length: value - currentRounds.length }, (_, i) => ({
          roundNumber: currentRounds.length + i + 1,
          inGameMode: 'GRAND_PRIX',
          league: 'KNIGHT',
          offsetMinutes: lastOffset + (i + 1) * gap,
        })),
      ];
      replace(newRounds);
    } else if (value < currentRounds.length) {
      replace(currentRounds.slice(0, value));
    }
  };

  const onSubmit = async (data: TournamentFormData) => {
    setError(null);
    setSuccess(null);
    try {
      const content = (data.contentEn || data.contentJa)
        ? { en: data.contentEn || '', ja: data.contentJa || '' }
        : undefined;
      const toISO = (v: string) => new Date(v).toISOString();
      const { contentEn: _en, contentJa: _ja, ...rest } = data;
      const payload = {
        ...rest,
        tournamentDate: toISO(data.tournamentDate),
        registrationStart: toISO(data.registrationStart),
        registrationEnd: toISO(data.registrationEnd),
        rounds: data.rounds.map((r) => {
          const leagueNeeded = getLeagueOptions(r.inGameMode);
          const league = r.league && r.league !== 'none' ? r.league : undefined;
          return {
            ...r,
            league: league ?? (leagueNeeded ? leagueNeeded[0].value : undefined),
            offsetMinutes: r.offsetMinutes ?? 0,
          };
        }),
        content,
      };
      await tournamentsApi.create(payload);
      setSuccess(t('created'));
      form.reset();
      onCreated?.();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-800 bg-green-900/20">
            <AlertDescription className="text-green-400">{success}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total Rounds */}
            <FormField
              control={form.control}
              name="totalRounds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('totalRounds')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      {...field}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        field.onChange(val);
                        handleTotalRoundsChange(val);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="tournamentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tournamentDate')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('registrationStart')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('registrationEnd')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Player limits */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="minPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('minPlayers')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('maxPlayers')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} max={99} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Round Configuration */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">{t('roundConfig')}</h3>
              <div className="grid grid-cols-[80px_1fr_1fr_100px] gap-2 mb-2">
                <span className="text-xs text-gray-500" />
                <span className="text-xs text-gray-500">{t('inGameMode')}</span>
                <span className="text-xs text-gray-500">{t('league')}</span>
                <span className="text-xs text-gray-500">{t('offsetMin')}</span>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <RoundRow
                    key={field.id}
                    index={index}
                    form={form}
                    label={t('roundNumber', { number: index + 1 })}
                    offsetLabel={t('offsetMin')}
                  />
                ))}
              </div>
            </div>

            {/* Content (Markdown) */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">{t('content')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contentEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">{t('contentEn')}</FormLabel>
                      <FormControl>
                        <Textarea rows={10} placeholder="Markdown" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contentJa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500">{t('contentJa')}</FormLabel>
                      <FormControl>
                        <Textarea rows={10} placeholder="Markdown" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? t('creating') : t('create')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
