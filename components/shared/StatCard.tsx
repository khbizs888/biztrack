import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  isCurrency?: boolean
  trend?: number
  className?: string
}

export default function StatCard({ title, value, icon: Icon, description, isCurrency, trend, className }: StatCardProps) {
  const displayValue = isCurrency && typeof value === 'number' ? formatCurrency(value) : value

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend !== undefined && (
          <p className={cn('text-xs mt-1', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}
