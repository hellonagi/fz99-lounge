'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Users, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Tournament, TournamentStatus, LocalizedContent } from '@/types';

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

interface TournamentDetailProps {
  tournament: Tournament;
  onUpdate: () => void;
}

const registrationSchema = z.object({
  agreedToRules: z.literal(true, { message: 'agreeRequired' }),
  prizeEntry: z.boolean().optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

function getStatusBadgeVariant(status: TournamentStatus): 'default' | 'success' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'REGISTRATION_OPEN':
      return 'success';
    case 'IN_PROGRESS':
      return 'destructive';
    case 'COMPLETED':
      return 'secondary';
    default:
      return 'default';
  }
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

export function TournamentDetail({ tournament, onUpdate }: TournamentDetailProps) {
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
    defaultValues: { agreedToRules: undefined as unknown as true, prizeEntry: false },
  });

  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (user && tournament) {
      tournamentsApi.getParticipants(tournament.id).then((res) => {
        const found = res.data.some((p: { userId: number }) => p.userId === user.id);
        setRegistered(found);
      }).catch(() => {});
    }
  }, [user, tournament.id]);

  const canRegister =
    tournament.status === 'REGISTRATION_OPEN' &&
    tournament.registrationCount < tournament.maxPlayers &&
    isAuthenticated &&
    !registered;

  const handleRegister = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const prizeEntry = form.getValues('prizeEntry') ?? false;
      await tournamentsApi.register(tournament.id, { prizeEntry });
      setRegistered(true);
      setSuccess(t('registered'));
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await tournamentsApi.cancelRegistration(tournament.id);
      setRegistered(false);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {tournament.name}{' '}
              <span className="text-gray-400">
                {t('number', { number: tournament.tournamentNumber })}
              </span>
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(tournament.status)}>
              {t(`statusLabel.${tournament.status}`)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <div className="flex items-center gap-2 text-gray-300 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">{t('playerLimit')}</span>
              </div>
              <p className="text-white text-sm">
                {t('participantCount', {
                  count: tournament.registrationCount,
                  max: tournament.maxPlayers,
                })}
              </p>
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
            {tournament.rounds.map((round) => {
              const icon = getRoundIcon(round.inGameMode, round.league);
              const startTime = getRoundStartTime(
                tournament.tournamentDate,
                round.offsetMinutes,
              );
              return (
                <div
                  key={round.roundNumber}
                  className="flex items-center gap-3 py-2"
                >
                  <span className="text-sm text-blue-400 shrink-0 whitespace-nowrap">
                    {format.dateTime(startTime, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone,
                    })}
                  </span>
                  {icon && (
                    <Image
                      src={icon}
                      alt={round.league || round.inGameMode}
                      width={24}
                      height={24}
                      className="shrink-0"
                    />
                  )}
                  <span className="text-sm text-white">
                    {round.inGameMode.replace(/_/g, ' ')}
                    {round.league && ` / ${round.league.replace(/_/g, ' ')}`}
                  </span>
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

            {registered ? (
              <div className="space-y-4">
                <p className="text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('registered')}
                </p>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  {t('cancelRegistration')}
                </Button>
              </div>
            ) : canRegister ? (
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
                  <FormField
                    control={form.control}
                    name="prizeEntry"
                    render={({ field }) => (
                      <FormItem>
                        <div className="rounded-lg border border-gray-700 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <input
                                id="prizeEntry"
                                type="checkbox"
                                checked={field.value === true}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                              />
                            </FormControl>
                            <label htmlFor="prizeEntry" className="text-sm text-gray-300 cursor-pointer">
                              {t('prizeEntryLabel')}
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">{t('prizeEntryNote')}</p>
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('loading') : t('register')}
                  </Button>
                </form>
              </Form>
            ) : (
              <p className="text-gray-400">
                {tournament.registrationCount >= tournament.maxPlayers
                  ? t('tournamentFull')
                  : t('registrationClosed')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Participants */}
      <ParticipantsList tournamentId={tournament.id} />
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('participants')} ({participants.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noParticipants')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 p-2 bg-gray-800/50"
                >
                  <span
                    className={`fi fi-${p.user?.profile?.country?.toLowerCase() || 'un'} shrink-0`}
                    title={p.user?.profile?.country || ''}
                  />
                  <span className="text-sm text-white truncate">
                    {p.user?.displayName || `Player ${p.userId}`}
                  </span>
                </div>
              ))}
            </div>
            <CountryRepresentation participants={participants} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CountryRepresentation({ participants }: { participants: any[] }) {
  const t = useTranslations('tournament');
  const total = participants.length;

  const countryRows = useMemo(() => {
    const grouped: Record<string, { count: number; players: { displayName: string; profileNumber: string }[] }> = {};
    for (const p of participants) {
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
