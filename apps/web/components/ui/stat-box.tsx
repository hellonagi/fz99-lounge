import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  colSpan?: 1 | 2;
}

const StatBox = React.forwardRef<HTMLDivElement, StatBoxProps>(
  ({ className, label, colSpan, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-gray-800/30 rounded-lg p-4 border border-gray-700/30',
        colSpan === 2 && 'md:col-span-2',
        className
      )}
      {...props}
    >
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  )
);
StatBox.displayName = 'StatBox';

const StatBoxValue = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xl font-bold text-white', className)}
    {...props}
  />
));
StatBoxValue.displayName = 'StatBoxValue';

export { StatBox, StatBoxValue };
