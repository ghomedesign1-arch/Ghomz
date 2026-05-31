"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatLE } from "@/lib/costing";

interface ForecastChartProps {
  data: {
    label: string;
    actual?: number;
    forecast?: number;
  }[];
  lastActualLabel?: string;
}

export function ForecastChart({ data, lastActualLabel }: ForecastChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v: number) => formatLE(v)}
        />
        <Legend
          iconType="plainline"
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
        {lastActualLabel && (
          <ReferenceLine
            x={lastActualLabel}
            stroke="hsl(var(--border))"
            strokeDasharray="4 4"
            label={{
              value: "Today",
              position: "top",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
