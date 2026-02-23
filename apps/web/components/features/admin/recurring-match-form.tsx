'use client';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';

export const CATEGORY_OPTIONS = [
  { value: 'CLASSIC', label: 'Classic Mode' },
  { value: 'TEAM_CLASSIC', label: 'Team Classic Mode' },
];

export const LEAGUE_OPTIONS = [
  { value: 'KNIGHT', label: 'Knight League' },
  { value: 'QUEEN', label: 'Queen League' },
  { value: 'KING', label: 'King League' },
  { value: 'ACE', label: 'Ace League' },
  { value: 'MIRROR_KNIGHT', label: 'Mirror Knight League' },
  { value: 'MIRROR_QUEEN', label: 'Mirror Queen League' },
  { value: 'MIRROR_KING', label: 'Mirror King League' },
  { value: 'MIRROR_ACE', label: 'Mirror Ace League' },
];

export const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun display order

export const ruleSchema = z.object({
  daysOfWeek: z.array(z.number()).min(1, 'Select at least one day'),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
});

export const recurringMatchSchema = z.object({
  eventCategory: z.enum(['GP', 'CLASSIC', 'TEAM_CLASSIC']),
  inGameMode: z.string().min(1),
  leagueType: z.string().optional(),
  rules: z.array(ruleSchema).min(1, 'At least one time slot is required'),
  minPlayers: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1),
  maxPlayers: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1),
}).refine(
  (data) => parseInt(data.maxPlayers) >= parseInt(data.minPlayers),
  { message: 'Max players must be >= min players', path: ['maxPlayers'] },
);

export type RecurringMatchFormData = z.infer<typeof recurringMatchSchema>;

interface RecurringMatchFormProps {
  form: UseFormReturn<RecurringMatchFormData>;
  isEditMode: boolean;
}

export function RecurringMatchForm({ form, isEditMode }: RecurringMatchFormProps) {
  const t = useTranslations('recurringMatch');

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  const category = form.watch('eventCategory');
  const isGPMode = category === 'GP';

  return (
    <div className="space-y-4">
      {/* Category */}
      {isEditMode ? (
        <div className="space-y-2">
          <FormLabel>{t('category')}</FormLabel>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-gray-300">
              {category === 'TEAM_CLASSIC' ? 'TEAM CLASSIC' : category}
            </Badge>
            <span className="text-sm text-gray-400">({t('categoryReadonly')})</span>
          </div>
        </div>
      ) : (
        <FormField
          control={form.control}
          name="eventCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('category')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCategory')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
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
      )}

      {/* League Type - GP only */}
      {isGPMode && (
        <FormField
          control={form.control}
          name="leagueType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('leagueType')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectLeague')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LEAGUE_OPTIONS.map((option) => (
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
      )}

      {/* Time Slot Rules */}
      <div className="space-y-3">
        <FormLabel>{t('timeSlots')}</FormLabel>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-gray-700 bg-gray-800/30 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {t('timeSlotLabel', { number: index + 1 })}
              </span>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Days of Week */}
            <FormField
              control={form.control}
              name={`rules.${index}.daysOfWeek`}
              render={({ field: dayField }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('daysOfWeek')}</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {DAY_VALUES.map((day) => (
                      <label
                        key={day}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={(dayField.value ?? []).includes(day)}
                          onCheckedChange={(checked) => {
                            const current = dayField.value ?? [];
                            if (checked) {
                              dayField.onChange([...current, day]);
                            } else {
                              dayField.onChange(current.filter((d) => d !== day));
                            }
                          }}
                        />
                        <span className="text-sm">{t(`dayNames.${day}`)}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time of Day */}
            <FormField
              control={form.control}
              name={`rules.${index}.timeOfDay`}
              render={({ field: timeField }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t('timeOfDay')}</FormLabel>
                  <FormControl>
                    <Input type="time" {...timeField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ daysOfWeek: [], timeOfDay: '21:00' })}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('addTimeSlot')}
        </Button>
      </div>

      {/* Player Count */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="minPlayers"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('minPlayers')}</FormLabel>
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
              <FormLabel>{t('maxPlayers')}</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
