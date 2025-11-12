'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Save, X } from 'lucide-react';
import { seasonsApi } from '@/lib/api';

interface EditSeasonDialogProps {
  seasonId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditSeasonDialog({ seasonId, isOpen, onClose, onSuccess }: EditSeasonDialogProps) {
  const [formData, setFormData] = useState({
    seasonNumber: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [originalGameMode, setOriginalGameMode] = useState<'GP' | 'CLASSIC'>('GP');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && seasonId) {
      fetchSeasonData();
    }
  }, [isOpen, seasonId]);

  const fetchSeasonData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await seasonsApi.getById(seasonId);
      const season = response.data;

      if (season) {
        setFormData({
          seasonNumber: season.seasonNumber.toString(),
          description: season.description || '',
          startDate: season.event.startDate ?
            new Date(season.event.startDate).toISOString().slice(0, 16) : '',
          endDate: season.event.endDate ?
            new Date(season.event.endDate).toISOString().slice(0, 16) : '',
        });
        setOriginalGameMode(season.gameMode);
      }
    } catch (err: any) {
      console.error('Error fetching season:', err);
      setError('シーズン情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

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
      await seasonsApi.update(seasonId, {
        seasonNumber: parseInt(formData.seasonNumber),
        description: formData.description || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      });

      setSuccess(true);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err: any) {
      console.error('Error updating season:', err);
      setError(
        err.response?.data?.message ||
        'シーズンの更新に失敗しました。もう一度お試しください。'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Game Mode (Display Only) */}
            <div className="space-y-2">
              <Label className="text-white">ゲームモード</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-gray-300">
                  {originalGameMode}
                </Badge>
                <span className="text-sm text-gray-400">
                  （変更不可）
                </span>
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
                required
                className="bg-gray-700 border-gray-600 text-white"
              />
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
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-md flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <span className="text-green-300 text-sm">
                  シーズンが正常に更新されました！
                </span>
              </div>
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
        )}
      </DialogContent>
    </Dialog>
  );
}