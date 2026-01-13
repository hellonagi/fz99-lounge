'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { screenshotsApi } from '@/lib/api';

interface ScreenshotUploadFormProps {
  gameId: number;
  onUploadSuccess?: () => void;
  screenshotRequested?: boolean;
}

export function ScreenshotUploadForm({
  gameId,
  onUploadSuccess,
  screenshotRequested = false,
}: ScreenshotUploadFormProps) {
  const t = useTranslations('screenshotUpload');
  const tSsReq = useTranslations('screenshotRequest');
  const [preview, setPreview] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      file: null as File | null,
      file2: null as File | null,
    },
  });

  const { isSubmitting } = form.formState;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileNumber: 1 | 2 = 1) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (fileNumber === 1) {
        setPreview(null);
        form.setValue('file', null);
      } else {
        setPreview2(null);
        form.setValue('file2', null);
      }
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
    if (fileNumber === 1) {
      form.setValue('file', file);
    } else {
      form.setValue('file2', file);
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (fileNumber === 1) {
        setPreview(reader.result as string);
      } else {
        setPreview2(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: { file: File | null; file2: File | null }) => {
    if (!data.file) {
      setError(t('selectFile'));
      return;
    }

    try {
      // Upload first file as INDIVIDUAL_1
      await screenshotsApi.submit(gameId, data.file, 'INDIVIDUAL_1');

      // Upload second file if provided as INDIVIDUAL_2
      if (data.file2) {
        await screenshotsApi.submit(gameId, data.file2, 'INDIVIDUAL_2');
      }

      setSuccess(true);
      setPreview(null);
      setPreview2(null);
      form.reset();
      // Reset file inputs
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input) => {
        (input as HTMLInputElement).value = '';
      });

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

  // Only render if screenshotRequested is true
  if (!screenshotRequested) {
    return null;
  }

  return (
    <Card className="border-yellow-700/50 bg-yellow-900/10">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2 text-yellow-400">
              {tSsReq('title')}
            </h3>
            <p className="text-sm text-gray-400">
              {tSsReq('description')}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* SS1 Section */}
              <div className="p-3 bg-gray-800/50 rounded-lg space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">{tSsReq('screenshot1Label')}</p>
                  <div className="relative w-full max-w-[200px]">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <Image
                        src="/rules/cmini_example_1.webp"
                        alt="Example screenshot 1"
                        fill
                        sizes="200px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="file"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={(e) => handleFileChange(e, 1)}
                          className="h-auto py-1.5 bg-gray-700 border-gray-600 text-white cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:mr-4 file:my-0 file:py-1.5 file:px-4 file:rounded file:cursor-pointer hover:file:bg-blue-700"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              {/* SS2 Section */}
              <div className="p-3 bg-gray-800/50 rounded-lg space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">{tSsReq('screenshot2Label')}</p>
                  <div className="relative w-full max-w-[200px]">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <Image
                        src="/rules/cmini_example_2.webp"
                        alt="Example screenshot 2"
                        fill
                        sizes="200px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="file2"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={(e) => handleFileChange(e, 2)}
                          className="h-auto py-1.5 bg-gray-700 border-gray-600 text-white cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:mr-4 file:my-0 file:py-1.5 file:px-4 file:rounded file:cursor-pointer hover:file:bg-blue-700"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {preview2 && (
                  <div className="relative w-full max-w-2xl mx-auto">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                      <Image
                        src={preview2}
                        alt="Screenshot preview 2"
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

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
                disabled={isSubmitting || !form.watch('file')}
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
