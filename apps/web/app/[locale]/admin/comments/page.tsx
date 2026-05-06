'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { commentsApi, type CommentDto } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function AdminCommentsPage() {
  const t = useTranslations('news.comments');
  const format = useFormatter();
  const locale = useLocale();
  const { user } = useAuthStore();
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commentsApi.adminList(200);
      setComments(res.data);
      setError(null);
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return null;
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    await commentsApi.adminDelete(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">{t('title')}</h2>
      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-700">
          <table className="min-w-full divide-y divide-gray-700 text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Article</th>
                <th className="px-3 py-2 text-left font-medium">User</th>
                <th className="px-3 py-2 text-left font-medium">Body</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900 text-gray-200">
              {comments.map((c) => {
                const realUser = c.revealedUser ?? c.user;
                return (
                  <tr key={c.id} className={c.isDeleted ? 'opacity-50' : ''}>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/news/${c.newsSlug}#comment-${c.id}`}
                        className="text-blue-400 hover:underline"
                      >
                        {c.newsSlug}
                      </Link>
                      {c.parentId !== null && (
                        <span className="ml-1 text-xs text-gray-500">
                          (reply)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">
                        {realUser?.displayName ?? '—'}
                      </div>
                      {c.isAnonymous && c.anonymousPilot && (
                        <div className="text-xs text-amber-400">
                          anon: {locale === 'ja' ? c.anonymousPilot.nameJa : c.anonymousPilot.name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <p className="max-w-xl whitespace-pre-wrap break-words">
                        {c.isDeleted ? (
                          <span className="italic text-gray-500">
                            {t('deleted')}
                          </span>
                        ) : (
                          c.body
                        )}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-gray-400">
                      {format.dateTime(new Date(c.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {!c.isDeleted && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {t('delete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
