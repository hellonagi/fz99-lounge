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

const DATA = [
  { gp: 'GP1',  Misa:  906, oliver:  792, nag:  908, MrAngelo:  530, Kalt:  402 },
  { gp: 'GP2',  Misa: 1806, oliver: 1616, nag: 1756, MrAngelo: 1338, Kalt: 1306 },
  { gp: 'GP4',  Misa: 2564, oliver: 2460, nag: 2630, MrAngelo: 2274, Kalt: 2248 },
  { gp: 'GP5',  Misa: 3470, oliver: 3278, nag: 3592, MrAngelo: 3212, Kalt: 2936 },
  { gp: 'GP6',  Misa: 4404, oliver: 4174, nag: 4044, MrAngelo: 3958, Kalt: 3478 },
  { gp: 'GP7',  Misa: 5322, oliver: 5058, nag: 4762, MrAngelo: 4638, Kalt: 4298 },
  { gp: 'GP8',  Misa: 6170, oliver: 6014, nag: 5576, MrAngelo: 5550, Kalt: 5196 },
  { gp: 'GP3',  Misa: 6628, oliver: 6376, nag: 6458, MrAngelo: 6478, Kalt: 5824 },
];

// Ordered by final finishing position (1st, 2nd, 3rd, ...) so Legend matches the standings.
const PLAYERS = [
  { key: 'Misa',     name: 'Misa',       color: '#facc15', strokeWidth: 3 },
  { key: 'MrAngelo', name: 'Mr. Angelo', color: '#f472b6', strokeWidth: 2 },
  { key: 'nag',      name: 'nag',        color: '#4ade80', strokeWidth: 2 },
  { key: 'oliver',   name: 'oliver',     color: '#60a5fa', strokeWidth: 2 },
  { key: 'Kalt',     name: 'Kalt',       color: '#a78bfa', strokeWidth: 2 },
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

export function LoungeMasters1ProgressionChart() {
  const t = useTranslations('news.charts');
  return (
    <div className="not-prose my-6 rounded-lg border border-gray-700 bg-gray-900/50 p-3 sm:p-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-200 sm:text-base">
        {t('progressionTitle')}
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
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            width={48}
            domain={[0, 7000]}
            ticks={[0, 2000, 4000, 6000]}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => value.toLocaleString()}
            labelFormatter={(label: string) => LEAGUE_BY_GP[label] ?? label}
            itemSorter={(item) => PLAYERS.findIndex((p) => p.name === item.name)}
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
