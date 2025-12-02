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
import { lobbiesApi } from '@/lib/api';

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

const lobbySchema = z.object({
  gameMode: z.enum(['GP', 'CLASSIC']),
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

type LobbyFormData = z.infer<typeof lobbySchema>;

export function CreateLobbyCard() {
  const [success, setSuccess] = useState(false);

  const form = useForm<LobbyFormData>({
    resolver: zodResolver(lobbySchema),
    defaultValues: {
      gameMode: 'GP',
      leagueType: 'KNIGHT',
      scheduledStart: '',
      minPlayers: '40',
      maxPlayers: '99',
      notes: '',
    },
  });

  const { isSubmitting } = form.formState;
  const gameMode = form.watch('gameMode');
  const leagueOptions = gameMode === 'GP' ? LEAGUE_OPTIONS_99 : LEAGUE_OPTIONS_CLASSIC;

  // Update defaults when game mode changes
  useEffect(() => {
    if (gameMode === 'GP') {
      form.setValue('leagueType', 'KNIGHT');
      form.setValue('minPlayers', '40');
      form.setValue('maxPlayers', '99');
    } else {
      form.setValue('leagueType', 'CLASSIC_MINI');
      form.setValue('minPlayers', '10');
      form.setValue('maxPlayers', '20');
    }
  }, [gameMode, form]);

  const onSubmit = async (data: LobbyFormData) => {
    try {
      await lobbiesApi.create({
        gameMode: data.gameMode,
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
        message: err.response?.data?.message || 'Failed to create lobby',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Lobby</CardTitle>
        <CardDescription>Schedule a new match lobby</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Game Mode */}
            <FormField
              control={form.control}
              name="gameMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game Mode</FormLabel>
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
                      placeholder="Any special notes for this lobby..."
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
              <Alert variant="success">Lobby created successfully!</Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating...' : 'Create Lobby'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
