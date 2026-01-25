'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { usersApi } from '@/lib/api';
import { UserRatingHistoryEntry } from '@/types';
import { RANK_THRESHOLDS, getRankInfo } from '@/lib/rank-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RatingChartProps {
  userId: number;
  category: 'GP' | 'CLASSIC';
  seasonNumber?: number;
}

interface ChartDataPoint {
  matchNumber: number;
  displayRating: number;
  date: string;
}

export function RatingChart({ userId, category, seasonNumber }: RatingChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await usersApi.getRatingHistory(userId, category, seasonNumber);
        const history: UserRatingHistoryEntry[] = response.data;

        const chartData = history.map((entry) => ({
          matchNumber: entry.matchNumber,
          displayRating: entry.displayRating,
          date: new Date(entry.createdAt).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
          }),
        }));

        setData(chartData);
        setError(null);
      } catch {
        setError('Failed to load rating history');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, category, seasonNumber]);

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rating History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-400">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rating History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-red-400">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rating History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            No rating history yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate Y-axis domain
  const ratings = data.map((d) => d.displayRating);
  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);
  const padding = Math.max(100, (maxRating - minRating) * 0.1);
  const yMin = Math.max(0, Math.floor((minRating - padding) / 100) * 100);
  const yMax = Math.ceil((maxRating + padding) / 100) * 100;

  // Filter reference lines to visible range
  const visibleThresholds = RANK_THRESHOLDS.filter(
    (t) => t.rating >= yMin && t.rating <= yMax
  );

  // Get current rank color for line
  const currentRating = data[data.length - 1]?.displayRating || 0;
  const rankInfo = getRankInfo(currentRating);
  const lineColor = RANK_THRESHOLDS.find((t) => t.rating <= currentRating)?.color || '#60a5fa';

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          Rating History
          <span className="text-sm font-normal text-gray-400 ml-auto">
            Current: <span className="font-bold text-white">{currentRating}</span>{' '}
            <span className="text-gray-500">({rankInfo.name})</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250} minWidth={0}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value) => [value, 'Rating']}
              labelFormatter={(label) => label}
            />
            {visibleThresholds.map((threshold) => (
              <ReferenceLine
                key={threshold.rating}
                y={threshold.rating}
                stroke={threshold.color}
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
            ))}
            <Line
              type="monotone"
              dataKey="displayRating"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
              activeDot={{ fill: lineColor, strokeWidth: 2, stroke: '#fff', r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
