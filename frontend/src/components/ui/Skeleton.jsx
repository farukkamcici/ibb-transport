import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/10',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
  lastLineWidthClassName = 'w-2/3',
  ...props
}) {
  const safeLines = Math.max(1, Number(lines) || 1);

  return (
    <div
      className={cn('space-y-2', className)}
      aria-hidden="true"
      {...props}
    >
      {Array.from({ length: safeLines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            'h-3 w-full rounded',
            index === safeLines - 1 ? lastLineWidthClassName : 'w-full',
            lineClassName
          )}
        />
      ))}
    </div>
  );
}
