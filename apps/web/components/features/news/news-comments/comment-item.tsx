'use client';

import { useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Trash2, MessageSquare } from 'lucide-react';
import type { CommentDto } from '@/lib/api';
import { getAvatarUrl } from '@/lib/utils';
import { AnonymousAvatar } from './anonymous-avatar';
import { CommentForm } from './comment-form';

interface CommentItemProps {
  comment: CommentDto;
  isModerator: boolean;
  isReply?: boolean;
  onReply?: (parentId: number, body: string, isAnonymous: boolean) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
}

export function CommentItem({
  comment,
  isModerator,
  isReply,
  onReply,
  onDelete,
}: CommentItemProps) {
  const t = useTranslations('news.comments');
  const format = useFormatter();
  const locale = useLocale();
  const [showReply, setShowReply] = useState(false);

  const pilotName = (() => {
    if (!comment.anonymousPilot) return null;
    return locale === 'ja' ? comment.anonymousPilot.nameJa : comment.anonymousPilot.name;
  })();
  const displayName = comment.isDeleted
    ? null
    : comment.isAnonymous
      ? pilotName ?? 'Anonymous'
      : comment.user?.displayName ?? 'Unknown';

  const canDelete = !comment.isDeleted && (comment.isOwn || isModerator);

  const dateLabel = format.dateTime(new Date(comment.createdAt), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = async () => {
    if (!window.confirm(t('deleteConfirm'))) return;
    await onDelete(comment.id);
  };

  const renderAvatar = () => {
    if (comment.isDeleted) {
      return (
        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-700" aria-hidden />
      );
    }
    if (comment.isAnonymous && comment.anonymousPilot && pilotName) {
      return (
        <AnonymousAvatar
          name={pilotName}
          color={comment.anonymousPilot.color}
          size={32}
        />
      );
    }
    const userForAvatar = comment.user ?? comment.revealedUser ?? null;
    if (userForAvatar?.avatarHash) {
      const url = getAvatarUrl(userForAvatar.discordId, userForAvatar.avatarHash, 64);
      if (url) {
        return (
          <Image
            src={url}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 shrink-0 rounded-full bg-gray-700 object-cover"
          />
        );
      }
    }
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
        {(displayName ?? '?').charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className={isReply ? 'ml-10 sm:ml-12' : ''}>
      <div className="flex gap-3">
        {renderAvatar()}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-white">
              {comment.isDeleted ? t('deletedName') : displayName}
            </span>
            {isModerator && comment.isAnonymous && comment.revealedUser && (
              <span className="text-[11px] text-amber-400">
                ({comment.revealedUser.displayName})
              </span>
            )}
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
          <div className="mt-1">
            {comment.isDeleted ? (
              <p className="text-sm italic text-gray-500">{t('deleted')}</p>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm text-gray-200">
                {comment.body}
              </p>
            )}
          </div>
          {!comment.isDeleted && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              {!isReply && onReply && (
                <button
                  type="button"
                  onClick={() => setShowReply((v) => !v)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white"
                >
                  <MessageSquare className="h-3 w-3" />
                  {t('reply')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('delete')}
                </button>
              )}
            </div>
          )}
          {showReply && onReply && (
            <div className="mt-3">
              <CommentForm
                newsSlug={comment.newsSlug}
                autoFocus
                placeholder={t('replyTo', { name: displayName ?? '' })}
                submitLabel={t('reply')}
                onCancel={() => setShowReply(false)}
                onSubmit={async (body, isAnonymous) => {
                  await onReply(comment.id, body, isAnonymous);
                  setShowReply(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
