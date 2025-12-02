'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { usersApi } from '@/lib/api';
import { toHalfWidth, validateDisplayName } from '@/lib/string';
import { useAuthStore } from '@/store/authStore';

const displayNameSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(10, 'Display name must be 10 characters or less')
    .refine(
      (val) => validateDisplayName(val).valid,
      (val) => ({ message: validateDisplayName(val).error || 'Invalid display name' })
    ),
});

type DisplayNameFormData = z.infer<typeof displayNameSchema>;

interface DisplayNameSetupModalProps {
  open: boolean;
}

export function DisplayNameSetupModal({ open }: DisplayNameSetupModalProps) {
  const [isComposing, setIsComposing] = useState(false);
  const { user, updateUser } = useAuthStore();

  const form = useForm<DisplayNameFormData>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: {
      displayName: '',
    },
  });

  const { isSubmitting } = form.formState;
  const displayName = form.watch('displayName');

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // 変換確定時に全角→半角変換を適用
    const value = (e.target as HTMLInputElement).value;
    const normalized = toHalfWidth(value);
    form.setValue('displayName', normalized, { shouldValidate: true });
  };

  const onSubmit = async (data: DisplayNameFormData) => {
    try {
      const response = await usersApi.updateDisplayName(data.displayName);
      // authStoreを更新
      if (user) {
        updateUser({
          ...user,
          displayName: response.data.displayName,
        });
      }
    } catch (err: any) {
      form.setError('displayName', {
        type: 'manual',
        message: err.response?.data?.message || 'Failed to set display name',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Your Display Name</DialogTitle>
          <DialogDescription>
            Choose a display name (1-10 characters). This can only be changed once every 60 days.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Enter display name..."
                      maxLength={10}
                      autoFocus
                      disabled={isSubmitting}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        // IME変換中は半角変換をスキップ
                        if (isComposing) {
                          field.onChange(value);
                        } else {
                          const normalized = toHalfWidth(value);
                          field.onChange(normalized);
                        }
                      }}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                    />
                  </FormControl>
                  <FormDescription>
                    {displayName.length}/10 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !displayName}>
                {isSubmitting ? 'Setting...' : 'Set Display Name'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
