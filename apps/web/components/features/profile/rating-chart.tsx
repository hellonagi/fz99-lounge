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
  category: 'GP' | 'CLASSIC' | 'TEAM_CLASSIC' | 'TEAM_GP';
  seasonNumber?: number;
}

interface ChartDataPoint {
  matchNumber: number;
  displayRating: number;
  position?: number;
  totalParticipants?: number;
  date: string;
}

export function RatingChart({ userId, category, seasonNumber }: RatingChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGpMode = category === 'GP' || category === 'TEAM_GP';

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await usersApi.getRatingHistory(userId, category, seasonNumber);
        const history: UserRatingHistoryEntry[] = response.data;

        const chartData = history.map((entry) => ({
          matchNumber: entry.matchNumber,
          displayRating: entry.displayRating,
          position: entry.position,
          totalParticipants: entry.totalParticipants,
          date: new Date(entry.createdAt).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
          }),
        }));

        setData(chartData);
        setError(null);
      } catch {
        setError(isGpMode ? 'Failed to load position history' : 'Failed to load rating history');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, category, seasonNumber, isGpMode]);

  const title = isGpMode ? 'Position History' : 'Rating History';

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
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
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            No {isGpMode ? 'position' : 'rating'} history yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // GP/TEAM_GP: Position chart (inverted Y-axis, 1st at top)
  if (isGpMode) {
    const positions = data.map((d) => d.position).filter((p): p is number => p != null);
    if (positions.length === 0) {
      return (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-gray-500">
              No position history yet
            </div>
          </CardContent>
        </Card>
      );
    }

    const maxPosition = Math.max(...positions);
    const yMax = Math.max(maxPosition + 1, 4); // At least show up to 4th

    // Calculate average position
    const avgPosition = (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1);

    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {title}
            <span className="text-sm font-normal text-gray-400 ml-auto">
              Avg: <span className="font-bold text-white">{avgPosition}</span>
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
                domain={[1, yMax]}
                reversed
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number, _name: string, props: { payload: ChartDataPoint }) => {
                  const tp = props.payload.totalParticipants;
                  return [`#${value}${tp ? ` / ${tp}` : ''}`, 'Position'];
                }}
                labelFormatter={(label) => label}
              />
              {/* Reference line for 1st place */}
              <ReferenceLine
                y={1}
                stroke="#facc15"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="position"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ fill: '#60a5fa', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#60a5fa', strokeWidth: 2, stroke: '#fff', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // CLASSIC/TEAM_CLASSIC: Rating chart (original behavior)
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
      <CardHeader>
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
