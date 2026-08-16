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

// Overall standing (rank among all 71 GP entrants) after each GP.
// pts holds the cumulative points at that stage, shown in the tooltip.
const DATA = [
  { gp: 'GP1', Nashorn: 26, Shiotchi:  4, Runea:  2, reo: 31, Misa: 11, pts: { Nashorn:  594, Shiotchi:  884, Runea:  904, reo:  586, Misa:  792 } },
  { gp: 'GP2', Nashorn:  9, Shiotchi:  2, Runea:  4, reo: 17, Misa:  3, pts: { Nashorn: 1484, Shiotchi: 1722, Runea: 1668, reo: 1324, Misa: 1674 } },
  { gp: 'GP3', Nashorn:  6, Shiotchi:  3, Runea:  4, reo: 12, Misa:  2, pts: { Nashorn: 2368, Shiotchi: 2574, Runea: 2536, reo: 2048, Misa: 2596 } },
  { gp: 'GP4', Nashorn:  4, Shiotchi:  1, Runea:  3, reo:  6, Misa: 15, pts: { Nashorn: 3236, Shiotchi: 3424, Runea: 3336, reo: 2994, Misa: 2596 } },
  { gp: 'GP5', Nashorn:  1, Shiotchi:  2, Runea:  5, reo:  4, Misa:  9, pts: { Nashorn: 4114, Shiotchi: 4094, Runea: 3890, reo: 3962, Misa: 3490 } },
  { gp: 'GP6', Nashorn:  1, Shiotchi:  2, Runea:  5, reo:  4, Misa:  7, pts: { Nashorn: 5004, Shiotchi: 4938, Runea: 4700, reo: 4892, Misa: 4298 } },
  { gp: 'GP7', Nashorn:  1, Shiotchi:  3, Runea:  4, reo:  2, Misa:  7, pts: { Nashorn: 5942, Shiotchi: 5720, Runea: 5432, reo: 5784, Misa: 5224 } },
  { gp: 'GP8', Nashorn:  1, Shiotchi:  2, Runea:  3, reo:  4, Misa:  5, pts: { Nashorn: 6754, Shiotchi: 6484, Runea: 6282, reo: 6256, Misa: 6094 } },
];

type ChartRow = (typeof DATA)[number];

// Ordered by final finishing position (1st, 2nd, 3rd, ...) so Legend matches the standings.
const PLAYERS = [
  { key: 'Nashorn',  name: 'ナスホルン',       color: '#facc15', strokeWidth: 3 },
  { key: 'Shiotchi', name: 'しおっち',         color: '#60a5fa', strokeWidth: 2 },
  { key: 'Runea',    name: 'CPU.ルネアちゃん', color: '#f472b6', strokeWidth: 2 },
  { key: 'reo',      name: 'reo',              color: '#4ade80', strokeWidth: 2 },
  { key: 'Misa',     name: 'Misa',             color: '#a78bfa', strokeWidth: 2 },
];

const LEAGUE_BY_GP: Record<string, string> = {
  GP1: 'Knight',
  GP2: 'Queen',
  GP3: 'King',
  GP4: 'Ace',
  GP5: 'M. Knight',
  GP6: 'M. Queen',
  GP7: 'M. King',
  GP8: 'M. Ace',
};

interface XAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
}

function XAxisTick({ x, y, payload, index }: XAxisTickProps) {
  if (x === undefined || y === undefined || !payload) return null;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const dy = isMobile && index !== undefined && index % 2 !== 0 ? 22 : 8;
  return (
    <text x={x} y={y} dy={dy} textAnchor="middle" fill="#9ca3af" fontSize={12}>
      {LEAGUE_BY_GP[payload.value] ?? payload.value}
    </text>
  );
}

export function LoungeMasters2ProgressionChart() {
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
            dataKey="gp"
            stroke="#9ca3af"
            height={40}
            interval={0}
            tick={<XAxisTick />}
          />
          <YAxis
            reversed
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={48}
            domain={[1, 32]}
            ticks={[1, 5, 10, 20, 30]}
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
            labelFormatter={(label: string) => LEAGUE_BY_GP[label] ?? label}
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
