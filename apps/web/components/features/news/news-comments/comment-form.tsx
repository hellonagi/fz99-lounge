'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/store/authStore';
import { commentsApi } from '@/lib/api';
import { getAvatarUrl } from '@/lib/utils';
import { AnonymousAvatar } from './anonymous-avatar';

interface CommentFormProps {
  newsSlug: string;
  onSubmit: (body: string, isAnonymous: boolean) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
}

const MAX_LENGTH = 1000;

export function CommentForm({
  newsSlug,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
  submitLabel,
}: CommentFormProps) {
  const t = useTranslations('news.comments');
  const locale = useLocale();
  const { user } = useAuthStore();
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pilot, setPilot] = useState<{ name: string; nameJa: string; color: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    commentsApi
      .getMyPilot(newsSlug)
      .then((res) => {
        if (!cancelled) setPilot(res.data);
      })
      .catch(() => {
        // Non-fatal: avatar preview just falls back to user avatar.
      });
    return () => {
      cancelled = true;
    };
  }, [newsSlug, user]);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed, isAnonymous);
      setBody('');
      setIsAnonymous(false);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderAvatar = () => {
    if (isAnonymous && pilot) {
      const pilotName = locale === 'ja' ? pilot.nameJa : pilot.name;
      return <AnonymousAvatar name={pilotName} color={pilot.color} size={36} />;
    }
    if (user?.avatarHash && user.discordId) {
      return (
        <Image
          src={getAvatarUrl(user.discordId, user.avatarHash, 64)!}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="h-9 w-9 shrink-0 rounded-full bg-gray-700 object-cover"
        />
      );
    }
    return <div className="h-9 w-9 shrink-0 rounded-full bg-gray-700" />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500">{t('guideline')}</p>
      <div className="flex gap-3">
        {renderAvatar()}
        <div className="min-w-0 flex-1">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={placeholder ?? t('placeholder')}
            autoFocus={autoFocus}
            rows={3}
            maxLength={MAX_LENGTH}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
          <Checkbox
            checked={isAnonymous}
            onCheckedChange={(v) => setIsAnonymous(v === true)}
          />
          <span>{t('anonymousLabel')}</span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {t('charCount', { count: body.length })}
          </span>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t('cancel')}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? t('posting') : submitLabel ?? t('submit')}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
