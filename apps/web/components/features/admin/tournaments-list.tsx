'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tournamentsApi } from '@/lib/api';
import { Tournament, TournamentStatus, TournamentRoundConfig } from '@/types';

const STATUS_OPTIONS: TournamentStatus[] = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'RESULTS_PENDING',
  'COMPLETED',
];

function getStatusBadgeVariant(status: TournamentStatus): 'default' | 'success' | 'destructive' | 'secondary' {
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

const MODE_OPTIONS = [
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

function TournamentEditor({ tournament, onSaved }: { tournament: Tournament; onSaved: () => void }) {
  const t = useTranslations('adminTournament');
  const [rounds, setRounds] = useState<TournamentRoundConfig[]>(tournament.rounds);
  const [en, setEn] = useState(tournament.content?.en || '');
  const [ja, setJa] = useState(tournament.content?.ja || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRound = (index: number, patch: Partial<TournamentRoundConfig>) => {
    setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRound = () => {
    const last = rounds[rounds.length - 1];
    const gap = rounds.length >= 2
      ? (rounds[rounds.length - 1].offsetMinutes ?? 0) - (rounds[rounds.length - 2].offsetMinutes ?? 0)
      : 20;
    setRounds([...rounds, {
      roundNumber: rounds.length + 1,
      inGameMode: 'GRAND_PRIX' as any,
      league: 'KNIGHT' as any,
      offsetMinutes: (last?.offsetMinutes ?? 0) + gap,
    }]);
  };

  const removeRound = (index: number) => {
    if (rounds.length <= 1) return;
    setRounds(rounds.filter((_, i) => i !== index).map((r, i) => ({ ...r, roundNumber: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const content = (en || ja) ? { en, ja } : null;
      const cleanRounds = rounds.map((r) => {
        const leagueNeeded = getLeagueOptions(r.inGameMode);
        const league = r.league && r.league !== 'none' ? r.league : undefined;
        return {
          ...r,
          league: league ?? (leagueNeeded ? leagueNeeded[0].value : undefined),
          offsetMinutes: r.offsetMinutes ?? 0,
        };
      });
      await tournamentsApi.update(tournament.id, {
        rounds: cleanRounds,
        totalRounds: cleanRounds.length,
        content,
      } as any);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full mt-3 space-y-4 border-t border-gray-700 pt-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Rounds */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">{t('roundConfig')}</h4>
        <div className="grid grid-cols-[60px_1fr_1fr_80px_32px] gap-2 mb-1">
          <span className="text-xs text-gray-500" />
          <span className="text-xs text-gray-500">{t('inGameMode')}</span>
          <span className="text-xs text-gray-500">{t('league')}</span>
          <span className="text-xs text-gray-500">{t('offsetMin')}</span>
          <span />
        </div>
        <div className="space-y-1">
          {rounds.map((round, i) => {
            const leagueOpts = getLeagueOptions(round.inGameMode);
            return (
              <div key={i} className="grid grid-cols-[60px_1fr_1fr_80px_32px] gap-2 items-center">
                <span className="text-xs text-gray-400">R{round.roundNumber}</span>
                <select
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={round.inGameMode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    const newLeagues = getLeagueOptions(mode);
                    updateRound(i, {
                      inGameMode: mode as any,
                      league: newLeagues ? newLeagues[0].value as any : undefined,
                    });
                  }}
                >
                  {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {leagueOpts ? (
                  <select
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={round.league || leagueOpts[0].value}
                    onChange={(e) => updateRound(i, { league: e.target.value as any })}
                  >
                    {leagueOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  value={round.offsetMinutes ?? 0}
                  onChange={(e) => updateRound(i, { offsetMinutes: parseInt(e.target.value, 10) || 0 })}
                />
                <button
                  type="button"
                  onClick={() => removeRound(i)}
                  className="text-gray-500 hover:text-red-400 disabled:opacity-30"
                  disabled={rounds.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={addRound}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Round
        </Button>
      </div>

      {/* Content */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">{t('content')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">{t('contentEn')}</label>
            <Textarea rows={8} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Markdown" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('contentJa')}</label>
            <Textarea rows={8} value={ja} onChange={(e) => setJa(e.target.value)} placeholder="Markdown" />
          </div>
        </div>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? '...' : t('update')}
      </Button>
    </div>
  );
}

interface TournamentsListProps {
  refreshKey?: number;
}

export function TournamentsList({ refreshKey }: TournamentsListProps) {
  const t = useTranslations('adminTournament');
  const tStatus = useTranslations('tournament.statusLabel');
  const pathname = usePathname();
  const locale = pathname.split('/')[1];

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await tournamentsApi.getAll();
      setTournaments(res.data);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, [refreshKey]);

  const handleStatusUpdate = async (id: number, status: TournamentStatus) => {
    try {
      await tournamentsApi.update(id, { status });
      fetchTournaments();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error'));
    }
  };

  const getNextStatus = (current: TournamentStatus): TournamentStatus | null => {
    const idx = STATUS_OPTIONS.indexOf(current);
    return idx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[idx + 1] : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('listTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('noTournaments')}</p>
        ) : (
          <div className="space-y-3">
            {tournaments.map((tournament) => {
              const nextStatus = getNextStatus(tournament.status);
              return (
                <div
                  key={tournament.id}
                  className="flex flex-wrap items-center justify-between rounded-lg border border-gray-700 p-3 bg-gray-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${locale}/tournament/${tournament.id}`}
                      className="text-white font-medium hover:text-blue-400 transition-colors"
                    >
                      {tournament.name} #{tournament.tournamentNumber}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getStatusBadgeVariant(tournament.status)}>
                        {tStatus(tournament.status)}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {tournament.registrationCount} players
                      </span>
                      <span className="text-xs text-gray-500">
                        {tournament.totalRounds} rounds
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(editingId === tournament.id ? null : tournament.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {nextStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(tournament.id, nextStatus)}
                      >
                        → {tStatus(nextStatus)}
                      </Button>
                    )}
                  </div>
                  {editingId === tournament.id && (
                    <TournamentEditor
                      tournament={tournament}
                      onSaved={() => {
                        setEditingId(null);
                        fetchTournaments();
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
