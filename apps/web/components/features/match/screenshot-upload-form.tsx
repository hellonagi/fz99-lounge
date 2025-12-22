'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
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
import { screenshotsApi } from '@/lib/api';

interface ScreenshotUploadFormProps {
  matchId: number;
  onUploadSuccess?: () => void;
}

export function ScreenshotUploadForm({ matchId: gameId, onUploadSuccess }: ScreenshotUploadFormProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      file: null as File | null,
    },
  });

  const { isSubmitting } = form.formState;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      form.setValue('file', null);
      return;
    }

    // Validate file type
    if (!file.type.match(/^image\/(jpg|jpeg|png|webp)$/i)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
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
      setError('Please select a file');
      return;
    }

    try {
      await screenshotsApi.submit(gameId, data.file);

      setSuccess(true);
      setPreview(null);
      form.reset();

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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">🏆 Submit Result Screenshot</h3>
            <p className="text-sm text-gray-400">
              As the 1st place winner, you can submit a screenshot of the final results
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* File Input */}
              <FormField
                control={form.control}
                name="file"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-gray-300">
                      Screenshot <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="h-auto py-1.5 bg-gray-700 border-gray-600 text-white cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:mr-4 file:my-0 file:py-1.5 file:px-4 file:rounded file:cursor-pointer hover:file:bg-blue-700"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      JPG, PNG, or WebP. Max 10MB.
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
                <Alert variant="success">Screenshot uploaded successfully!</Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !form.watch('file')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Uploading...' : 'Upload Screenshot'}
              </Button>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
