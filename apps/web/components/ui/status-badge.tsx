import * as React from 'react';
import { cn } from '@/lib/utils';

export type MatchStatus =
  | 'ONGOING'
  | 'COMPLETED'
  | 'RESULTS_PENDING'
  | 'PROVISIONALLY_CONFIRMED'
  | 'ABORTED';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  showLabel?: boolean;
}

const statusConfig: Record<string, {
  label: string;
  className: string;
}> = {
  ONGOING: {
    label: '進行中',
    className: 'bg-green-500/20 text-green-300 border-green-500/50',
  },
  COMPLETED: {
    label: '完了',
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  },
  RESULTS_PENDING: {
    label: '結果待ち',
    className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
  },
  PROVISIONALLY_CONFIRMED: {
    label: '暫定確定',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  },
  ABORTED: {
    label: '中止',
    className: 'bg-red-500/20 text-red-300 border-red-500/50',
  },
};

const defaultStatusConfig = {
  label: 'Unknown',
  className: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
};

export function StatusBadge({
  status,
  className,
  showLabel = false,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status] || defaultStatusConfig;

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)} {...props}>
      {showLabel && (
        <p className="text-sm text-gray-400">Status</p>
      )}
      <span
        className={cn(
          'inline-block px-3 py-1 rounded-full text-sm font-semibold border',
          config.className
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

// Export helper functions for external use if needed
export function getStatusLabel(status: string): string {
  return statusConfig[status]?.label || status;
}

export function getStatusClassName(status: string): string {
  return statusConfig[status]?.className || defaultStatusConfig.className;
}