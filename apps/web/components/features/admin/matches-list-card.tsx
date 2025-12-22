'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { matchesApi } from '@/lib/api';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { Trash2, Ban } from 'lucide-react';

interface Match {
  id: number;
  inGameMode: string;
  status: string;
  scheduledStart: string;
  maxPlayers: number;
  createdAt: string;
  season?: {
    seasonNumber: number;
    event?: {
      category: string;
    };
  };
  participants?: Array<{ userId: number }>;
  games?: Array<{ leagueType: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  IN_PROGRESS: 'bg-green-500/20 text-green-300 border-green-500/50',
  COMPLETED: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
  FINALIZED: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  CANCELLED: 'bg-red-500/20 text-red-300 border-red-500/50',
};

export function MatchesListCard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [matchToCancel, setMatchToCancel] = useState<Match | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchMatches = async () => {
    try {
      const response = await matchesApi.getAll();
      setMatches(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleDeleteClick = (match: Match) => {
    setMatchToDelete(match);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!matchToDelete) return;

    setIsDeleting(true);
    try {
      await matchesApi.delete(matchToDelete.id);
      setDeleteDialogOpen(false);
      setMatchToDelete(null);
      // Refresh list
      await fetchMatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete match');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelClick = (match: Match) => {
    setMatchToCancel(match);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!matchToCancel) return;

    setIsCancelling(true);
    try {
      await matchesApi.cancel(matchToCancel.id);
      setCancelDialogOpen(false);
      setMatchToCancel(null);
      // Refresh list
      await fetchMatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel match');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Matches</CardTitle>
          <CardDescription>
            Manage all matches. WAITING/IN_PROGRESS matches can be cancelled. Only WAITING matches can be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No matches found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">ID</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Season</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Category</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">League</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Scheduled</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Players</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Created</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const category = match.season?.event?.category;
                    const currentPlayers = match.participants?.length ?? 0;
                    const leagueType = match.games?.[0]?.leagueType ?? '-';
                    return (
                    <tr key={match.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-2 font-mono text-xs text-gray-300">
                        {match.id}
                      </td>
                      <td className="py-3 px-2 text-white">
                        S{match.season?.seasonNumber ?? '-'}
                      </td>
                      <td className="py-3 px-2 text-white">
                        {category === 'GP' ? '99' : category || '-'}
                      </td>
                      <td className="py-3 px-2 text-white">{leagueType}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                            STATUS_COLORS[match.status] || 'bg-gray-500/20 text-gray-300'
                          }`}
                        >
                          {match.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-300">
                        {new Date(match.scheduledStart).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-white">
                        {currentPlayers}/{match.maxPlayers}
                      </td>
                      <td className="py-3 px-2 text-gray-400 text-xs">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {(match.status === 'WAITING' || match.status === 'IN_PROGRESS') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelClick(match)}
                              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                              title="Cancel match"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {match.status === 'WAITING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(match)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              title="Delete match"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {matchToDelete && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          matchId={matchToDelete.id}
          league={matchToDelete.games?.[0]?.leagueType ?? '-'}
          scheduledStart={matchToDelete.scheduledStart}
        />
      )}

      {matchToCancel && (
        <DeleteConfirmDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onConfirm={handleCancelConfirm}
          matchId={matchToCancel.id}
          league={matchToCancel.games?.[0]?.leagueType ?? '-'}
          scheduledStart={matchToCancel.scheduledStart}
          title="Cancel Match"
          description="Are you sure you want to cancel this match? This action will set the match status to CANCELLED."
          confirmText="Cancel Match"
        />
      )}
    </>
  );
}
