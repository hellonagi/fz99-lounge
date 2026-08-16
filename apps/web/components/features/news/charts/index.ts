import type { ComponentType } from 'react';
import { LoungeMasters1ProgressionChart } from './lounge-masters-1-progression';
import { LoungeMasters2ClassicProgressionChart } from './lounge-masters-2-classic-progression';
import { LoungeMasters2ProgressionChart } from './lounge-masters-2-progression';

export const NEWS_CHART_REGISTRY: Record<string, ComponentType> = {
  'lounge-masters-1-progression': LoungeMasters1ProgressionChart,
  'lounge-masters-2-progression': LoungeMasters2ProgressionChart,
  'lounge-masters-2-classic-progression': LoungeMasters2ClassicProgressionChart,
};
