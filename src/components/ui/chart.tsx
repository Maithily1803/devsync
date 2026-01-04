"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------------------------------
 * Chart Container
 * -------------------------------------------------------------------------------------------------*/

export function ChartContainer({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-background p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Tooltip Types (STABLE, EXPLICIT)
 * -------------------------------------------------------------------------------------------------*/

type TooltipPayloadItem = {
  name?: string
  value?: number | string
  color?: string
  payload?: Record<string, any>
}

type ChartTooltipContentProps = {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  className?: string
  indicator?: "line" | "dot" | "dashed"
  hideLabel?: boolean
  hideIndicator?: boolean
  labelClassName?: string
  formatter?: (value: any, name: any) => React.ReactNode
  color?: string
  nameKey?: string
  labelKey?: string
}

/* -------------------------------------------------------------------------------------------------
 * Tooltip Content
 * -------------------------------------------------------------------------------------------------*/

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const tooltipLabel =
    labelKey && payload[0]?.payload
      ? payload[0].payload[labelKey]
      : label

  return (
    <div
      className={cn(
        "rounded-lg border bg-background px-3 py-2 text-xs shadow-md",
        className
      )}
    >
      {!hideLabel && tooltipLabel && (
        <div className={cn("mb-1 font-medium", labelClassName)}>
          {tooltipLabel}
        </div>
      )}

      <div className="space-y-1">
        {payload.map((item, index) => {
          const value = formatter
            ? formatter(item.value, item.name)
            : item.value

          const name =
            nameKey && item.payload
              ? item.payload[nameKey]
              : item.name

          return (
            <div
              key={index}
              className="flex items-center gap-2 text-muted-foreground"
            >
              {!hideIndicator && (
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    indicator === "line" && "h-0.5 w-3 rounded-none",
                    indicator === "dashed" &&
                      "h-0.5 w-3 rounded-none border-t border-dashed"
                  )}
                  style={{
                    backgroundColor:
                      indicator === "dot" ? item.color || color : undefined,
                    borderColor:
                      indicator !== "dot" ? item.color || color : undefined,
                  }}
                />
              )}

              <span className="flex-1 truncate">{name}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Tooltip Wrapper
 * -------------------------------------------------------------------------------------------------*/

export function ChartTooltip(
  props: React.ComponentProps<typeof Tooltip>
) {
  return (
    <Tooltip
      cursor={{ fill: "transparent" }}
      content={<ChartTooltipContent />}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------------------------------
 * Re-exports
 * -------------------------------------------------------------------------------------------------*/

export {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
}
