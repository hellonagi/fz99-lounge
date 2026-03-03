import { cn } from '@/lib/utils';

const CATEGORY_STYLES: Record<string, string> = {
  GP: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  CLASSIC: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  TEAM_CLASSIC: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
  TEAM_GP: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
  TOURNAMENT: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
};

const CATEGORY_LABELS: Record<string, string> = {
  GP: 'GP',
  CLASSIC: 'CLASSIC',
  TEAM_CLASSIC: 'TEAM CLASSIC',
  TEAM_GP: 'TEAM GP',
  TOURNAMENT: 'TOURNAMENT',
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const upper = category.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded text-xs font-medium border',
        CATEGORY_STYLES[upper] || 'bg-blue-500/20 text-blue-300 border-blue-500/50',
        className,
      )}
    >
      {CATEGORY_LABELS[upper] || upper}
    </span>
  );
}
