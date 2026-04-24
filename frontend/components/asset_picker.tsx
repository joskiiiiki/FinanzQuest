import { Check } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command"
import type { Asset } from "@/database/custom_types"
import { getStockFromSearchString } from "@/database/search_stock"
import { getIconURL } from "@/lib/icon_url"
import { cn } from "@/lib/utils"

type StockPickerProps = {
	value?: number
	onSelect: (assetId: number, asset: Asset) => void
	searchQuery: string
	onSearchChange: (query: string) => void
}

const assetTypeStyles = {
	stock: "bg-stock/30 border-stock/60 text-stock",
	crypto: "bg-crypto/30 border-crypto/60 text-crypto",
	fund: "bg-fund/30 border-fund/60 text-fund",
	commodity: "bg-commodity/30 border-commodity/60 text-commodity",
}

// then in JSX:

export default function StockPicker({
	value,
	onSelect,
	searchQuery,
	onSearchChange,
}: StockPickerProps) {
	const [stocks, setStocks] = useState<Array<Asset>>([])

	useEffect(() => {
		const fetchStocks = async () => {
			if (searchQuery === "" || !searchQuery) {
				setStocks([])
				return
			}
			const { assets, error, success } = await getStockFromSearchString(
				searchQuery,
				5
			)
			if (error) {
				console.error("Failed to fetch data from database", error)
			}
			if (success) {
				setStocks(assets)
			}
		}
		fetchStocks().catch(console.error)
	}, [searchQuery])

	return (
		<Command shouldFilter={false} className="border-none">
			<CommandInput
				value={searchQuery}
				placeholder="Suche nach Symbol, Name, Beschreibung"
				onValueChange={onSearchChange}
			/>
			<CommandList>
				<CommandEmpty>
					{searchQuery
						? "Keine Wertpapiere gefunden."
						: "Starte deine Suche..."}
				</CommandEmpty>
				<CommandGroup>
					{stocks.map(stock => {
						const iconUrl = getIconURL(stock.symbol, stock.asset_type, 32)
						return (
							<CommandItem
								className="!rounded-lg w-full flex gap-3 flex-row !py-2 !px-3"
								key={stock.id}
								value={stock.id.toString()}
								onSelect={() => {
									onSelect(stock.id, stock)
								}}
							>
								{iconUrl && iconUrl !== "" ? (
									<Image
										src={iconUrl}
										alt={""}
										width={16}
										height={16}
										fetchPriority="high"
										className="rounded size-[1.7lh] bg-primary/50"
									/>
								) : (
									<div className="size-[1.6lh] bg-primary/50 rounded"></div>
								)}
								<div className="flex flex-col w-full">
									<span className="font-medium">{stock.name}</span>
									<span className="text-sm text-muted-foreground">
										{stock.symbol}
									</span>
								</div>
								<div className="flex-grow flex-shrink" />
								<Check
									className={cn(
										"h-4 w-4 mr-2",
										value === stock.id ? "opacity-100" : "opacity-0"
									)}
								/>
								<div
									className={cn(
										"text-sm py-1 px-2 rounded-full border",
										assetTypeStyles[stock.asset_type]
									)}
								>
									{stock.asset_type}
								</div>
							</CommandItem>
						)
					})}
				</CommandGroup>
			</CommandList>
		</Command>
	)
}
