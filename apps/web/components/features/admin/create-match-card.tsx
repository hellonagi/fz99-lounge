'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { matchesApi, seasonsApi } from '@/lib/api';
import { useTranslations } from 'next-intl';

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

// CLASSICモードはリーグ選択なし（ランダム）

// カテゴリ選択肢（現在はCLASSICのみ）
const CATEGORY_OPTIONS = [
  // { value: 'GP', label: '99 Mode' }, // 未実装
  { value: 'CLASSIC', label: 'Classic Mode' },
];

// GPモード用のIn-Game Mode選択肢
const IN_GAME_MODE_OPTIONS_GP = [
  { value: 'GRAND_PRIX', label: 'Grand Prix' },
  { value: 'MINI_PRIX', label: 'Mini Prix' },
  { value: 'TEAM_BATTLE', label: 'Team Battle' },
  { value: 'PRO', label: 'Pro' },
  { value: 'NINETY_NINE', label: '99' },
];

const matchSchema = z.object({
  category: z.enum(['GP', 'CLASSIC']),
  seasonId: z.string().min(1, 'Season is required'),
  inGameMode: z.string().min(1, 'In-game mode is required'),
  leagueType: z.string().optional(), // GPモードのみ必須
  scheduledStart: z
    .string()
    .min(1, 'Start time is required')
    .refine((val) => {
      const scheduledDate = new Date(val);
      const minTime = new Date(Date.now() + 60 * 1000); // 現在時刻 + 1分
      return scheduledDate >= minTime;
    }, 'Start time must be at least 1 minute from now'),
  minPlayers: z
    .string()
    .min(1, 'Min players is required')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 12, 'Min players must be at least 12'),
  maxPlayers: z
    .string()
    .min(1, 'Max players is required')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, 'Max players must be at least 1'),
}).refine(
  (data) => parseInt(data.maxPlayers) >= parseInt(data.minPlayers),
  { message: 'Max players must be greater than or equal to min players', path: ['maxPlayers'] }
);

type MatchFormData = z.infer<typeof matchSchema>;

interface Season {
  id: number;
  seasonNumber: number;
  event: {
    category: string;
  };
}

export function CreateMatchCard() {
  const t = useTranslations('createMatch');
  const [success, setSuccess] = useState(false);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const form = useForm<MatchFormData>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      category: 'CLASSIC',
      seasonId: '',
      inGameMode: 'CLASSIC_MINI_PRIX',
      leagueType: undefined,
      scheduledStart: '',
      minPlayers: '12',
      maxPlayers: '20',
    },
  });

  const { isSubmitting } = form.formState;
  const category = form.watch('category');
  const isGPMode = category === 'GP';
  // GPモードのみIn-Game ModeとLeague Typeを選択可能
  // CLASSICモードはCLASSIC_MINI_PRIX固定、リーグ選択なし

  // Fetch active season for selected category
  useEffect(() => {
    const fetchActiveSeason = async () => {
      try {
        setSeasonError(null);
        const response = await seasonsApi.getActive(category);
        setActiveSeason(response.data);
        form.setValue('seasonId', String(response.data.id));
      } catch {
        setActiveSeason(null);
        form.setValue('seasonId', '');
        setSeasonError(t('noActiveSeason'));
      }
    };
    fetchActiveSeason();
  }, [category, form, t]);

  // Update defaults when category changes
  useEffect(() => {
    if (category === 'GP') {
      form.setValue('leagueType', 'KNIGHT');
      form.setValue('inGameMode', 'GRAND_PRIX');
      form.setValue('minPlayers', '40');
      form.setValue('maxPlayers', '99');
    } else {
      form.setValue('leagueType', undefined); // CLASSICモードはリーグなし
      form.setValue('inGameMode', 'CLASSIC_MINI_PRIX');
      form.setValue('minPlayers', '12');
      form.setValue('maxPlayers', '20');
    }
    // seasonId is set by the active season fetch effect
  }, [category, form]);

  const onSubmit = async (data: MatchFormData) => {
    try {
      await matchesApi.create({
        seasonId: parseInt(data.seasonId),
        inGameMode: data.inGameMode,
        ...(data.leagueType && { leagueType: data.leagueType }), // GPモードのみ送信
        scheduledStart: new Date(data.scheduledStart).toISOString(),
        minPlayers: parseInt(data.minPlayers),
        maxPlayers: parseInt(data.maxPlayers),
      });

      setSuccess(true);
      form.reset({
        ...form.getValues(),
        scheduledStart: '',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('root', {
        type: 'manual',
        message: axiosError.response?.data?.message || t('error'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('category')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t('classicMode')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Season (read-only, auto-selected) */}
            <div className="space-y-2">
              <FormLabel>{t('season')}</FormLabel>
              {seasonError ? (
                <Alert variant="destructive">{seasonError}</Alert>
              ) : activeSeason ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {t('season')} {activeSeason.seasonNumber}
                </div>
              ) : (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {t('loadingSeason')}
                </div>
              )}
            </div>

            {/* In-Game Mode - GPモードのみ表示 */}
            {isGPMode && (
              <FormField
                control={form.control}
                name="inGameMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inGameMode')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectMode')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IN_GAME_MODE_OPTIONS_GP.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* League Type - GPモードのみ表示 */}
            {isGPMode && (
              <FormField
                control={form.control}
                name="leagueType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('leagueType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectLeague')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LEAGUE_OPTIONS_99.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Scheduled Start */}
            <FormField
              control={form.control}
              name="scheduledStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('scheduledStart')}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Player Count */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('minPlayers')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="12" {...field} />
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
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Error/Success Messages */}
            {form.formState.errors.root && (
              <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
            )}
            {success && (
              <Alert variant="success">{t('success')}</Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t('creating') : t('createButton')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
