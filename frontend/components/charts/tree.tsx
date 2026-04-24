"use client"
import type React from "react"
import { type Tooltip, Treemap } from "recharts"
import type { TreemapNode } from "recharts/types/util/types"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import type { PositionSummary } from "@/database/custom_types"
import { currencyFormat, to_display_string } from "@/lib/cash_display_string"
import { toAbsoluteTimeString } from "@/lib/util"
import { cn } from "@/lib/utils"
import { Separator } from "../ui/separator"

interface props<T extends Record<string, number | string | null>>
	extends React.ComponentPropsWithoutRef<"div"> {
	data: Array<T>
	dataKey: Extract<keyof T, string>
}

interface ContentProps extends TreemapNode {
	data: Record<string, number | string | null>[]
	key: string
}

function calculateOpacity(profit: number) {
	const x = Math.abs(profit)
	return Math.min(0.7, 10 * x) // clamp so it remains readable
}

function CustomContent(props: ContentProps) {
	const { depth, x, y, width, height, index, data, name, value } = props
	const position = data.at(index) as PositionSummary
	let prof = 0
	let color = ""

	if (position !== undefined && position !== null) {
		prof = (position.total_profit as number) / (position.market_value as number)
		color = prof > 0 ? "oklch(var(--win))" : "oklch(var(--loss))"
	}

	const opacity = depth > 0 ? calculateOpacity(prof) : 0
	const mix_factor = 0.4
	return (
		<g>
			<rect x={x} y={y} width={width} height={height} fill="#00000000" />
			<rect
				x={x}
				y={y}
				rx={10}
				width={width - 10}
				height={height - 10}
				style={{
					fill: color,
					stroke: color,
					fillOpacity: opacity,
					borderRadius: 10,
					strokeWidth: 1,
					strokeOpacity: depth > 0 ? 1 : 0,
				}}
			/>
			{depth === 1 ? (
				<text
					x={x + width / 2}
					y={y + height / 2 + 7}
					fill={`color-mix(in oklch, ${color} ${mix_factor * 100}%, hsl(var(--foreground)) ${100 - mix_factor * 100}%)`}
					className="text-ellipsis"
					textAnchor="middle"
					fontSize={14}
				>
					{name}
				</text>
			) : null}
			{depth === 1 ? (
				<text
					x={x + 6}
					y={y + 20}
					fill={`color-mix(in oklch, ${color} ${mix_factor * 100}%, hsl(var(--foreground)) ${100 - mix_factor * 100}%)`}
					fontSize={16}
					fillOpacity={0.9}
				>
					{currencyFormat.format(value as number)}
				</text>
			) : null}
		</g>
	)
}

export default function TreeChart<
	T extends Record<string, number | string | null>,
>({ data, dataKey, className }: props<T>) {
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
			config={chartConfig}
			className={cn("min-h[200px] pl-3 pt-0.5", className)}
		>
			<Treemap
				isAnimationActive={false}
				data={data}
				dataKey={dataKey}
				content={
					<CustomContent
						data={data}
						key="total_profit"
						x={0}
						y={0}
						width={0}
						height={0}
						depth={0}
						index={0}
						name={""}
						value={0}
					/>
				}
			/>
		</ChartContainer>
	)
}

type CustomTooltipProps = React.ComponentProps<typeof Tooltip>

const _CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
	if (!active || !payload || !payload.length) {
		return null
	}

	const value = Number.parseFloat(payload[0].value?.toString() ?? "")
	const valueType = payload[0].payload?.type ?? ""

	const displayString = Number.isNaN(value)
		? "No value"
		: to_display_string(value as number)
	const date = new Date(label)

	return (
		<div className="bg-background p-2 text-sm rounded shadow border">
			<h1 className="">
				<span className="font-semibold">{toAbsoluteTimeString(date)}</span>
			</h1>
			<Separator orientation="horizontal" className="my-2 col-span-2" />
			<p className="label inline-flex flex-row gap-2">
				<span className="number">{displayString}</span>
				<span className="">{valueType}</span>
			</p>
		</div>
	)
}
