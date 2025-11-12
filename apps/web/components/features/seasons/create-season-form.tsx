'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

interface CreateSeasonFormProps {
  onSuccess?: () => void;
}

export function CreateSeasonForm({ onSuccess }: CreateSeasonFormProps) {
  const [formData, setFormData] = useState({
    gameMode: 'GP' as 'GP' | 'CLASSIC',
    seasonNumber: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.seasonNumber || !formData.startDate) {
      setError('シーズン番号と開始日は必須です');
      return;
    }

    if (formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      setError('終了日は開始日より後である必要があります');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await seasonsApi.create({
        gameMode: formData.gameMode,
        seasonNumber: parseInt(formData.seasonNumber),
        description: formData.description || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      });

      if (response.data) {
        setSuccess(true);
        // Reset form
        setFormData({
          gameMode: 'GP',
          seasonNumber: '',
          description: '',
          startDate: '',
          endDate: '',
        });

        // Call success callback
        if (onSuccess) {
          onSuccess();
        }

        // Auto-dismiss success message
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error creating season:', err);
      setError(
        err.response?.data?.message ||
        'シーズンの作成に失敗しました。もう一度お試しください。'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Game Mode Selection */}
          <div className="space-y-2">
            <Label className="text-white">ゲームモード</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gameMode"
                  value="GP"
                  checked={formData.gameMode === 'GP'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-white">GP（最大99人）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gameMode"
                  value="CLASSIC"
                  checked={formData.gameMode === 'CLASSIC'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-white">CLASSIC（最大20人）</span>
              </label>
            </div>
          </div>

          {/* Season Number */}
          <div className="space-y-2">
            <Label htmlFor="seasonNumber" className="text-white">
              シーズン番号 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="seasonNumber"
              name="seasonNumber"
              type="number"
              min="1"
              value={formData.seasonNumber}
              onChange={handleInputChange}
              placeholder="1"
              required
              className="bg-gray-700 border-gray-600 text-white"
            />
            <p className="text-sm text-gray-400">
              {formData.gameMode}モードのシーズン番号を入力してください
            </p>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-white">
              開始日時 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="startDate"
              name="startDate"
              type="datetime-local"
              value={formData.startDate}
              onChange={handleInputChange}
              required
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-white">
              終了日時（オプション）
            </Label>
            <Input
              id="endDate"
              name="endDate"
              type="datetime-local"
              value={formData.endDate}
              onChange={handleInputChange}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <p className="text-sm text-gray-400">
              空欄の場合は無期限となります
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">
              説明（オプション）
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="このシーズンの説明を入力..."
              rows={3}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-md flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
              <span className="text-green-300">
                シーズンが正常に作成されました！
              </span>
            </div>
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
      </CardContent>
    </Card>
  );
}