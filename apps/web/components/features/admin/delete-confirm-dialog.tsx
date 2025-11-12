'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  lobbyId: string;
  league: string;
  scheduledStart: string;
  title?: string;
  description?: string;
  confirmText?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  lobbyId,
  league,
  scheduledStart,
  title = 'Delete Lobby?',
  description = 'This action cannot be undone. This will permanently delete the lobby.',
  confirmText = 'Delete',
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-2">
          <div className="text-sm">
            <span className="text-gray-400">ID:</span>{' '}
            <span className="text-white font-mono">{lobbyId.slice(0, 8)}...</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">League:</span>{' '}
            <span className="text-white">{league}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">Scheduled:</span>{' '}
            <span className="text-white">
              {new Date(scheduledStart).toLocaleString()}
            </span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm}>
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
