'use client';

import { useState, useEffect } from 'react';
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
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usersApi } from '@/lib/api';
import { toHalfWidth, validateDisplayName } from '@/lib/string';
import { useAuthStore } from '@/store/authStore';
import { countries } from '@/lib/countries';

const setupSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(10, 'Display name must be 10 characters or less')
    .superRefine((val, ctx) => {
      const result = validateDisplayName(val);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.error || 'Invalid display name',
        });
      }
    }),
  country: z.string().min(1, 'Please select your country'),
});

type SetupFormData = z.infer<typeof setupSchema>;

interface DisplayNameSetupModalProps {
  open: boolean;
}

export function DisplayNameSetupModal({ open }: DisplayNameSetupModalProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [, setIsLoadingSuggestion] = useState(false);
  const { user, updateUser } = useAuthStore();

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      displayName: '',
      country: '',
    },
  });

  const { isSubmitting } = form.formState;
  const displayName = form.watch('displayName');
  const country = form.watch('country');

  // Fetch suggested country from IP geolocation when modal opens
  useEffect(() => {
    if (open && !country) {
      setIsLoadingSuggestion(true);
      usersApi.getSuggestedCountry()
        .then((res) => {
          if (res.data.country) {
            form.setValue('country', res.data.country);
          }
        })
        .catch(() => {
          // Ignore errors - user can still select manually
        })
        .finally(() => {
          setIsLoadingSuggestion(false);
        });
    }
  }, [open, country, form]);

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

  const onSubmit = async (data: SetupFormData) => {
    try {
      // Update display name and country together
      const response = await usersApi.updateProfile({
        displayName: data.displayName,
        country: data.country,
      });
      // authStoreを更新
      if (user) {
        updateUser({
          ...user,
          displayName: response.data.displayName,
          country: response.data.country,
        });
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('displayName', {
        type: 'manual',
        message: axiosError.response?.data?.message || 'Failed to save profile',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Up Your Profile</DialogTitle>
          <DialogDescription>
            Choose a display name and select your country. Display name can only be changed once every 60 days.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
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

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country">
                          {field.value && (
                            <span className="flex items-center gap-2">
                              <span className={`fi fi-${field.value.toLowerCase()}`} />
                              {countries.find((c) => c.code === field.value)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="flex items-center gap-2">
                            <span className={`fi fi-${c.code.toLowerCase()}`} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !displayName || !country}>
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
