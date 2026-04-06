'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface BrandDataPoint {
  brand: string
  revenue: number
  pct: number
}

const BRAND_HEX: Record<string, string> = {
  DD:   '#3b82f6',
  FIOR: '#16a34a',
  Juji: '#f97316',
  KHH:  '#a855f7',
  NE:   '#ef4444',
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as BrandDataPoint
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-sm">{label}</p>
      <p>{formatCurrency(d.revenue)}</p>
      <p className="text-muted-foreground">{d.pct.toFixed(1)}% of total</p>
    </div>
  )
}

interface Props {
  data: BrandDataPoint[]
}

export default function BrandRevenueChart({ data }: Props) {
  if (!data.length) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Revenue by Brand — This Month</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
          No data yet
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Revenue by Brand — This Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="brand"
              tick={{ fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => v >= 1000 ? `RM${(v / 1000).toFixed(0)}k` : `RM${v}`}
              width={52}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map((entry) => (
                <Cell
                  key={entry.brand}
                  fill={BRAND_HEX[entry.brand] ?? '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend with RM values */}
        <div className="mt-3 flex flex-wrap gap-3 justify-center">
          {data.map((d) => (
            <div key={d.brand} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: BRAND_HEX[d.brand] ?? '#94a3b8' }}
              />
              <span className="font-medium">{d.brand}</span>
              <span className="text-muted-foreground">{formatCurrency(d.revenue)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
