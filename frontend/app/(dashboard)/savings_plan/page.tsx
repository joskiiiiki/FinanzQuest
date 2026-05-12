import { CircleSlash2, PiggyBank } from "lucide-react"
import { ErrorCard } from "@/components/cards/cards"
import { Button } from "@/components/ui/button"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty"
import type { SearchParams } from "@/database/custom_types"
import { currencyFormat } from "@/lib/cash_display_string"
import { getDepotIdWithInspect } from "@/lib/get_depot_id"
import { formatDateString } from "@/lib/util"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/server"
import NewEntryDialog from "./new_dialog"
import { SavingsPlanTable } from "./table"
export default async function Page(props: {
	searchParams: Promise<SearchParams>
}) {
	const searchParams = await props.searchParams
	const {
		depotId,
		error: depotIdError,
		isInspect,
	} = await getDepotIdWithInspect(searchParams)
	if (depotIdError || !depotId) {
		return (
			<ErrorCard
				error={depotIdError || new Error("Depot ID not found")}
			></ErrorCard>
		)
	}

	const { data, error, budget } = await dataFetcher(depotId)

	if (error) {
		return <ErrorCard error={error}></ErrorCard>
	}

	return (
		<main className="w-full flex flex-col gap-6 items-start">
			{budget && (
				<div className="grid grid-cols-3 gap-3 grid-rows-1 *:bg-muted/50 *:border *:rounded-lg *:shadow *:px-6 *:py-5">
					<div className="gap-2 flex flex-col justify-start">
						<div>Monatliches Budget</div>
						<div className="text-2xl font-semibold number">
							{budget.budget && currencyFormat.format(budget.budget)}
						</div>
						<div className="text-sm text-muted-foreground">
							{budget.last_changed && formatDateString(budget.last_changed)}
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<div>Restbudget</div>
						<div className="text-2xl font-semibold number flex flex-row items-center gap-2">
							{budget.remaining_budget && (
								<>
									<span
										className={cn(
											"font-bold",
											budget.remaining_budget > 0 ? "text-win" : "text-loss"
										)}
									>
										{budget.remaining_budget > 0 ? "+" : "-"}
									</span>
									{currencyFormat.format(Math.abs(budget.remaining_budget))}
								</>
							)}
						</div>
						<div className="text-sm text-muted-foreground">
							<CircleSlash2 className="inline-block size-4" /> pro Monat
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<div>Ausgaben</div>
						<div className="text-2xl font-semibold number flex flex-row items-center gap-2">
							{budget.monthly_expenses &&
								currencyFormat.format(budget.monthly_expenses)}
						</div>
						<div className="text-sm text-muted-foreground">
							<CircleSlash2 className="inline-block size-4" /> pro Monat
						</div>
					</div>
				</div>
			)}
			<div className="flex flex-col gap-4 w-full p-2 border grow rounded-xl bg-muted/25">
				{data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<PiggyBank />
							</EmptyMedia>
							<EmptyTitle>
								{isInspect ? "Der" : "Dein"} Sparplan ist leer.
							</EmptyTitle>
							<EmptyDescription>
								{isInspect
									? "Die Schüler haben noch keine Einträge erstellt."
									: "Füge einen neuen Eintrag hinzu, um mit deinem Sparplan loszulegen."}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<EmptyContent>
								{!isInspect && (
									<NewEntryDialog
										trigger={<Button>Eintrag hinzufügen</Button>}
									/>
								)}
							</EmptyContent>
						</EmptyContent>
					</Empty>
				) : (
					<SavingsPlanTable
						className="bg-background !rounded-lg"
						monthlyBudget={budget?.monthly_expenses ?? undefined}
						data={data}
					/>
				)}
			</div>
		</main>
	)
}

const dataFetcher = async (depotId: number) => {
	const client = await createClient()

	const [budgetResult, savingsPlansResult] = await Promise.all([
		client
			.schema("depots")
			.from("savings_plans_budget_overview")
			.select()
			.eq("depot_id", depotId)
			.limit(1)
			.maybeSingle(),
		client
			.schema("depots")
			.from("savings_plans_with_asset")
			.select("*")
			.eq("depot_id", depotId),
	])

	if (budgetResult.error || savingsPlansResult.error) {
		return {
			data: null,
			budget: null,
			error: budgetResult.error || (savingsPlansResult.error as Error),
		}
	}

	return {
		data: savingsPlansResult.data,
		budget: budgetResult.data,
		error: null,
	}
}
