'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertIcon } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertCircle, CheckCircle, Save, X } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

const editSeasonSchema = z.object({
  seasonNumber: z
    .string()
    .min(1, 'シーズン番号は必須です')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, 'シーズン番号は1以上の数値である必要があります'),
  startDate: z.string().min(1, '開始日時は必須です'),
  endDate: z.string().optional(),
  description: z.string().optional(),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  { message: '終了日は開始日より後である必要があります', path: ['endDate'] }
);

type EditSeasonFormData = z.infer<typeof editSeasonSchema>;

interface EditSeasonDialogProps {
  seasonId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditSeasonDialog({ seasonId, isOpen, onClose, onSuccess }: EditSeasonDialogProps) {
  const [originalCategory, setOriginalCategory] = useState<'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP' | 'TOURNAMENT'>('GP');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const form = useForm<EditSeasonFormData>({
    resolver: zodResolver(editSeasonSchema),
    defaultValues: {
      seasonNumber: '',
      startDate: '',
      endDate: '',
      description: '',
    },
  });

  const { isSubmitting } = form.formState;

  const fetchSeasonData = async () => {
    try {
      setLoading(true);
      form.clearErrors();
      const response = await seasonsApi.getById(seasonId);
      const season = response.data;

      if (season) {
        form.reset({
          seasonNumber: season.seasonNumber.toString(),
          description: season.description || '',
          startDate: season.startDate
            ? new Date(season.startDate).toISOString().slice(0, 16)
            : '',
          endDate: season.endDate
            ? new Date(season.endDate).toISOString().slice(0, 16)
            : '',
        });
        setOriginalCategory(season.event.category);
      }
    } catch (err: unknown) {
      console.error('Error fetching season:', err);
      form.setError('root', {
        type: 'manual',
        message: 'シーズン情報の取得に失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && seasonId) {
      fetchSeasonData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, seasonId]);

  const onSubmit = async (data: EditSeasonFormData) => {
    try {
      await seasonsApi.update(seasonId, {
        seasonNumber: parseInt(data.seasonNumber),
        description: data.description || undefined,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      });

      setSuccess(true);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err: unknown) {
      console.error('Error updating season:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('root', {
        type: 'manual',
        message: axiosError.response?.data?.message || 'シーズンの更新に失敗しました。もう一度お試しください。',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            シーズン編集
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            シーズンの詳細情報を編集します
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Category (Display Only) */}
              <div className="space-y-2">
                <FormLabel className="text-white">カテゴリ</FormLabel>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-gray-300">
                    {originalCategory}
                  </Badge>
                  <span className="text-sm text-gray-400">（変更不可）</span>
                </div>
              </div>

              {/* Season Number */}
              <FormField
                control={form.control}
                name="seasonNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">
                      シーズン番号 <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">
                      開始日時 <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">終了日時（オプション）</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">説明（オプション）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="このシーズンの説明を入力..."
                        rows={3}
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Error Message */}
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertIcon>
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </AlertIcon>
                  <span className="text-sm">{form.formState.errors.root.message}</span>
                </Alert>
              )}

              {/* Success Message */}
              {success && (
                <Alert variant="success">
                  <AlertIcon>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </AlertIcon>
                  <span className="text-sm">シーズンが正常に更新されました！</span>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 border-gray-600"
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      保存中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      保存
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
