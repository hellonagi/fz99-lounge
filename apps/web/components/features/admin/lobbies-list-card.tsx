'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { lobbiesApi } from '@/lib/api';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { Trash2, Ban } from 'lucide-react';

interface Lobby {
  id: string;
  gameMode: string;
  leagueType: string;
  status: string;
  scheduledStart: string;
  currentPlayers: number;
  maxPlayers: number;
  createdAt: string;
  createdByUser?: {
    displayName: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  IN_PROGRESS: 'bg-green-500/20 text-green-300 border-green-500/50',
  COMPLETED: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
  CANCELLED: 'bg-red-500/20 text-red-300 border-red-500/50',
};

export function LobbiesListCard() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lobbyToDelete, setLobbyToDelete] = useState<Lobby | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [lobbyToCancel, setLobbyToCancel] = useState<Lobby | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchLobbies = async () => {
    try {
      const response = await lobbiesApi.getAll();
      setLobbies(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load lobbies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();
  }, []);

  const handleDeleteClick = (lobby: Lobby) => {
    setLobbyToDelete(lobby);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!lobbyToDelete) return;

    setIsDeleting(true);
    try {
      await lobbiesApi.delete(lobbyToDelete.id);
      setDeleteDialogOpen(false);
      setLobbyToDelete(null);
      // Refresh list
      await fetchLobbies();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete lobby');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelClick = (lobby: Lobby) => {
    setLobbyToCancel(lobby);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!lobbyToCancel) return;

    setIsCancelling(true);
    try {
      await lobbiesApi.cancel(lobbyToCancel.id);
      setCancelDialogOpen(false);
      setLobbyToCancel(null);
      // Refresh list
      await fetchLobbies();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel lobby');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lobbies</CardTitle>
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
          <CardTitle>Lobbies</CardTitle>
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
          <CardTitle>Lobbies</CardTitle>
          <CardDescription>
            Manage all lobbies. WAITING/IN_PROGRESS lobbies can be cancelled. Only WAITING lobbies can be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lobbies.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No lobbies found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">ID</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Mode</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">League</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Scheduled</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Players</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Created By</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Created</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lobbies.map((lobby) => (
                    <tr key={lobby.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-2 font-mono text-xs text-gray-300">
                        {lobby.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-2 text-white">
                        {lobby.gameMode === 'GP' ? '99' : 'Classic'}
                      </td>
                      <td className="py-3 px-2 text-white">{lobby.leagueType}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                            STATUS_COLORS[lobby.status] || 'bg-gray-500/20 text-gray-300'
                          }`}
                        >
                          {lobby.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-300">
                        {new Date(lobby.scheduledStart).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-white">
                        {lobby.currentPlayers}/{lobby.maxPlayers}
                      </td>
                      <td className="py-3 px-2 text-gray-300">
                        {lobby.createdByUser?.displayName || 'Unknown'}
                      </td>
                      <td className="py-3 px-2 text-gray-400 text-xs">
                        {new Date(lobby.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {(lobby.status === 'WAITING' || lobby.status === 'IN_PROGRESS') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelClick(lobby)}
                              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                              title="Cancel lobby"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {lobby.status === 'WAITING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(lobby)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              title="Delete lobby"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {lobbyToDelete && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          lobbyId={lobbyToDelete.id}
          league={lobbyToDelete.leagueType}
          scheduledStart={lobbyToDelete.scheduledStart}
        />
      )}

      {lobbyToCancel && (
        <DeleteConfirmDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onConfirm={handleCancelConfirm}
          lobbyId={lobbyToCancel.id}
          league={lobbyToCancel.leagueType}
          scheduledStart={lobbyToCancel.scheduledStart}
          title="Cancel Lobby"
          description="Are you sure you want to cancel this lobby? This action will set the lobby status to CANCELLED."
          confirmText="Cancel Lobby"
        />
      )}
    </>
  );
}
