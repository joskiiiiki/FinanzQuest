"use client"
import type React from "react"
import {
	Bar,
	Cell,
	ComposedChart,
	ErrorBar,
	Line,
	type Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
} from "@/components/ui/chart"
import { formatFloatingPointString } from "@/lib/data/formatter"
import { numberFormat, toAbsoluteTimeString } from "@/lib/util"
import { cn } from "@/lib/utils"
import {
	type TtoRelativeValues,
	toAbsoluteValues,
} from "../../lib/data/data_utils"
import { WinLossIndicator } from "../stat/indicator"
import { Separator } from "../ui/separator"

type BarDataT = Record<
	string,
	[number, number] | string | boolean | number | null
>

interface props<T extends BarDataT>
	extends React.ComponentPropsWithoutRef<"div"> {
	data: Array<T>
	barKey: Extract<keyof T, string>
	errorKey: Extract<keyof T, string>
	winKey: Extract<keyof T, string>
	xKey: Extract<keyof T, string>
	lineKey: Extract<keyof T, string>
	tickInterval?: number
}
export default function CandleStickChart<T extends BarDataT>({
	data,
	className,
	xKey,
	barKey,
	errorKey,
	winKey,
	lineKey,
	tickInterval,
}: props<T>) {
	const chartData = data //data
	const chartConfig = {
		open: {
			label: "Open",
		},
		close: {
			label: "Open",
		},
	} satisfies ChartConfig

	return (
		<ChartContainer
			className={cn("min-h[200px]", className)}
			config={chartConfig}
		>
			<ComposedChart accessibilityLayer data={chartData}>
				<XAxis
					className="number"
					dataKey={xKey}
					interval={tickInterval || "preserveEnd"}
				/>
				<YAxis hide domain={["min", "max"]} />
				<Bar maxBarSize={20} dataKey={barKey} fill="oklch(var(--win))">
					{chartData.map(entry => {
						const win = entry[winKey]
						return (
							<Cell
								className="z-10"
								key={entry[xKey] as string}
								radius={4}
								fillOpacity={0.6}
								stroke={win ? "oklch(var(--win))" : "oklch(var(--loss))"}
								fill={win ? "oklch(var(--win))" : "oklch(var(--loss))"}
							/>
						)
					})}
					<ErrorBar
						className="-z-10"
						dataKey={errorKey}
						width={0}
						strokeWidth={1}
						stroke="hsl(var(--foreground)/.7)"
					></ErrorBar>
				</Bar>
				<Line
					dot={false}
					dataKey={lineKey}
					strokeWidth={1}
					type="linear"
					stroke="hsl(var(--muted-foreground))"
					connectNulls
					strokeOpacity={0.5}
				/>
				<ChartTooltip filterNull content={<CustomTooltip />} />
			</ComposedChart>
		</ChartContainer>
	)
}

type CustomToolTipProps = React.ComponentProps<typeof Tooltip>

const CustomTooltip = ({ active, payload, label }: CustomToolTipProps) => {
	if (!active || !payload || !payload.length) {
		return null
	}

	const dataPayload = payload[0].payload as TtoRelativeValues | null

	if (!dataPayload) {
		return null
	}
	const row = toAbsoluteValues(dataPayload)
	const displayValues = [
		{ name: "Open", string: numberFormat.format(row.open) },
		{ name: "Close", string: numberFormat.format(row.close) },
		{ name: "High", string: numberFormat.format(row.high) },
		{ name: "Low", string: numberFormat.format(row.low) },
	]
	const profit = row.close - row.open
	const date = new Date(label)
	return (
		<div className="bg-background p-2 rounded shadow border">
			<h1 className="font-semibold text-sm">{toAbsoluteTimeString(date)}</h1>
			<Separator orientation="horizontal" className="my-2" />
			<div className="grid grid-cols-2 gap-2">
				{displayValues.map(value => (
					<>
						<span key={value.name} className="font-semibold">
							{value.name}
						</span>
						<span key={`${value.name}-${value}`} className="text-right number">
							{value.string}
						</span>
					</>
				))}
			</div>
			<Separator orientation="horizontal" className="my-2" />
			<span className="inline-flex flex-row gap-2">
				<span className="font-semibold">Profit:</span>
				<WinLossIndicator sign={Math.sign(row.close - row.open)} />
				<span className="label numeric">
					{row.closeLargerOpen ? "+" : "-"}
					{formatFloatingPointString(Math.abs(profit), 2)}
				</span>
			</span>
		</div>
	)
}
