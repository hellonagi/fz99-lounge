// Rank thresholds from rules page
// Bronze/Silver: 200 per tier, others: 100 per tier
const tiers = ['V', 'IV', 'III', 'II', 'I'] as const;

export interface RankInfo {
  name: string;
  color: string;
  tier: string;
  division: typeof tiers[number];
}

export function getRankInfo(rating: number): RankInfo {
  // Grandmaster: 4000+ (100 per tier)
  if (rating >= 4000) {
    const tierIndex = Math.min(Math.floor((rating - 4000) / 100), 4);
    return { name: `GM ${tiers[tierIndex]}`, color: 'bg-rose-500', tier: 'GM', division: tiers[tierIndex] };
  }
  // Master: 3500-3999 (100 per tier)
  if (rating >= 3500) {
    const tierIndex = Math.floor((rating - 3500) / 100);
    return { name: `Master ${tiers[tierIndex]}`, color: 'bg-emerald-500', tier: 'Master', division: tiers[tierIndex] };
  }
  // Diamond: 3000-3499 (100 per tier)
  if (rating >= 3000) {
    const tierIndex = Math.floor((rating - 3000) / 100);
    return { name: `Diamond ${tiers[tierIndex]}`, color: 'bg-violet-500', tier: 'Diamond', division: tiers[tierIndex] };
  }
  // Platinum: 2500-2999 (100 per tier)
  if (rating >= 2500) {
    const tierIndex = Math.floor((rating - 2500) / 100);
    return { name: `Plat ${tiers[tierIndex]}`, color: 'bg-cyan-400', tier: 'Plat', division: tiers[tierIndex] };
  }
  // Gold: 2000-2499 (100 per tier)
  if (rating >= 2000) {
    const tierIndex = Math.floor((rating - 2000) / 100);
    return { name: `Gold ${tiers[tierIndex]}`, color: 'bg-yellow-500', tier: 'Gold', division: tiers[tierIndex] };
  }
  // Silver: 1000-1999 (200 per tier)
  if (rating >= 1000) {
    const tierIndex = Math.floor((rating - 1000) / 200);
    return { name: `Silver ${tiers[tierIndex]}`, color: 'bg-slate-400', tier: 'Silver', division: tiers[tierIndex] };
  }
  // Bronze: 0-999 (200 per tier)
  const tierIndex = Math.floor(rating / 200);
  return { name: `Bronze ${tiers[tierIndex]}`, color: 'bg-amber-700', tier: 'Bronze', division: tiers[tierIndex] };
}

// Rank color for text (useful for charts, text coloring)
export function getRankTextColor(rating: number): string {
  if (rating >= 4000) return 'text-rose-500';
  if (rating >= 3500) return 'text-emerald-500';
  if (rating >= 3000) return 'text-violet-500';
  if (rating >= 2500) return 'text-cyan-400';
  if (rating >= 2000) return 'text-yellow-500';
  if (rating >= 1000) return 'text-slate-400';
  return 'text-amber-700';
}

// Rank thresholds for chart reference lines
export const RANK_THRESHOLDS = [
  { rating: 4000, name: 'Grandmaster', color: '#f43f5e' },
  { rating: 3500, name: 'Master', color: '#10b981' },
  { rating: 3000, name: 'Diamond', color: '#8b5cf6' },
  { rating: 2500, name: 'Platinum', color: '#22d3ee' },
  { rating: 2000, name: 'Gold', color: '#eab308' },
  { rating: 1000, name: 'Silver', color: '#94a3b8' },
  { rating: 0, name: 'Bronze', color: '#b45309' },
] as const;
