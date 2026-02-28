"use server"
import { LineChart as LinechartIcon, TableCellsMerge } from "lucide-react"
import { redirect } from "next/navigation"
import { ErrorCard } from "@/components/cards/cards"
import AreaChart from "@/components/charts/area"
import ChartContainer from "@/components/charts/primitive/container"
import TreeChart from "@/components/charts/tree"
import PositionTabView, { PositionsEmpty } from "@/components/displays/tab_view"
import HeaderStat from "@/components/stat/header_stat"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
	DepotValue,
	NonNullableRow,
	PositionSummary,
	SearchParams,
} from "@/database/custom_types"
import { processDepotValues } from "@/database/depots"
import { getDepotIdWithInspect } from "@/lib/get_depot_id"
import { getDateCertainDaysAgo, toISODateOnly } from "@/lib/util"
import { createClient } from "@/utils/supabase/server"

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<SearchParams>
}) {
	const params = await searchParams

	const {
		depotId,
		error: depotIdError,
		noDepot,
	} = await getDepotIdWithInspect(params)

	if (noDepot) {
		redirect("/new_depot")
	}

	if (depotIdError || !depotId) {
		return <ErrorCard error={depotIdError || new Error("Depot ID not found")} />
	}

	const fres = await dataFetcher(depotId)
	if (fres.error) {
		return <ErrorCard error={fres.error} />
	}

	if (fres.depot === null) {
		return <ErrorCard error={new Error("Depot not found")} />
	}

	const treeData = fres.positions

	const d = fres.depotAggValues?.at(0)
	const areaData = processDepotValues(
		(fres.depotValues as NonNullableRow<DepotValue>[]) ?? []
	)
	return (
		<main className="grid grid-cols-1 gap-3">
			<Card className="overflow-hidden border-none">
				<CardHeader>
					<CardTitle>
						<HeaderStat
							className="justify-start"
							displays={{
								Depotwert: { value: d?.total ?? 0 },
								Heute: { value: d?.diff_1d ?? 0 },
								Monat: { value: d?.diff_1m ?? 0 },
								Jahr: { value: d?.diff_1y ?? 0 },
								Cash: { value: d?.cash ?? 0 },
							}}
						/>
					</CardTitle>
				</CardHeader>
				<CardContent className="m-0 px-0 pb-0">
					<ChartContainer
						className="rounded-xl border overflow-hidden"
						defaultTab="line"
						tabs={[
							{
								name: "line",
								icon: (
									<LinechartIcon className="size-7 md:size-5 stroke-muted-foreground" />
								),
								content: (
									<AreaChart
										className="aspect-[4/3] md:aspect-[20/9] lg:aspect-[6/2] xl:aspect-[8/2]"
										startValue={areaData?.start ?? 50000}
										offset={areaData?.offset ?? 0}
										data={areaData?.data ?? []}
										dataKey="total"
										xKey="timestamp"
										yKey="total"
									/>
								),
							},
							{
								name: "tree",
								icon: (
									<TableCellsMerge className="size-7 md:size-5 stroke-muted-foreground" />
								),
								content: (
									<TreeChart
										className="max-h-[500px] w-full"
										data={treeData as PositionSummary[]}
										dataKey="market_value"
									/>
								),
							},
						]}
					/>{" "}
				</CardContent>
			</Card>

			{!fres.positions || fres.positions?.length === 0 ? (
				fres.ownedByUser && <PositionsEmpty />
			) : (
				<PositionTabView positions_raw={fres.positions as PositionSummary[]} />
			)}
		</main>
	)
}

const dataFetcher = async (depotId: number) => {
	const client = await createClient()

	const user = (await client.auth.getUser()).data.user

	if (!user) {
		redirect("/auth/login")
	}

	const response = await client
		.schema("depots")
		.from("depots")
		.select()
		.eq("id", depotId)
		.limit(1)
		.maybeSingle()

	const ownedByUser = response.data?.users.some(id => id === user.id)

	const { data: depot, error: depotError } = response

	if (depotError) {
		return { error: depotError }
	}
	if (!depot) {
		return { depot: null }
	}

	const tstamp = toISODateOnly(getDateCertainDaysAgo(30))
	const depots = client.schema("depots")
	const [positionResponse, valueResponse, valueAggResponse] = await Promise.all(
		[
			depots.from("position_profits").select().eq("depot_id", depot.id),
			depots
				.schema("depots")
				.from("values")
				.select()
				.eq("depot_id", depot.id)
				.gte("tstamp", tstamp),
			depots
				.schema("depots")
				.from("aggregated_values")
				.select()
				.eq("depot_id", depot.id),
		]
	)

	return {
		depot: depot,
		error:
			positionResponse.error ?? valueResponse.error ?? valueAggResponse.error,
		positions: positionResponse.data,
		depotValues: valueResponse.data,
		depotAggValues: valueAggResponse.data,
		ownedByUser,
	}
}
