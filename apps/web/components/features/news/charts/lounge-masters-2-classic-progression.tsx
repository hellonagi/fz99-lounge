'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Overall standing (rank among all 20 Classic entrants) after each Mini Prix.
// pts holds the cumulative points at that stage, shown in the tooltip.
const DATA = [
  { mp: 'MP1', nag: 8, Dillion: 5, FullColor: 5, MoonweeD: 13, MasterA1: 2, pts: { nag:  200, Dillion:  215, FullColor:  215, MoonweeD:  100, MasterA1:  265 } },
  { mp: 'MP2', nag: 8, Dillion: 7, FullColor: 5, MoonweeD: 11, MasterA1: 1, pts: { nag:  415, Dillion:  425, FullColor:  450, MoonweeD:  315, MasterA1:  505 } },
  { mp: 'MP3', nag: 2, Dillion: 4, FullColor: 4, MoonweeD:  9, MasterA1: 1, pts: { nag:  710, Dillion:  630, FullColor:  630, MoonweeD:  490, MasterA1:  785 } },
  { mp: 'MP4', nag: 1, Dillion: 4, FullColor: 3, MoonweeD:  7, MasterA1: 2, pts: { nag:  940, Dillion:  815, FullColor:  845, MoonweeD:  715, MasterA1:  895 } },
  { mp: 'MP5', nag: 1, Dillion: 3, FullColor: 2, MoonweeD:  7, MasterA1: 4, pts: { nag: 1185, Dillion: 1055, FullColor: 1070, MoonweeD:  965, MasterA1: 1000 } },
  { mp: 'MP6', nag: 1, Dillion: 2, FullColor: 3, MoonweeD:  4, MasterA1: 5, pts: { nag: 1365, Dillion: 1325, FullColor: 1285, MoonweeD: 1195, MasterA1: 1185 } },
];

type ChartRow = (typeof DATA)[number];

// Ordered by final finishing position (1st, 2nd, 3rd, ...) so Legend matches the standings.
const PLAYERS = [
  { key: 'nag',       name: 'nag',            color: '#facc15', strokeWidth: 3 },
  { key: 'Dillion',   name: 'Dillion',        color: '#60a5fa', strokeWidth: 2 },
  { key: 'FullColor', name: 'FCR フルカラー', color: '#f472b6', strokeWidth: 2 },
  { key: 'MoonweeD',  name: 'MoonweeD',       color: '#4ade80', strokeWidth: 2 },
  { key: 'MasterA1',  name: 'Master A1',      color: '#a78bfa', strokeWidth: 2 },
];

export function LoungeMasters2ClassicProgressionChart() {
  const t = useTranslations('news.charts');
  return (
    <div className="not-prose my-6 rounded-lg border border-gray-700 bg-gray-900/50 p-3 sm:p-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-200 sm:text-base">
        {t('rankProgressionTitle')}
      </h4>
      <ResponsiveContainer width="100%" height={340} minWidth={0}>
        <LineChart data={DATA} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="mp"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            interval={0}
          />
          <YAxis
            reversed
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={48}
            domain={[1, 15]}
            ticks={[1, 5, 10, 15]}
            allowDecimals={false}
            tickFormatter={(v: number) => t('rankValue', { rank: v })}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number | undefined, _name, item) => {
              const row = item.payload as ChartRow | undefined;
              const key = item.dataKey as keyof ChartRow['pts'] | undefined;
              const points = key !== undefined ? row?.pts[key] : undefined;
              return points !== undefined
                ? t('rankValueWithPoints', { rank: value ?? 0, points })
                : t('rankValue', { rank: value ?? 0 });
            }}
            itemSorter={(item) => (typeof item.value === 'number' ? item.value : 0)}
          />
          <Legend
            wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }}
            itemSorter={(item) => PLAYERS.findIndex((p) => p.name === item.value)}
          />
          {PLAYERS.map((p) => (
            <Line
              key={p.key}
              type="linear"
              dataKey={p.key}
              name={p.name}
              stroke={p.color}
              strokeWidth={p.strokeWidth}
              dot={{ fill: p.color, strokeWidth: 0, r: 3 }}
              activeDot={{ fill: p.color, stroke: '#fff', strokeWidth: 2, r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
