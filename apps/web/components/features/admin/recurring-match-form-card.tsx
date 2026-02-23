'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Form } from '@/components/ui/form';
import { recurringMatchesApi } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/lib/permissions';
import { X } from 'lucide-react';
import {
  RecurringMatchForm,
  recurringMatchSchema,
  type RecurringMatchFormData,
} from './recurring-match-form';
import type { RecurringMatch } from '@/types';

interface RecurringMatchFormCardProps {
  schedule: RecurringMatch | null;
  onSuccess: () => void;
  onCancelEdit: () => void;
}

const CREATE_DEFAULTS: RecurringMatchFormData = {
  eventCategory: 'CLASSIC',
  inGameMode: 'CLASSIC_MINI_PRIX',
  leagueType: undefined,
  rules: [{ daysOfWeek: [], timeOfDay: '21:00' }],
  minPlayers: '12',
  maxPlayers: '20',
};

export function RecurringMatchFormCard({
  schedule,
  onSuccess,
  onCancelEdit,
}: RecurringMatchFormCardProps) {
  const { user } = useAuthStore();
  const t = useTranslations('recurringMatch');
  const [success, setSuccess] = useState(false);
  const isEditMode = !!schedule;

  const form = useForm<RecurringMatchFormData>({
    resolver: zodResolver(recurringMatchSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  const { isSubmitting } = form.formState;
  const category = form.watch('eventCategory');

  // Update defaults when category changes (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (category === 'GP') {
      form.setValue('leagueType', 'KNIGHT');
      form.setValue('inGameMode', 'GRAND_PRIX');
      form.setValue('minPlayers', '40');
      form.setValue('maxPlayers', '99');
    } else {
      form.setValue('leagueType', undefined);
      form.setValue('inGameMode', 'CLASSIC_MINI_PRIX');
      form.setValue('minPlayers', '12');
      form.setValue('maxPlayers', '20');
    }
  }, [category, form, isEditMode]);

  // Prefill form when editing
  useEffect(() => {
    form.clearErrors();
    setSuccess(false);

    if (schedule) {
      form.reset({
        eventCategory: schedule.eventCategory as RecurringMatchFormData['eventCategory'],
        inGameMode: schedule.inGameMode,
        leagueType: schedule.leagueType || undefined,
        rules: schedule.rules.map((r) => ({
          daysOfWeek: r.daysOfWeek,
          timeOfDay: r.timeOfDay,
        })),
        minPlayers: String(schedule.minPlayers),
        maxPlayers: String(schedule.maxPlayers),
      });
    } else {
      form.reset(CREATE_DEFAULTS);
    }
  }, [schedule, form]);

  const onSubmit = async (data: RecurringMatchFormData) => {
    try {
      const payload = {
        inGameMode: data.inGameMode,
        ...(data.leagueType && { leagueType: data.leagueType }),
        rules: data.rules,
        minPlayers: parseInt(data.minPlayers),
        maxPlayers: parseInt(data.maxPlayers),
      };

      if (isEditMode) {
        await recurringMatchesApi.update(schedule.id, payload);
      } else {
        await recurringMatchesApi.create({
          eventCategory: data.eventCategory,
          ...payload,
        });
      }

      setSuccess(true);
      form.reset(CREATE_DEFAULTS);
      onSuccess();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('root', {
        type: 'manual',
        message:
          axiosError.response?.data?.message ||
          t(isEditMode ? 'updateError' : 'error'),
      });
    }
  };

  if (!hasPermission(user, 'CREATE_MATCH')) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {isEditMode ? t('editTitle') : t('createTitle')}
          </CardTitle>
          {isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RecurringMatchForm form={form} isEditMode={isEditMode} />

            {form.formState.errors.root && (
              <Alert variant="destructive">
                {form.formState.errors.root.message}
              </Alert>
            )}
            {success && (
              <Alert variant="success">
                {isEditMode ? t('updateSuccess') : t('success')}
              </Alert>
            )}

            <div className="flex gap-3">
              {isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={isSubmitting}
                  className="flex-1 border-gray-600"
                >
                  {t('cancelButton')}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className={isEditMode ? 'flex-1' : 'w-full'}
              >
                {isSubmitting
                  ? t(isEditMode ? 'saving' : 'creating')
                  : isEditMode
                    ? t('saveButton')
                    : t('createButton')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
