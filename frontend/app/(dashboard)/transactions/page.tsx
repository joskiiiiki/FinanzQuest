import { MoveRight } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ErrorCard } from "@/components/cards/cards"
import { PositionRow } from "@/components/displays/position_list"
import URLIcon from "@/components/icon"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card"
import type {
	PositionSummary,
	SearchParams,
	Transaction,
} from "@/database/custom_types"
import { getDepotIdWithInspect } from "@/lib/get_depot_id"
import { getStockPagePath } from "@/lib/get_stock_path"
import { getIconURL } from "@/lib/icon_url"
import {
	parseDate,
	relativeDateString,
	toAbsoluteTimeString,
	toISODateOnly,
} from "@/lib/util"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/server"

type TransactionWithAssetPosition = Transaction & PositionSummary

export default async function Page(props: {
	searchParams: Promise<SearchParams>
}) {
	const searchParams = await props.searchParams
	const { depotId, error: depotIdError } =
		await getDepotIdWithInspect(searchParams)
	if (depotIdError) {
		return <ErrorCard error={depotIdError} />
	}
	const { depot, transactions, error } = await dataFetcher(depotId)

	if (error || !depot || !transactions) {
		return <ErrorCard error={error || new Error("Error fetching Data")} />
	}

	const groupedTransactions = groupTransactionsPerDay(transactions)

	return (
		<main className="w-full">
			<div className="flex flex-col gap-10 max-w-[1000px] mx-auto p-10 pb-0 overflow-y-scroll">
				{groupedTransactions.map(group => (
					<TransactionGroup key={group.day} {...group} />
				))}
			</div>
		</main>
	)
}

type GroupedTransactions<T extends object> = {
	day: string
	transactions: (Transaction & T)[]
}

function groupTransactionsPerDay<T extends object>(
	transactions: (Transaction & T)[]
) {
	// Assumes transactions are sorted by timestamp in descending order
	const groupedTransactions: GroupedTransactions<T>[] = []
	let currentDay = ""
	let currentDayTransactions: (Transaction & T)[] = []

	for (const transaction of transactions) {
		const date = new Date(transaction.tstamp)
		const key = toISODateOnly(date)

		if (currentDay !== key) {
			if (currentDayTransactions.length > 0) {
				groupedTransactions.push({
					day: currentDay,
					transactions: currentDayTransactions,
				})
			}
			currentDay = key
			currentDayTransactions = []
		}

		currentDayTransactions.push(transaction)
	}

	if (currentDayTransactions.length > 0) {
		groupedTransactions.push({
			day: currentDay,
			transactions: currentDayTransactions,
		})
	}

	return groupedTransactions
}

function TransactionGroup({
	day,
	transactions,
}: GroupedTransactions<PositionSummary>) {
	const date = parseDate(day)
	return (
		<div className="overflow-hidden flex flex-col gap-3">
			<div className="flex flex-row gap-2">
				<span className="font-semibold">
					{date ? toAbsoluteTimeString(date) : ""}
				</span>
				<span className="text-sm text-muted-foreground align-bottom">
					{date ? relativeDateString(date, "never") : "No Date"}
				</span>
			</div>
			<div className="flex flex-col border rounded-xl overflow-hidden bg-muted/50 shadow">
				{transactions.map(transaction => (
					<TransactionItem key={transaction.id} transaction={transaction} />
				))}
			</div>
		</div>
	)
}

function Description({
	transaction,
}: {
	transaction: TransactionWithAssetPosition
}) {
	const buy = transaction.amount > 0
	const worth =
		Math.abs(transaction.amount * transaction.price) +
		transaction.commission * (buy ? 1 : -1)
	const iconURL =
		transaction.symbol && transaction.asset_type
			? getIconURL(transaction.symbol, transaction.asset_type, 32)
			: null

	return (
		<div className={cn(buy ? "flex-row" : "flex-row-reverse", "flex gap-3")}>
			<HoverCard openDelay={100}>
				<HoverCardTrigger asChild>
					<span className="font-mono bg-background border border-border/70 px-2 rounded-lg cursor-pointer">
						${Math.abs(worth).toFixed(2)}
					</span>
				</HoverCardTrigger>
				<HoverCardContent className="w-fit rounded-lg overflow-hidden">
					<div className="flex flex-row gap-2">
						<span className="font-mono">
							${Math.abs(transaction.amount * transaction.price).toFixed(2)}
						</span>
						<span>{buy ? "+" : "-"}</span>
						<span className="font-mono">
							${Math.abs(transaction.commission).toFixed(2)}
						</span>
						<span className="text-muted-foreground">(Gebühren)</span>
					</div>
				</HoverCardContent>
			</HoverCard>
			<MoveRight className="stroke-muted-foreground" />
			<HoverCard>
				<HoverCardTrigger asChild>
					<Link
						href={getStockPagePath(transaction.asset_id)}
						className="cursor-pointer flex flex-row gap-2 bg-background border border-border/70 rounded-lg px-2"
					>
						<URLIcon
							className="h-[0.8lh] aspect-square w-auto self-center rounded"
							size={32}
							iconURL={iconURL}
						/>
						{transaction.symbol}
						<span className="font-mono text-muted-foreground">
							x{Math.abs(transaction.amount).toFixed(2)}
						</span>
					</Link>
				</HoverCardTrigger>
				<HoverCardContent className="p-0 rounded-lg overflow-hidden w-min max-w-[400px]">
					<PositionRow
						className="m-0 !rounded-none border-none w-300px *:!rounded-none"
						position={transaction}
					></PositionRow>
				</HoverCardContent>
			</HoverCard>
		</div>
	)
}

function TransactionItem({
	transaction,
}: {
	transaction: TransactionWithAssetPosition
}) {
	const buy = transaction.amount > 0
	const is_savings_plan = transaction.type == "savings_plan"

	const bg = (() => {
		if (is_savings_plan)
			return "bg-blue-500"

		return buy ? "bg-loss" : "bg-win"
	})(
	)

	const date = new Date(transaction.tstamp)

	return (
		<div
			className={cn(
				"pr-7 pl-3 py-4 flex flex-row gap-3 shadow even:bg-muted/50 even:shadow border-b last:border-none"
			)}
		>
			<span
				className={cn(bg, "inline-block w-1 flex-shrink-0 h-[1lh] rounded-xl")}
			/>
			<span className="font-semibold text-md">
				<Description transaction={transaction} />
			</span>

			{
				is_savings_plan && <span className="ml-2 text-muted-foreground text-sm self-center">
					Sparplan
				</span>
			}
			<span className="flex-grow" />

			<span className="text-muted-foreground text-sm self-center">
				{date.toLocaleTimeString("de-DE")}
			</span>
		</div>
	)
}

const dataFetcher = async (depotId?: number) => {
	const client = await createClient()
	const user = (await client.auth.getUser()).data.user

	if (!user) {
		redirect("/login")
	}

	const { data: depots, error: depotsError } = await client
		.schema("depots")
		.from("depots")
		.select("*")
		.contains("users", [user.id])

	const depot = depots?.find(depot => depot.id === depotId) || depots?.at(0)
	if (depotsError) {
		return {
			error: depotsError,
		}
	}
	if (!depot) {
		return {
			error: new Error("No depot found"),
		}
	}
	const { data: transactions, error: transactionsError } = await client
		.schema("depots")
		.from("transactions_with_asset_position")
		.select(`*`)
		.eq("depot_id", depot.id)
		.order("tstamp", { ascending: false })

	if (transactionsError) {
		return {
			error: transactionsError,
		}
	}

	return {
		depot,
		transactions: transactions as TransactionWithAssetPosition[],
	}
}
