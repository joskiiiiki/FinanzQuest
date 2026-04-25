import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types.ts"

export type SearchParams = {
	depot?: string | null
	inspect_depot?: string | null
}
export type StockPrice = Database["api"]["Tables"]["asset_prices"]["Row"]
export type Asset = Database["api"]["Tables"]["assets"]["Row"]

export type NonNullableRow<T> = {
	[K in keyof T]: NonNullable<T[K]>
}

export type NullableRow<T> = {
	[K in keyof T]: T[K] | null
}
export type CleanedStockPrice = NonNullableRow<StockPrice>
export type CleanedStock = NonNullableRow<Asset>

export type PlainPrice = Omit<StockPrice, "id" | "asset_id">
export type CleanedPlainPrice = NonNullableRow<PlainPrice>

export type PositionSummary =
	Database["depots"]["Views"]["position_profits"]["Row"]

export type DepotOverview = Database["depots"]["Views"]["depot_overview"]["Row"]
export type SpecialRole = Database["users"]["Enums"]["special_role"]

export type UserProfile = Database["users"]["Views"]["profile"]["Row"]

export type UserOverview = Database["users"]["Views"]["admin_overview"]["Row"]

export type Result<Data, Error> =
	| { error: Error; data: null }
	| { error: null; data: Data }

export type AsyncResult<Data, Error> = Promise<Result<Data, Error>>
export type Client = SupabaseClient<Database>

export type StockPosition = {
	stock: Asset
	value: number
	price: number
	name: string
	absolute_profit: number
	relative_profit: number
	amount: number
}
export type DepotValue = Database["depots"]["Views"]["values"]["Row"]
export type DepotPosition = Database["depots"]["Tables"]["positions"]["Row"]
export type Depot = Database["depots"]["Tables"]["depots"]["Row"]

export type Transaction = Database["depots"]["Tables"]["transactions"]["Row"]

export type AssetType = Database["api"]["Tables"]["assets"]["Row"]["asset_type"]
export type SavingsPlan = Database["depots"]["Tables"]["savings_plans"]["Row"]
export type SavingsPlanWithAsset =
	Database["depots"]["Views"]["savings_plans_with_asset"]["Row"]

export type Frequency = Database["public"]["Enums"]["savingsperiod"]

export const frequencies: Frequency[] = [
	"daily",
	"weekly",
	"monthly",
	"annually",
]

export const frequenciesDisplay = {
	daily: "Täglich",
	weekly: "Wöchentlich",
	monthly: "Monatlich",
	annually: "Jährlich",
}

export type LeaderboardRow = Database["depots"]["Views"]["leaderboard"]["Row"]
