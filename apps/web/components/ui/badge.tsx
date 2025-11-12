import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-gray-700 text-gray-100 hover:bg-gray-600',
        secondary: 'border-transparent bg-gray-800 text-gray-300 hover:bg-gray-700',
        destructive: 'border-transparent bg-red-900 text-red-200',
        outline: 'text-gray-300 border-gray-600',
        success: 'border-transparent bg-green-900 text-green-200',
        live: 'border-transparent bg-red-900 text-red-200 animate-pulse',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
