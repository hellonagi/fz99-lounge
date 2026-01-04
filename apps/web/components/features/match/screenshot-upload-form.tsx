'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { screenshotsApi, ScreenshotType } from '@/lib/api';

interface ScreenshotUploadFormProps {
  gameId: number;
  type?: ScreenshotType;
  title?: string;
  description?: string;
  disabled?: boolean;
  isFirstPlace?: boolean;
  onUploadSuccess?: () => void;
}

export function ScreenshotUploadForm({
  gameId,
  type = 'INDIVIDUAL',
  title,
  description,
  disabled = false,
  isFirstPlace = false,
  onUploadSuccess,
}: ScreenshotUploadFormProps) {
  const t = useTranslations('screenshotUpload');
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
  });

  const { isSubmitting } = form.formState;

  // Default title and description
  const displayTitle = title || (type === 'FINAL_SCORE'
    ? t('finalScoreTitle')
    : t('individualTitle'));

  const displayDescription = description || (type === 'FINAL_SCORE'
    ? t('finalScoreDescription')
    : t('individualDescription'));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      form.setValue('file', null);
      return;
    }

    // Validate file type
    if (!file.type.match(/^image\/(jpg|jpeg|png|webp)$/i)) {
      setError(t('invalidFileType'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }

    setError(null);
    form.setValue('file', file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: { file: File | null }) => {
    if (!data.file) {
      setError(t('selectFile'));
      return;
    }

    try {
      await screenshotsApi.submit(gameId, data.file, type);

      setSuccess(true);
      setPreview(null);
      form.reset();
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || 'Failed to upload screenshot');
    }
  };

  // Determine card style based on state
  const cardClassName = disabled ? 'opacity-60' : '';

  return (
    <Card className={cardClassName}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">
              {displayTitle}
            </h3>

            {/* First place alert */}
            {isFirstPlace && (
              <Alert variant="danger" className="mb-2">
                <AlertDescription>{t('firstPlaceAlert')}</AlertDescription>
              </Alert>
            )}

            {/* Disabled message */}
            {disabled && !isFirstPlace && (
              <Alert variant="default" className="mb-2">
                <AlertDescription>{t('disabledMessage')}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-gray-400">
              {displayDescription}
            </p>
          </div>

          {/* Example image for FINAL_SCORE type */}
          {type === 'FINAL_SCORE' && (
            <div className="relative w-full max-w-md">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                <Image
                  src="/ss/ex2.webp"
                  alt="Example final score screenshot"
                  fill
                  sizes="(max-width: 768px) 100vw, 448px"
                  className="object-contain"
                />
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* File Input */}
              <FormField
                control={form.control}
                name="file"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-gray-300">
                      {t('screenshot')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileChange}
                        disabled={disabled}
                        className="h-auto py-1.5 bg-gray-700 border-gray-600 text-white cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:mr-4 file:my-0 file:py-1.5 file:px-4 file:rounded file:cursor-pointer hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      {t('screenshotDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {preview && (
                <div className="relative w-full max-w-2xl mx-auto">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                    <Image
                      src={preview}
                      alt="Screenshot preview"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">{error}</Alert>
              )}

              {/* Success Message */}
              {success && (
                <Alert variant="success">{t('success')}</Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={disabled || isSubmitting || !form.watch('file')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? t('uploading') : t('uploadButton')}
              </Button>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
