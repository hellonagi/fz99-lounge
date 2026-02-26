'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertIcon } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

const seasonSchema = z.object({
  category: z.enum(['GP', 'CLASSIC', 'TEAM_CLASSIC', 'TEAM_GP']),
  seasonNumber: z
    .string()
    .min(1, 'シーズン番号は必須です')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, 'シーズン番号は1以上の数値である必要があります'),
  startDate: z.string().min(1, '開始日は必須です'),
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

type SeasonFormData = z.infer<typeof seasonSchema>;

interface CreateSeasonFormProps {
  onSuccess?: () => void;
}

export function CreateSeasonForm({ onSuccess }: CreateSeasonFormProps) {
  const [success, setSuccess] = useState(false);

  const form = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      category: 'GP',
      seasonNumber: '',
      startDate: '',
      endDate: '',
      description: '',
    },
  });

  const { isSubmitting } = form.formState;
  const category = form.watch('category');

  const onSubmit = async (data: SeasonFormData) => {
    try {
      // startDateは日付の開始時刻（0:00:00）に設定
      const startDate = new Date(data.startDate);
      startDate.setHours(0, 0, 0, 0);

      // endDateは日付の終了時刻（23:59:59）に設定
      let endDate: Date | undefined;
      if (data.endDate) {
        endDate = new Date(data.endDate);
        endDate.setHours(23, 59, 59, 999);
      }

      const response = await seasonsApi.create({
        category: data.category,
        seasonNumber: parseInt(data.seasonNumber),
        description: data.description || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : undefined,
      });

      if (response.data) {
        setSuccess(true);
        form.reset();

        if (onSuccess) {
          onSuccess();
        }

        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: unknown) {
      console.error('Error creating season:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('root', {
        type: 'manual',
        message: axiosError.response?.data?.message || 'シーズンの作成に失敗しました。もう一度お試しください。',
      });
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Plus className="h-5 w-5" />
          新規シーズン作成
        </CardTitle>
        <CardDescription className="text-gray-400">
          F-Zero 99の新しいシーズンを作成します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Category Selection */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">カテゴリ</FormLabel>
                  <FormControl>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="GP"
                          checked={field.value === 'GP'}
                          onChange={() => field.onChange('GP')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-white">GP（最大99人）</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="CLASSIC"
                          checked={field.value === 'CLASSIC'}
                          onChange={() => field.onChange('CLASSIC')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-white">CLASSIC（最大20人）</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="TEAM_CLASSIC"
                          checked={field.value === 'TEAM_CLASSIC'}
                          onChange={() => field.onChange('TEAM_CLASSIC')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-white">TEAM CLASSIC（12〜20人）</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="TEAM_GP"
                          checked={field.value === 'TEAM_GP'}
                          onChange={() => field.onChange('TEAM_GP')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-white">TEAM GP（30〜99人）</span>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder="1"
                      className="bg-gray-700 border-gray-600 text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-gray-400">
                    {category}モードのシーズン番号を入力してください
                  </FormDescription>
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
                    開始日 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="bg-gray-700 border-gray-600 text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-gray-400">
                    開始日の0:00から有効になります
                  </FormDescription>
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
                  <FormLabel className="text-white">終了日（オプション）</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="bg-gray-700 border-gray-600 text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-gray-400">
                    終了日の23:59:59まで有効です。空欄の場合は無期限となります
                  </FormDescription>
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
                <span>{form.formState.errors.root.message}</span>
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert variant="success">
                <AlertIcon>
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </AlertIcon>
                <span>シーズンが正常に作成されました！</span>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  作成中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  シーズンを作成
                </span>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
