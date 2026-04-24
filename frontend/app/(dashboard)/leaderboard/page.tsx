import { redirect } from "next/navigation"
import { ErrorCard } from "@/components/cards/cards"
import type { LeaderboardRow, SearchParams } from "@/database/custom_types"
import { getDepotIdWithInspect } from "@/lib/get_depot_id"
import { createClient } from "@/utils/supabase/server"
import { cn } from "@/lib/utils"
import {
	currencyFormat,
	currencyFormatFixedLength,
} from "@/lib/cash_display_string"
import { Minus, TriangleIcon } from "lucide-react"
import { Sparkline } from "./sparkline"

export default async function Page(props: {
	searchParams: Promise<SearchParams>
}) {
	const searchParams = await props.searchParams
	const { depotId, error: depotIdError } =
		await getDepotIdWithInspect(searchParams)
	if (depotIdError) {
		return <ErrorCard error={depotIdError} />
	}

	const { leaderboard, depot } = await dataFetcher(depotId)

	if (leaderboard.error || !leaderboard.data) {
		return (
			<ErrorCard
				error={leaderboard.error || new Error("Error fetching Data")}
			/>
		)
	}

	const rankChange =
		depot.data?.rank && depot.data?.prev_rank
			? depot.data?.prev_rank - depot.data?.rank
			: null

	const isRising = rankChange !== null && rankChange > 0

	const rankIndicator = (() => {
		if (rankChange === null || rankChange === 0)
			return (
				<span className="text-muted-foreground font-mono font-bold">—</span>
			)

		return (
			<div className="flex flex-row items-baseline gap-1">
				<TriangleIcon
					className={cn(
						"size-4 fill-current self-center",
						isRising ? "text-win" : "text-loss rotate-180"
					)}
				/>
				<div className={cn("font-semibold text-2xl tabular-nums")}>
					{rankChange !== null && Math.abs(rankChange)}
				</div>
			</div>
		)
	})()

	return (
		<main className="w-full h-full flex flex-col gap-6 items-start">
			<div className="*:border items-stretch *:rounded-lg *:bg-muted/50 *:shadow *:px-6 *:py-5 flex flex-row gap-3 r">
				<div className="flex flex-col gap-1">
					<div className="text-muted-foreground">Deine Position</div>
					<div className="text-3xl font-semibold number">
						#{depot.data?.rank}
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground">Veränderung</span>
					{rankIndicator}
				</div>
				{depot.data?.value && (
					<div className="flex flex-col gap-1">
						<div className="text-muted-foreground">Depotwert</div>
						<div className="text-3xl font-semibold number">
							{currencyFormat.format(depot.data?.value)}
						</div>
					</div>
				)}
			</div>
			<div className="grid grid-cols-[auto_auto_1fr_1fr_minmax(200px, max)] w-full border rounded-xl overflow-hidden shadow gap-x-4">
				{leaderboard.data.map(row => (
					<LeaderboardEntry key={row.id} row={row} />
				))}
			</div>
		</main>
	)
}

function LeaderboardEntry({ row }: { row: LeaderboardRow }) {
	const rankChange = row.prev_rank && row.rank ? row.prev_rank - row.rank : null
	const isRising = rankChange != null && rankChange > 0

	const rankIndicator = (() => {
		if (row.prev_rank == null)
			return <div className="size-2 rounded-full self-center bg-blue-500" />
		if (rankChange === 0)
			return <Minus className="size-3 text-muted-foreground self-center" />

		return (
			<TriangleIcon
				className={cn(
					"size-2 fill-current self-center",
					isRising ? "text-win" : "text-loss rotate-180"
				)}
			/>
		)
	})()
	const userNames = row.users?.map((user, index) => {
		const isLast = row.users && index === row.users.length - 1
		return (
			<span key={user.user_id}>
				{user.name}
				{!isLast && ", "}
			</span>
		)
	})

	return (
		<div
			className={cn(
				"grid grid-cols-subgrid col-span-5 w-0 items-baseline pl-4 even:bg-muted/50"
			)}
		>
			<div className="grid grid-cols-subgrid py-4 col-span-4 self-center">
				<div className="flex flex-row items-baseline gap-2">
					{rankIndicator}
					<span className="text-md text-muted-foreground font-mono">
						#{row.rank}
					</span>
				</div>
				<div>Depot {row.id}</div>
				<div>{userNames}</div>
				<div className="font-mono text-right tabular-nums">
					{row.value && currencyFormatFixedLength.format(row.value)}
				</div>{" "}
			</div>
			{row.sparkline && (
				<Sparkline
					className="self-center "
					data={row.sparkline}
					startValue={row.cash_start as number}
				/>
			)}
		</div>
	)
}

const dataFetcher = async (depotId: number) => {
	const client = await createClient()
	const user = (await client.auth.getUser()).data.user

	if (!user) {
		redirect("/login")
	}

	const [depot_entry, leaderboard_response] = await Promise.all([
		client
			.schema("depots")
			.from("leaderboard")
			.select("*")
			.eq("id", depotId)
			.limit(1)
			.maybeSingle(),
		client.schema("depots").from("leaderboard").select("*"),
	])
	return { leaderboard: leaderboard_response, depot: depot_entry }
}
