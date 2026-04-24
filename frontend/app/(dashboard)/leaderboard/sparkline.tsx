"use client"

import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { BaseNextRequest } from "next/dist/server/base-http"
import { useId } from "react"
import { Area, AreaChart, ReferenceLine, YAxis } from "recharts"

export function Sparkline({
	data,
	startValue,
	className,
}: {
	data: (number | null)[]
	startValue: number
	className?: string
}) {
	const id = useId()
	const chartData = [...data].reverse().map(value => ({ value }))
	const nonNullData = data.filter(
		value => value !== null && value !== undefined
	) as number[]
	if (nonNullData.length <= 1) return null
	const min = Math.min(...nonNullData)
	const max = Math.max(...nonNullData)
	const offset = max === min ? 0 : (max - startValue) / (max - min)
	const padding = (max - min) * 0.1 || startValue * 0.01
	return (
		<div className="w-full p-2">
			<div
				className={cn(
					"relative h-12 w-full rounded-lg overflow-hidden border bg-background",
					className
				)}
			>
				<ChartContainer className="h-full w-full" style={{}} config={{}}>
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0"
									stopColor="oklch(var(--win))"
									stopOpacity={0.7}
								/>
								<stop
									offset={`${offset * 100}%`}
									stopColor="oklch(var(--win))"
									stopOpacity={0.1}
								/>
								<stop
									offset={`${offset * 100}%`}
									stopColor="oklch(var(--loss))"
									stopOpacity={0.1}
								/>
								<stop
									offset="100%"
									stopColor="oklch(var(--loss))"
									stopOpacity={0.7}
								/>
							</linearGradient>
							<linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="oklch(var(--win))" stopOpacity={1} />
								<stop
									offset={`${offset * 100}%`}
									stopColor="oklch(var(--win))"
									stopOpacity={1}
								/>
								<stop
									offset={`${offset * 100}%`}
									stopColor="oklch(var(--loss))"
									stopOpacity={1}
								/>
								<stop
									offset="100%"
									stopColor="oklch(var(--loss))"
									stopOpacity={1}
								/>
							</linearGradient>
						</defs>
						<ReferenceLine y={startValue} className="stroke-border" />
						<YAxis
							hide
							dataKey="value"
							domain={[min - padding, max + padding]}
						/>
						<Area
							isAnimationActive={false}
							type="linear"
							dataKey="value"
							dot={false}
							strokeWidth={1.5}
							stroke={`url(#stroke-${id})`}
							fill={`url(#fill-${id})`}
							baseValue={startValue}
						/>
					</AreaChart>
				</ChartContainer>
			</div>
		</div>
	)
}
