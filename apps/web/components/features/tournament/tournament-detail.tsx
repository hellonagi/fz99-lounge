'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Users, CheckCircle, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormField, FormItem, FormControl } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { tournamentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getCountryByCode } from '@/lib/countries';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { SiDiscord } from 'react-icons/si';
import { Tournament, LocalizedContent, TournamentDivision, TournamentMode, TournamentScheduleEvent, TournamentRoundConfig } from '@/types';

const LEAGUE_ICON_MAP: Record<string, string> = {
  KNIGHT: '/leagues/knight_64x64.png',
  QUEEN: '/leagues/queen_64x64.png',
  KING: '/leagues/king_64x64.png',
  ACE: '/leagues/ace_64x64.png',
  MIRROR_KNIGHT: '/leagues/mknight_64x64.png',
  MIRROR_QUEEN: '/leagues/mqueen_64x64.png',
  MIRROR_KING: '/leagues/mking_64x64.png',
  MIRROR_ACE: '/leagues/mace_64x64.png',
};

const MODE_ICON_MAP: Record<string, string> = {
  MINI_PRIX: '/leagues/mini_64x64.png',
  CLASSIC_MINI_PRIX: '/leagues/cmini_64x64.png',
};

function getRoundIcon(inGameMode: string, league?: string): string | null {
  if (league && LEAGUE_ICON_MAP[league]) return LEAGUE_ICON_MAP[league];
  if (MODE_ICON_MAP[inGameMode]) return MODE_ICON_MAP[inGameMode];
  return null;
}

function getRoundStartTime(tournamentDate: string, offsetMinutes?: number): Date {
  const base = new Date(tournamentDate);
  if (offsetMinutes) {
    base.setMinutes(base.getMinutes() + offsetMinutes);
  }
  return base;
}

type ScheduleRow =
  | {
      kind: 'race';
      offsetMinutes: number;
      inGameMode: string;
      league?: string;
      icon: string | null;
    }
  | {
      kind: 'event';
      offsetMinutes: number;
      label: LocalizedContent;
    };

function buildScheduleRows(
  rounds: TournamentRoundConfig[],
  events?: TournamentScheduleEvent[] | null,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [
    ...rounds.map<ScheduleRow>((r) => ({
      kind: 'race',
      offsetMinutes: r.offsetMinutes ?? 0,
      inGameMode: r.inGameMode,
      league: r.league,
      icon: getRoundIcon(r.inGameMode, r.league),
    })),
    ...(events ?? []).map<ScheduleRow>((e) => ({
      kind: 'event',
      offsetMinutes: e.offsetMinutes,
      label: e.label,
    })),
  ];
  rows.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    // events first (e.g. "Open" at 0 should come before race at 0)
    return a.kind === 'event' ? -1 : 1;
  });
  return rows;
}

interface TournamentOverviewProps {
  tournament: Tournament;
  onUpdate: () => void;
}

const registrationSchema = z
  .object({
    enterGp: z.boolean().optional(),
    gpMode: z.enum(['OFFLINE', 'ONLINE']).optional(),
    enterClassic: z.boolean().optional(),
    classicMode: z.enum(['OFFLINE', 'ONLINE']).optional(),
    agreedToRules: z.literal(true, { message: 'agreeRequired' }),
    prizeEntry: z.boolean().optional(),
  })
  .refine((d) => d.enterGp || d.enterClassic, {
    message: 'divisionRequired',
    path: ['enterGp'],
  })
  .refine((d) => !d.enterGp || !!d.gpMode, {
    message: 'gpModeRequired',
    path: ['gpMode'],
  })
  .refine((d) => !d.enterClassic || !!d.classicMode, {
    message: 'classicModeRequired',
    path: ['classicMode'],
  });

const GP_MAX = 99;
const CLASSIC_MAX = 20;

type RegistrationForm = z.infer<typeof registrationSchema>;

interface MyRegistrations {
  gp: { mode: TournamentMode } | null;
  classic: { mode: TournamentMode } | null;
}

function formatDateTime(format: ReturnType<typeof useFormatter>, dateStr: string, timeZone: string) {
  return format.dateTime(new Date(dateStr), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

function TournamentContent({ content, locale }: { content?: LocalizedContent | null; locale: string }) {
  if (!content) return null;
  const text = locale === 'ja' ? content.ja : content.en;
  if (!text) return null;
  return (
    <Card>
      <CardContent className="prose prose-invert prose-sm max-w-none pt-6">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            img: ({ node, ...props }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...props} alt={props.alt || ''} style={{ maxWidth: 300 }} />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </CardContent>
    </Card>
  );
}

export function TournamentOverview({ tournament, onUpdate }: TournamentOverviewProps) {
  const t = useTranslations('tournament');
  const format = useFormatter();
  const locale = useLocale();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { user, isAuthenticated } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      enterGp: false,
      gpMode: undefined,
      enterClassic: false,
      classicMode: undefined,
      agreedToRules: undefined as unknown as true,
      prizeEntry: false,
    },
  });

  const enterGp = form.watch('enterGp');
  const enterClassic = form.watch('enterClassic');

  const [myRegs, setMyRegs] = useState<MyRegistrations>({ gp: null, classic: null });
  const [divisionCounts, setDivisionCounts] = useState({ gp: 0, classic: 0 });

  const refreshMyRegs = () => {
    tournamentsApi
      .getParticipants(tournament.id)
      .then((res) => {
        const all = res.data as Array<{ userId: number; division: TournamentDivision; mode: TournamentMode | null }>;
        setDivisionCounts({
          gp: all.filter((p) => p.division === 'GP').length,
          classic: all.filter((p) => p.division === 'CLASSIC').length,
        });
        if (!user) return;
        const mine = all.filter((p) => p.userId === user.id);
        const gpEntry = mine.find((p) => p.division === 'GP');
        const classicEntry = mine.find((p) => p.division === 'CLASSIC');
        setMyRegs({
          gp: gpEntry && gpEntry.mode ? { mode: gpEntry.mode } : null,
          classic: classicEntry && classicEntry.mode ? { mode: classicEntry.mode } : null,
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshMyRegs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tournament.id]);

  const fullyRegistered = !!myRegs.gp && !!myRegs.classic;
  const canRegister =
    tournament.status === 'REGISTRATION_OPEN' &&
    isAuthenticated &&
    !fullyRegistered;

  const handleRegister = async (values: RegistrationForm) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const targets: Array<{ division: TournamentDivision; mode: TournamentMode }> = [];
      if (values.enterGp && !myRegs.gp) targets.push({ division: 'GP', mode: values.gpMode! });
      if (values.enterClassic && !myRegs.classic) targets.push({ division: 'CLASSIC', mode: values.classicMode! });

      for (const target of targets) {
        await tournamentsApi.register(tournament.id, {
          division: target.division,
          mode: target.mode,
          prizeEntry: values.prizeEntry ?? false,
        });
      }
      setSuccess(t('registered'));
      refreshMyRegs();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (division: TournamentDivision) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await tournamentsApi.cancelRegistration(tournament.id, division);
      refreshMyRegs();
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-2 text-gray-300 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{t('date')}</span>
              </div>
              <p className="text-white text-sm">{formatDateTime(format, tournament.tournamentDate, timeZone)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-300 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{t('registrationDeadline')}</span>
              </div>
              <p className="text-white text-sm">
                {formatDateTime(format, tournament.registrationEnd, timeZone)}
              </p>
            </div>
            {tournament.venue && (
              <div>
                <div className="flex items-center gap-2 text-gray-300 mb-1">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('venue')}</span>
                </div>
                <p className="text-white text-sm">
                  {tournament.venueUrl ? (
                    <a
                      href={tournament.venueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {tournament.venue}
                    </a>
                  ) : (
                    tournament.venue
                  )}
                </p>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 text-gray-300 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">{t('playerLimit')}</span>
              </div>
              <div className="text-white text-sm space-y-0.5">
                <p>GP {divisionCounts.gp} / {GP_MAX}</p>
                <p>Classic {divisionCounts.classic} / {CLASSIC_MAX}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rounds / Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>{t('schedule')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-700">
            {buildScheduleRows(tournament.rounds, tournament.scheduleEvents).map((row, i) => {
              const startTime = getRoundStartTime(tournament.tournamentDate, row.offsetMinutes);
              return (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="text-sm text-blue-400 shrink-0 whitespace-nowrap">
                    {format.dateTime(startTime, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone,
                    })}
                  </span>
                  {row.kind === 'race' ? (
                    <>
                      {row.icon && (
                        <Image
                          src={row.icon}
                          alt={row.league || row.inGameMode}
                          width={24}
                          height={24}
                          className="shrink-0"
                        />
                      )}
                      <span className="text-sm text-white">
                        {row.inGameMode.replace(/_/g, ' ')}
                        {row.league && ` / ${row.league.replace(/_/g, ' ')}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400 italic">
                      {locale === 'ja' ? row.label.ja : row.label.en}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <TournamentContent content={tournament.content} locale={locale} />

      {/* Registration */}
      {!isAuthenticated && tournament.status === 'REGISTRATION_OPEN' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('register')}</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/auth/discord`}
              className={cn(buttonVariants({ variant: 'discord', size: 'lg' }), 'gap-2')}
            >
              <SiDiscord className="w-4 h-4" />
              {t('loginToRegister')}
            </a>
          </CardContent>
        </Card>
      )}
      {isAuthenticated && tournament.status === 'REGISTRATION_OPEN' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('register')}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 border-green-800 bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-400">{success}</AlertDescription>
              </Alert>
            )}

            {(myRegs.gp || myRegs.classic) && (
              <div className="space-y-3 mb-4">
                {myRegs.gp && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t('gpRegistered', { mode: t(myRegs.gp.mode === 'OFFLINE' ? 'modeOffline' : 'modeOnline') })}
                    </p>
                    {tournament.status === 'REGISTRATION_OPEN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel('GP')}
                        disabled={submitting}
                      >
                        {t('cancelGp')}
                      </Button>
                    )}
                  </div>
                )}
                {myRegs.classic && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {t('classicRegistered', { mode: t(myRegs.classic.mode === 'OFFLINE' ? 'modeOffline' : 'modeOnline') })}
                    </p>
                    {tournament.status === 'REGISTRATION_OPEN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel('CLASSIC')}
                        disabled={submitting}
                      >
                        {t('cancelClassic')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {canRegister ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
                  <p className="text-sm text-gray-400">{t('rulesText')}</p>
                  <p className="text-sm text-gray-400">
                    {t.rich('joinDiscord', {
                      link: (chunks) => (
                        <a
                          href="https://discord.gg/Pxdxp8kH6c"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline"
                        >
                          {chunks}
                        </a>
                      ),
                    })}
                  </p>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-300">{t('divisionLabel')}</p>
                    {!myRegs.gp && (
                      <FormField
                        control={form.control}
                        name="enterGp"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <div className="rounded-lg border border-gray-700 p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <input
                                    id="enterGp"
                                    type="checkbox"
                                    checked={field.value === true}
                                    onChange={(e) => {
                                      field.onChange(e.target.checked);
                                      if (!e.target.checked) form.setValue('gpMode', undefined);
                                    }}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                  />
                                </FormControl>
                                <label htmlFor="enterGp" className="text-sm text-gray-300 cursor-pointer">
                                  {t('enterGp')}
                                </label>
                              </div>
                              <FormField
                                control={form.control}
                                name="gpMode"
                                render={({ field: modeField, fieldState: modeFs }) => (
                                  <FormItem>
                                    <p className="text-xs text-gray-500 mb-2">{t('gpModeLabel')}</p>
                                    <div className="flex gap-4">
                                      {(['OFFLINE', 'ONLINE'] as const).map((m) => (
                                        <label key={m} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="gpMode"
                                            value={m}
                                            checked={modeField.value === m}
                                            onChange={() => {
                                              modeField.onChange(m);
                                              if (!form.getValues('enterGp')) form.setValue('enterGp', true);
                                            }}
                                            className="h-4 w-4 border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                          />
                                          {t(m === 'OFFLINE' ? 'modeOffline' : 'modeOnline')}
                                        </label>
                                      ))}
                                    </div>
                                    {enterGp && modeFs.error && (
                                      <p className="text-sm text-red-500 mt-1">{t('gpModeRequired')}</p>
                                    )}
                                  </FormItem>
                                )}
                              />
                              {fieldState.error && fieldState.error.message === 'divisionRequired' && (
                                <p className="text-sm text-red-500">{t('divisionRequired')}</p>
                              )}
                            </div>
                          </FormItem>
                        )}
                      />
                    )}
                    {!myRegs.classic && (
                      <FormField
                        control={form.control}
                        name="enterClassic"
                        render={({ field }) => (
                          <FormItem>
                            <div className="rounded-lg border border-gray-700 p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <input
                                    id="enterClassic"
                                    type="checkbox"
                                    checked={field.value === true}
                                    onChange={(e) => {
                                      field.onChange(e.target.checked);
                                      if (!e.target.checked) form.setValue('classicMode', undefined);
                                    }}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                  />
                                </FormControl>
                                <label htmlFor="enterClassic" className="text-sm text-gray-300 cursor-pointer">
                                  {t('enterClassic')}
                                </label>
                              </div>
                              <FormField
                                control={form.control}
                                name="classicMode"
                                render={({ field: modeField, fieldState: modeFs }) => (
                                  <FormItem>
                                    <p className="text-xs text-gray-500 mb-2">{t('classicModeLabel')}</p>
                                    <div className="flex gap-4">
                                      {(['OFFLINE', 'ONLINE'] as const).map((m) => (
                                        <label key={m} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="classicMode"
                                            value={m}
                                            checked={modeField.value === m}
                                            onChange={() => {
                                              modeField.onChange(m);
                                              if (!form.getValues('enterClassic')) form.setValue('enterClassic', true);
                                            }}
                                            className="h-4 w-4 border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                          />
                                          {t(m === 'OFFLINE' ? 'modeOffline' : 'modeOnline')}
                                        </label>
                                      ))}
                                    </div>
                                    {enterClassic && modeFs.error && (
                                      <p className="text-sm text-red-500 mt-1">{t('classicModeRequired')}</p>
                                    )}
                                  </FormItem>
                                )}
                              />
                            </div>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="agreedToRules"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <input
                              id="agreedToRules"
                              type="checkbox"
                              checked={field.value === true}
                              onChange={(e) => field.onChange(e.target.checked ? true : undefined)}
                              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                            />
                          </FormControl>
                          <label htmlFor="agreedToRules" className="text-sm text-gray-300 cursor-pointer">
                            {t('agreeToRules')}
                          </label>
                        </div>
                        {fieldState.error && (
                          <p className="text-sm text-red-500">{t('agreeRequired')}</p>
                        )}
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('loading') : t('register')}
                  </Button>
                </form>
              </Form>
            ) : !fullyRegistered ? (
              <p className="text-gray-400">{t('registrationClosed')}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Participants */}
      <ParticipantsList tournamentId={tournament.id} />
    </div>
  );
}

function ParticipantTile({ p, statusLabel, muted }: { p: any; statusLabel?: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2',
        muted ? 'border-gray-700/50 bg-gray-800/20 opacity-70' : 'border-gray-700 bg-gray-800/50',
      )}
    >
      <span
        className={`fi fi-${p.user?.profile?.country?.toLowerCase() || 'un'} shrink-0`}
        title={p.user?.profile?.country || ''}
      />
      <span className={cn('text-sm truncate', muted ? 'text-gray-400' : 'text-white')}>
        {p.user?.displayName || `Player ${p.userId}`}
      </span>
      {statusLabel && (
        <span className="text-[10px] text-gray-400 shrink-0 ml-auto whitespace-nowrap">
          {statusLabel}
        </span>
      )}
    </div>
  );
}

const GP_OFFLINE_MAX = 32;
const GP_ONLINE_MAX = 67;
const CLASSIC_FIRST_COME = 15;
const CLASSIC_INVITATIONAL = 5;

type GpSlot = 'OFFLINE_CONFIRMED' | 'ONLINE_CONFIRMED' | 'ONLINE_OVERFLOW' | 'WAITLIST';

function assignGpSlots(entries: any[]): Array<{ entry: any; slot: GpSlot }> {
  let offline = 0;
  let online = 0;
  return entries.map((entry) => {
    if (entry.mode === 'OFFLINE' && offline < GP_OFFLINE_MAX) {
      offline += 1;
      return { entry, slot: 'OFFLINE_CONFIRMED' as GpSlot };
    }
    if (online < GP_ONLINE_MAX) {
      online += 1;
      return {
        entry,
        slot: (entry.mode === 'OFFLINE' ? 'ONLINE_OVERFLOW' : 'ONLINE_CONFIRMED') as GpSlot,
      };
    }
    return { entry, slot: 'WAITLIST' as GpSlot };
  });
}

function GpSection({ entries, t }: { entries: any[]; t: ReturnType<typeof useTranslations> }) {
  const assigned = useMemo(() => assignGpSlots(entries), [entries]);
  const offline = assigned.filter((a) => a.slot === 'OFFLINE_CONFIRMED');
  const online = assigned.filter((a) => a.slot === 'ONLINE_CONFIRMED' || a.slot === 'ONLINE_OVERFLOW');
  const waitlist = assigned.filter((a) => a.slot === 'WAITLIST');

  return (
    <div className="space-y-4">
      <h4 className="text-base font-medium text-gray-200">
        {t('gpDivision')} ({entries.length} / {GP_MAX})
      </h4>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          {t('modeOffline')} ({offline.length} / {GP_OFFLINE_MAX})
        </p>
        {offline.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {offline.map((a) => (
              <ParticipantTile key={a.entry.id} p={a.entry} />
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          {t('modeOnline')} ({online.length} / {GP_ONLINE_MAX})
        </p>
        {online.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {online.map((a) => (
              <ParticipantTile
                key={a.entry.id}
                p={a.entry}
                statusLabel={a.slot === 'ONLINE_OVERFLOW' ? t('statusOfflinePreferred') : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {waitlist.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{t('statusWaitlist')} ({waitlist.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {waitlist.map((a) => (
              <ParticipantTile
                key={a.entry.id}
                p={a.entry}
                statusLabel={t(a.entry.mode === 'OFFLINE' ? 'modeOffline' : 'modeOnline')}
                muted
              />
            ))}
          </div>
        </div>
      )}
      <CountryRepresentation participants={entries} />
    </div>
  );
}

function ClassicSection({ entries, t }: { entries: any[]; t: ReturnType<typeof useTranslations> }) {
  const confirmed = entries.slice(0, CLASSIC_FIRST_COME);
  const waitlist = entries.slice(CLASSIC_FIRST_COME);

  return (
    <div className="space-y-4">
      <h4 className="text-base font-medium text-gray-200">
        {t('classicDivision')} ({entries.length} / {CLASSIC_MAX})
      </h4>
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          {t('classicFirstCome')} ({confirmed.length} / {CLASSIC_FIRST_COME})
        </p>
        {confirmed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {confirmed.map((p) => (
              <ParticipantTile
                key={p.id}
                p={p}
                statusLabel={t(p.mode === 'OFFLINE' ? 'modeOffline' : 'modeOnline')}
              />
            ))}
          </div>
        )}
      </div>
      {waitlist.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{t('statusWaitlist')} ({waitlist.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {waitlist.map((p) => (
              <ParticipantTile
                key={p.id}
                p={p}
                statusLabel={t(p.mode === 'OFFLINE' ? 'modeOffline' : 'modeOnline')}
                muted
              />
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 italic">
        {t('classicInvitationalNote', { count: CLASSIC_INVITATIONAL })}
      </p>
      <CountryRepresentation participants={entries} />
    </div>
  );
}

function ParticipantsList({ tournamentId }: { tournamentId: number }) {
  const t = useTranslations('tournament');
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentsApi
      .getParticipants(tournamentId)
      .then((res) => {
        setParticipants(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tournamentId]);

  if (loading) return null;

  const gp = participants.filter((p) => p.division === 'GP');
  const classic = participants.filter((p) => p.division === 'CLASSIC');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('participants')}</CardTitle>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noParticipants')}</p>
        ) : (
          <div className="space-y-8">
            {gp.length > 0 && <GpSection entries={gp} t={t} />}
            {classic.length > 0 && <ClassicSection entries={classic} t={t} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountryRepresentation({ participants }: { participants: any[] }) {
  const t = useTranslations('tournament');
  const uniqueByUser = useMemo(() => {
    const seen = new Set<number>();
    return participants.filter((p) => {
      if (seen.has(p.userId)) return false;
      seen.add(p.userId);
      return true;
    });
  }, [participants]);
  const total = uniqueByUser.length;

  const countryRows = useMemo(() => {
    const grouped: Record<string, { count: number; players: { displayName: string; profileNumber: string }[] }> = {};
    for (const p of uniqueByUser) {
      const code = p.user?.profile?.country || 'UNKNOWN';
      if (!grouped[code]) grouped[code] = { count: 0, players: [] };
      grouped[code].count += 1;
      grouped[code].players.push({
        displayName: p.user?.displayName || `Player ${p.userId}`,
        profileNumber: p.user?.profileNumber || '',
      });
    }

    const sorted = Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([code, data]) => ({
        code,
        name: code === 'UNKNOWN' ? t('unknownCountry') : (getCountryByCode(code)?.name || code),
        ...data,
      }));

    let rank = 1;
    return sorted.map((row, i) => {
      if (i > 0 && row.count < sorted[i - 1].count) rank = i + 1;
      return { ...row, rank };
    });
  }, [participants, t]);

  if (countryRows.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-300 mb-2">
        {t('countryRepresentation')}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-700/50 text-left text-gray-400">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">{t('country')}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">{t('participants')}</th>
              <th className="px-3 py-2">{t('players')}</th>
            </tr>
          </thead>
          <tbody>
            {countryRows.map(({ code, name, count, rank, players }) => (
              <tr
                key={code}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="px-3 py-2 text-gray-400">{rank}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-gray-300">
                    <span className={`fi fi-${code === 'UNKNOWN' ? 'un' : code.toLowerCase()} shrink-0`} />
                    {name}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300 whitespace-nowrap">
                  {count} / {total} ({Math.round((count / total) * 100)}%)
                </td>
                <td className="px-3 py-2 text-gray-300">
                  {players.map((player, i) => (
                    <span key={player.profileNumber || i}>
                      {i > 0 && ', '}
                      {player.profileNumber ? (
                        <Link
                          href={`/profile/${player.profileNumber}`}
                          className="hover:text-white hover:underline"
                        >
                          {player.displayName}
                        </Link>
                      ) : (
                        player.displayName
                      )}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
