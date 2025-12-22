'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/form';
import { matchesApi, seasonsApi } from '@/lib/api';

const LEAGUE_OPTIONS_99 = [
  { value: 'KNIGHT', label: 'Knight League' },
  { value: 'QUEEN', label: 'Queen League' },
  { value: 'KING', label: 'King League' },
  { value: 'ACE', label: 'Ace League' },
  { value: 'MIRROR_KNIGHT', label: 'Mirror Knight League' },
  { value: 'MIRROR_QUEEN', label: 'Mirror Queen League' },
  { value: 'MIRROR_KING', label: 'Mirror King League' },
  { value: 'MIRROR_ACE', label: 'Mirror Ace League' },
];

const LEAGUE_OPTIONS_CLASSIC = [
  { value: 'CLASSIC_MINI', label: 'Classic Mini' },
];

const IN_GAME_MODE_OPTIONS = [
  { value: 'GRAND_PRIX', label: 'Grand Prix' },
  { value: 'MINI_PRIX', label: 'Mini Prix' },
  { value: 'TEAM_BATTLE', label: 'Team Battle' },
  { value: 'CLASSIC', label: 'Classic' },
  { value: 'CLASSIC_MINI_PRIX', label: 'Classic Mini Prix' },
  { value: 'PRO', label: 'Pro' },
  { value: 'NINETY_NINE', label: '99' },
];

const matchSchema = z.object({
  category: z.enum(['GP', 'CLASSIC']),
  seasonId: z.string().min(1, 'Season is required'),
  inGameMode: z.string().min(1, 'In-game mode is required'),
  leagueType: z.string().min(1, 'League type is required'),
  scheduledStart: z.string().min(1, 'Start time is required'),
  minPlayers: z
    .string()
    .min(1, 'Min players is required')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, 'Min players must be at least 1'),
  maxPlayers: z
    .string()
    .min(1, 'Max players is required')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, 'Max players must be at least 1'),
  notes: z.string().optional(),
}).refine(
  (data) => parseInt(data.maxPlayers) >= parseInt(data.minPlayers),
  { message: 'Max players must be greater than or equal to min players', path: ['maxPlayers'] }
);

type MatchFormData = z.infer<typeof matchSchema>;

interface Season {
  id: number;
  seasonNumber: number;
  event: {
    category: string;
  };
}

export function CreateMatchCard() {
  const [success, setSuccess] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);

  const form = useForm<MatchFormData>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      category: 'GP',
      seasonId: '',
      inGameMode: 'GRAND_PRIX',
      leagueType: 'KNIGHT',
      scheduledStart: '',
      minPlayers: '40',
      maxPlayers: '99',
      notes: '',
    },
  });

  const { isSubmitting } = form.formState;
  const category = form.watch('category');
  const leagueOptions = category === 'GP' ? LEAGUE_OPTIONS_99 : LEAGUE_OPTIONS_CLASSIC;

  // Fetch seasons on mount
  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const response = await seasonsApi.getAll();
        setSeasons(response.data);
      } catch (err) {
        console.error('Failed to fetch seasons:', err);
      }
    };
    fetchSeasons();
  }, []);

  // Filter seasons by category
  const filteredSeasons = seasons.filter(
    (s) => s.event?.category === category
  );

  // Update defaults when category changes
  useEffect(() => {
    if (category === 'GP') {
      form.setValue('leagueType', 'KNIGHT');
      form.setValue('inGameMode', 'GRAND_PRIX');
      form.setValue('minPlayers', '40');
      form.setValue('maxPlayers', '99');
    } else {
      form.setValue('leagueType', 'CLASSIC_MINI');
      form.setValue('inGameMode', 'CLASSIC');
      form.setValue('minPlayers', '10');
      form.setValue('maxPlayers', '20');
    }
    form.setValue('seasonId', '');
  }, [category, form]);

  const onSubmit = async (data: MatchFormData) => {
    try {
      await matchesApi.create({
        seasonId: parseInt(data.seasonId),
        inGameMode: data.inGameMode,
        leagueType: data.leagueType,
        scheduledStart: new Date(data.scheduledStart).toISOString(),
        minPlayers: parseInt(data.minPlayers),
        maxPlayers: parseInt(data.maxPlayers),
        notes: data.notes || undefined,
      });

      setSuccess(true);
      form.reset({
        ...form.getValues(),
        scheduledStart: '',
        notes: '',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      form.setError('root', {
        type: 'manual',
        message: err.response?.data?.message || 'Failed to create match',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Match</CardTitle>
        <CardDescription>Schedule a new match</CardDescription>
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
                  <FormControl>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="GP"
                          checked={field.value === 'GP'}
                          onChange={() => field.onChange('GP')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">99 Mode</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="CLASSIC"
                          checked={field.value === 'CLASSIC'}
                          onChange={() => field.onChange('CLASSIC')}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Classic Mode</span>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Season */}
            <FormField
              control={form.control}
              name="seasonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a season" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSeasons.map((season) => (
                        <SelectItem key={season.id} value={String(season.id)}>
                          Season {season.seasonNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* In-Game Mode */}
            <FormField
              control={form.control}
              name="inGameMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>In-Game Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {IN_GAME_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* League Type */}
            <FormField
              control={form.control}
              name="leagueType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>League Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a league" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leagueOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduled Start */}
            <FormField
              control={form.control}
              name="scheduledStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Start Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Player Count */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Players</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Players</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special notes for this match..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error/Success Messages */}
            {form.formState.errors.root && (
              <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
            )}
            {success && (
              <Alert variant="success">Match created successfully!</Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating...' : 'Create Match'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
