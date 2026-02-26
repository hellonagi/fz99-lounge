'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { adminApi } from '@/lib/api';

const recalculateSchema = z.object({
  category: z.enum(['classic', 'team_classic', 'team_gp']),
  season: z.coerce.number().min(0, 'Season must be at least 0'),
  fromMatchNumber: z.coerce.number().min(1, 'Match number must be at least 1'),
});

type RecalculateFormData = z.infer<typeof recalculateSchema>;

interface RecalculateResult {
  recalculatedMatches: number;
  affectedUsers: number;
}

export function RatingRecalculationCard() {
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<RecalculateResult | null>(null);

  const form = useForm<RecalculateFormData>({
    resolver: zodResolver(recalculateSchema),
    defaultValues: {
      category: 'classic',
      season: 1,
      fromMatchNumber: 1,
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: RecalculateFormData) => {
    try {
      setResult(null);
      const response = await adminApi.recalculateRatings(
        data.category,
        data.season,
        data.fromMatchNumber
      );
      setResult({
        recalculatedMatches: response.data.recalculatedMatches,
        affectedUsers: response.data.affectedUsers,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      form.setError('root', {
        type: 'manual',
        message: axiosError.response?.data?.message || 'Failed to recalculate ratings',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Recalculation</CardTitle>
        <CardDescription>
          Recalculate ratings from a specific match number
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="team_classic">Team Classic</SelectItem>
                      <SelectItem value="team_gp">Team GP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Season */}
            <FormField
              control={form.control}
              name="season"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season Number</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber ?? 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* From Match Number */}
            <FormField
              control={form.control}
              name="fromMatchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Match Number</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    Ratings will be recalculated from this match onwards
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error/Success Messages */}
            {form.formState.errors.root && (
              <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
            )}
            {success && result && (
              <Alert variant="success">
                Recalculation complete: {result.recalculatedMatches} matches, {result.affectedUsers} users affected
              </Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Recalculating...
                </span>
              ) : (
                'Recalculate Ratings'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
