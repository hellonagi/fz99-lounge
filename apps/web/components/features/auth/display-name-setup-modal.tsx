'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usersApi } from '@/lib/api';
import { toHalfWidth, validateDisplayName } from '@/lib/string';
import { useAuthStore } from '@/store/authStore';

interface DisplayNameSetupModalProps {
  open: boolean;
}

export function DisplayNameSetupModal({ open }: DisplayNameSetupModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const { user, updateUser } = useAuthStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // IME変換中は半角変換をスキップ
    if (isComposing) {
      setDisplayName(value);
    } else {
      const normalized = toHalfWidth(value);
      setDisplayName(normalized);
    }
    setError('');
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // 変換確定時に全角→半角変換を適用
    const value = (e.target as HTMLInputElement).value;
    const normalized = toHalfWidth(value);
    setDisplayName(normalized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    const validation = validateDisplayName(displayName);
    if (!validation.valid) {
      setError(validation.error || 'Invalid display name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await usersApi.updateDisplayName(displayName);
      // authStoreを更新
      if (user) {
        updateUser({
          ...user,
          displayName: response.data.displayName,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set display name');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Your Display Name</DialogTitle>
          <DialogDescription>
            Choose a display name (1-10 characters). This can only be changed once every 60 days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                id="displayName"
                placeholder="Enter display name..."
                value={displayName}
                onChange={handleChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                maxLength={10}
                autoFocus
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-400">
                {displayName.length}/10 characters
              </p>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !displayName}>
              {isSubmitting ? 'Setting...' : 'Set Display Name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
