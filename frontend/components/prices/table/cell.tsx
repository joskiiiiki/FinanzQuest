import type React from "react"
import { WinLossIndicator } from "@/components/stat/indicator"
import { TableCell } from "@/components/ui/table"
import { formatFloatingPointString } from "@/lib/data/formatter"
import get_sign from "@/lib/data/get_sign"
import { cn } from "@/lib/utils"
import type { PriceColumnOptions } from "./table"

export type CellValueTypes = "int" | "float" | "string"

interface PriceCellProps extends React.ComponentPropsWithoutRef<"div"> {
	value: React.ReactNode
	columnIndex: number
	options: PriceColumnOptions
}

export default function PriceCell({
	columnIndex,
	value,
	className,
	options,
}: PriceCellProps) {
	const isNumber = options.type === "int" || options.type === "float"
	if (!value) {
		return <TableCell />
	}
	if (options.indicator && isNumber) {
		return (
			<TableCell
				className={cn(
					"py-2 px-2 w-full flex flex-row justify-between number",
					columnIndex % 2 === 0 && "bg-muted/30",
					columnIndex > 0 && "border-l",
					isNumber && "text-right",
					className
				)}
			>
				<WinLossIndicator sign={value as number} />
				<span>
					{get_sign(value as number)}
					{options.type === "float"
						? formatFloatingPointString(Math.abs(value as number), 2)
						: value}
				</span>
			</TableCell>
		)
	}

	return (
		<TableCell
			className={cn(
				"py-2 px-2 w-fit hyphens-none text-nowrap number",
				columnIndex % 2 === 0 && "bg-muted/30",
				columnIndex > 0 && "border-l",
				isNumber && "text-right",
				className
			)}
		>
			{options.type === "float"
				? formatFloatingPointString(value as number, 2)
				: value}
		</TableCell>
	)
}
