import * as React from 'react';
import { cn } from '@/lib/utils';

const MatchCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl border border-gray-700/50 bg-gray-800/40 shadow-xl overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Background Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-pink-900/10 pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  )
);
MatchCard.displayName = 'MatchCard';

const MatchCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
MatchCardHeader.displayName = 'MatchCardHeader';

const MatchCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-2xl font-bold text-white', className)}
    {...props}
  />
));
MatchCardTitle.displayName = 'MatchCardTitle';

const MatchCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
MatchCardContent.displayName = 'MatchCardContent';

export { MatchCard, MatchCardHeader, MatchCardTitle, MatchCardContent };
