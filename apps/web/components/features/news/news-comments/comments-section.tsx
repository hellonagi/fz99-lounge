'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SiDiscord } from 'react-icons/si';
import { useAuthStore } from '@/store/authStore';
import { commentsApi, type CommentDto } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';

interface CommentsSectionProps {
  newsSlug: string;
}

const POSTABLE_STATUSES = new Set(['ACTIVE', 'WARNED']);

export function CommentsSection({ newsSlug }: CommentsSectionProps) {
  const t = useTranslations('news.comments');
  const { user, isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isModerator =
    !!user && (user.role === 'ADMIN' || user.role === 'MODERATOR');
  const canPost =
    isAuthenticated && !!user && (!user.status || POSTABLE_STATUSES.has(user.status));

  const load = useCallback(async () => {
    try {
      const res = await commentsApi.list(newsSlug);
      setComments(res.data);
      setLoadError(null);
    } catch {
      setLoadError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [newsSlug, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (body: string, isAnonymous: boolean, parentId?: number) => {
    await commentsApi.create({ newsSlug, body, isAnonymous, parentId });
    await load();
  };

  const handleDelete = async (id: number) => {
    const target = findComment(comments, id);
    if (target?.isOwn) {
      await commentsApi.delete(id);
    } else if (isModerator) {
      await commentsApi.adminDelete(id);
    } else {
      await commentsApi.delete(id);
    }
    await load();
  };

  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/auth/discord`;
  };

  return (
    <section className="mt-12 border-t border-gray-700 pt-8">
      <h2 className="mb-6 text-xl font-bold text-white">{t('title')}</h2>

      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="mb-8 text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="mb-8 space-y-6">
          {comments.map((c) => (
            <li key={c.id} className="space-y-4">
              <CommentItem
                comment={c}
                isModerator={isModerator}
                onReply={canPost ? (pid, body, anon) => handleCreate(body, anon, pid) : undefined}
                onDelete={handleDelete}
              />
              {c.replies && c.replies.length > 0 && (
                <ul className="space-y-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem
                        comment={r}
                        isModerator={isModerator}
                        isReply
                        onDelete={handleDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-800 pt-6">
        {canPost ? (
          <CommentForm
            newsSlug={newsSlug}
            onSubmit={(body, anon) => handleCreate(body, anon)}
          />
        ) : isAuthenticated ? (
          <p className="rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-300">
            {t('suspendedNotice')}
          </p>
        ) : (
          <Button onClick={handleLogin} variant="discord" size="sm">
            <SiDiscord className="mr-1.5 h-4 w-4" />
            {t('loginToComment')}
          </Button>
        )}
      </div>
    </section>
  );
}

function findComment(list: CommentDto[], id: number): CommentDto | null {
  for (const c of list) {
    if (c.id === id) return c;
    if (c.replies) {
      const found = findComment(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}
