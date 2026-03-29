import { cn } from '@/lib/utils'

interface LoadingStateProps {
  rows?: number
  className?: string
}

export default function LoadingState({ rows = 5, className }: LoadingStateProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
      ))}
    </div>
  )
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
