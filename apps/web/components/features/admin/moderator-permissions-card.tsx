'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { permissionsApi } from '@/lib/api';
import type { ModeratorPermission } from '@/types';

interface Moderator {
  id: number;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  discordId: string;
  permissions: ModeratorPermission[];
}

const ALL_PERMISSIONS: ModeratorPermission[] = [
  'CREATE_MATCH',
  'DELETE_MATCH',
  'CANCEL_MATCH',
  'VERIFY_SCORE',
  'REJECT_SCORE',
  'EDIT_SCORE',
  'VERIFY_SCREENSHOT',
  'REJECT_SCREENSHOT',
  'END_MATCH',
  'REGENERATE_PASSCODE',
  'UPDATE_TRACKS',
  'VIEW_MULTI_ACCOUNTS',
  'VIEW_LOGIN_HISTORY',
  'RECALCULATE_RATING',
];

const PERMISSION_GROUPS: { key: string; permissions: ModeratorPermission[] }[] = [
  {
    key: 'matchManagement',
    permissions: ['CREATE_MATCH', 'DELETE_MATCH', 'CANCEL_MATCH'],
  },
  {
    key: 'scoreManagement',
    permissions: ['VERIFY_SCORE', 'REJECT_SCORE', 'EDIT_SCORE'],
  },
  {
    key: 'screenshotManagement',
    permissions: ['VERIFY_SCREENSHOT', 'REJECT_SCREENSHOT'],
  },
  {
    key: 'matchOperations',
    permissions: ['END_MATCH', 'REGENERATE_PASSCODE', 'UPDATE_TRACKS'],
  },
  {
    key: 'adminTools',
    permissions: ['VIEW_MULTI_ACCOUNTS', 'VIEW_LOGIN_HISTORY', 'RECALCULATE_RATING'],
  },
];

export function ModeratorPermissionsCard() {
  const t = useTranslations('moderatorPermissions');
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [successUserId, setSuccessUserId] = useState<number | null>(null);

  const fetchModerators = useCallback(async () => {
    try {
      const response = await permissionsApi.getModerators();
      setModerators(response.data);
      setError(null);
    } catch {
      setError('Failed to load moderators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModerators();
  }, [fetchModerators]);

  const handleTogglePermission = async (
    moderator: Moderator,
    permission: ModeratorPermission,
  ) => {
    const hasPermission = moderator.permissions.includes(permission);
    const newPermissions = hasPermission
      ? moderator.permissions.filter((p) => p !== permission)
      : [...moderator.permissions, permission];

    // Optimistic update
    setModerators((prev) =>
      prev.map((m) =>
        m.id === moderator.id ? { ...m, permissions: newPermissions } : m,
      ),
    );

    setSavingUserId(moderator.id);
    try {
      await permissionsApi.setUserPermissions(moderator.id, newPermissions);
      setSuccessUserId(moderator.id);
      setTimeout(() => setSuccessUserId(null), 2000);
    } catch {
      // Revert on failure
      setModerators((prev) =>
        prev.map((m) =>
          m.id === moderator.id ? { ...m, permissions: moderator.permissions } : m,
        ),
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSelectAll = async (moderator: Moderator) => {
    const newPermissions = [...ALL_PERMISSIONS];

    setModerators((prev) =>
      prev.map((m) =>
        m.id === moderator.id ? { ...m, permissions: newPermissions } : m,
      ),
    );

    setSavingUserId(moderator.id);
    try {
      await permissionsApi.setUserPermissions(moderator.id, newPermissions);
      setSuccessUserId(moderator.id);
      setTimeout(() => setSuccessUserId(null), 2000);
    } catch {
      setModerators((prev) =>
        prev.map((m) =>
          m.id === moderator.id ? { ...m, permissions: moderator.permissions } : m,
        ),
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeselectAll = async (moderator: Moderator) => {
    const oldPermissions = moderator.permissions;

    setModerators((prev) =>
      prev.map((m) =>
        m.id === moderator.id ? { ...m, permissions: [] } : m,
      ),
    );

    setSavingUserId(moderator.id);
    try {
      await permissionsApi.setUserPermissions(moderator.id, []);
      setSuccessUserId(moderator.id);
      setTimeout(() => setSuccessUserId(null), 2000);
    } catch {
      setModerators((prev) =>
        prev.map((m) =>
          m.id === moderator.id ? { ...m, permissions: oldPermissions } : m,
        ),
      );
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
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
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {moderators.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t('noModerators')}</div>
        ) : (
          <div className="space-y-6">
            {moderators.map((moderator) => (
              <div
                key={moderator.id}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                {/* Moderator header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {moderator.avatarHash ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${moderator.discordId}/${moderator.avatarHash}.png?size=32`}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600" />
                    )}
                    <div>
                      <p className="text-white font-medium">
                        {moderator.displayName || moderator.username}
                      </p>
                      <p className="text-gray-400 text-xs">{moderator.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {successUserId === moderator.id && (
                      <span className="text-green-400 text-xs">{t('saved')}</span>
                    )}
                    {savingUserId === moderator.id && (
                      <span className="text-blue-400 text-xs">Saving...</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll(moderator)}
                      disabled={savingUserId === moderator.id}
                      className="text-xs h-7"
                    >
                      {t('selectAll')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeselectAll(moderator)}
                      disabled={savingUserId === moderator.id}
                      className="text-xs h-7"
                    >
                      {t('deselectAll')}
                    </Button>
                  </div>
                </div>

                {/* Permission groups */}
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.key}>
                      <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
                        {t(`groups.${group.key}`)}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission}
                            className="flex items-center justify-between gap-2 p-2 rounded bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer"
                          >
                            <span className="text-sm text-gray-200">
                              {t(`permissions.${permission}`)}
                            </span>
                            <Switch
                              checked={moderator.permissions.includes(permission)}
                              onCheckedChange={() =>
                                handleTogglePermission(moderator, permission)
                              }
                              disabled={savingUserId === moderator.id}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
