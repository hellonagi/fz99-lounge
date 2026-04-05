'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
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

interface DisplayNameSetupModalProps {
  open: boolean;
}

export function DisplayNameSetupModal({ open }: DisplayNameSetupModalProps) {
  const t = useTranslations('setupProfile');
  const [isComposing, setIsComposing] = useState(false);
  const { user, updateUser } = useAuthStore();

  const setupSchema = z.object({
    displayName: z
      .string()
      .min(1, t('displayNameRequired'))
      .max(10, t('displayNameMaxLength'))
      .superRefine((val, ctx) => {
        const result = validateDisplayName(val);
        if (!result.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error || t('displayNameInvalid'),
          });
        }
      }),
    country: z.string().min(1, t('countryRequired')),
  });

  type SetupFormData = z.infer<typeof setupSchema>;

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      country: '',
    },
  });

  const { isSubmitting, isValid } = form.formState;

  useEffect(() => {
    if (open) {
      usersApi.getSuggestedCountry()
        .then((res) => {
          if (res.data.country && !form.getValues('country')) {
            form.setValue('country', res.data.country, { shouldValidate: true });
          }
        })
        .catch(() => {});
    }
  }, [open, form]);

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const value = (e.target as HTMLInputElement).value;
    const normalized = toHalfWidth(value);
    form.setValue('displayName', normalized, { shouldValidate: true });
  };

  const onSubmit = async (data: SetupFormData) => {
    try {
      const response = await usersApi.updateProfile({
        displayName: data.displayName,
        country: data.country,
      });
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
        message: axiosError.response?.data?.message || t('saveFailed'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('displayName')}</FormLabel>
                  <FormControl>
                    <Input
                      className="mt-1"
                      placeholder={t('displayNamePlaceholder')}
                      maxLength={10}
                      autoFocus
                      disabled={isSubmitting}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
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
                    {t('characters', { count: field.value.length })}
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
                  <FormLabel>{t('country')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('countryPlaceholder')}>
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
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
