'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { adminApi } from '@/lib/api';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { UserRole } from '@/types';

interface AdminUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  discordId: string;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const LIMIT = 20;

export function UserManagementCard() {
  const t = useTranslations('userManagement');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [successUserId, setSuccessUserId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchUsers = useCallback(async (pageNum: number, searchQuery: string) => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers(pageNum, LIMIT, searchQuery || undefined);
      setUsers(response.data.data);
      setMeta(response.data.meta);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page, search);
  }, [fetchUsers, page, search]);

  const handleSearchChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const handleRoleUpdate = async (user: AdminUser, newRole: 'PLAYER' | 'MODERATOR') => {
    if (newRole === 'PLAYER' && user.role === 'MODERATOR') {
      if (!window.confirm(t('confirmDemote'))) return;
    }

    setUpdatingUserId(user.id);
    try {
      await adminApi.updateUserRole(user.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      );
      setSuccessUserId(user.id);
      setTimeout(() => setSuccessUserId(null), 2000);
    } catch {
      alert(t('updateFailed'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('never');
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-purple-900 text-purple-200 border-transparent">{t('roleAdmin')}</Badge>;
      case 'MODERATOR':
        return <Badge className="bg-blue-900 text-blue-200 border-transparent">{t('roleModerator')}</Badge>;
      default:
        return <Badge variant="secondary">{t('rolePlayer')}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t('noUsers')}</div>
        ) : (
          <>
            {/* Header row - hidden on mobile */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_140px] gap-4 px-4 py-2 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-700 mb-2">
              <div>{t('user')}</div>
              <div>{t('role')}</div>
              <div>{t('lastLogin')}</div>
              <div>{t('registered')}</div>
              <div>{t('actions')}</div>
            </div>

            {/* User rows */}
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_100px_140px] gap-2 sm:gap-4 items-center px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg"
                >
                  {/* User info */}
                  <div className="flex items-center gap-3">
                    {user.avatarHash ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatarHash}.png?size=32`}
                        alt=""
                        className="w-8 h-8 rounded-full shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">
                        {user.displayName || user.username}
                      </p>
                      <p className="text-gray-400 text-xs truncate">{user.username}</p>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div className="flex items-center gap-2 sm:block">
                    <span className="text-xs text-gray-400 sm:hidden">{t('role')}:</span>
                    {getRoleBadge(user.role)}
                  </div>

                  {/* Last login */}
                  <div className="flex items-center gap-2 sm:block">
                    <span className="text-xs text-gray-400 sm:hidden">{t('lastLogin')}:</span>
                    <span className="text-sm text-gray-300">{formatDate(user.lastLoginAt)}</span>
                  </div>

                  {/* Registered */}
                  <div className="flex items-center gap-2 sm:block">
                    <span className="text-xs text-gray-400 sm:hidden">{t('registered')}:</span>
                    <span className="text-sm text-gray-300">{formatDate(user.createdAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {successUserId === user.id && (
                      <span className="text-green-400 text-xs">{t('updateSuccess')}</span>
                    )}
                    {user.role === 'PLAYER' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        disabled={updatingUserId === user.id}
                        onClick={() => handleRoleUpdate(user, 'MODERATOR')}
                      >
                        {t('promoteToModerator')}
                      </Button>
                    )}
                    {user.role === 'MODERATOR' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 text-red-400 hover:text-red-300"
                        disabled={updatingUserId === user.id}
                        onClick={() => handleRoleUpdate(user, 'PLAYER')}
                      >
                        {t('demoteToPlayer')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <span className="text-sm text-gray-400">
                  {meta.total} users / Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
