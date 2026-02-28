"use client"

import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type Row,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table"
import {
	ArrowLeft,
	ArrowRight,
	ArrowUpDown,
	Check,
	Edit,
	Plus,
	Trash,
	Trash2,
	X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import AssetPickerDialog from "@/components/asset_picker_dialog"
import URLIcon from "@/components/icon"
import Tooltip from "@/components/tooltip"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import {
	type AssetType,
	type Frequency,
	frequenciesDisplay,
	type SavingsPlanWithAsset,
} from "@/database/custom_types"
import { currencyFormat } from "@/lib/cash_display_string"
import { getStockPagePath } from "@/lib/get_stock_path"
import { getIconURL } from "@/lib/icon_url"
import { relativeDateString, toAbsoluteTimeString } from "@/lib/util"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"
import NewEntryDialog from "./new_dialog"

interface EditableTableProps {
	data: SavingsPlanWithAsset[]
	monthlyBudget?: number
	className?: string
}

export function SavingsPlanTable({
	data,
	monthlyBudget,
	className,
}: EditableTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[]
	)
	const columnVisibility: VisibilityState = {
		asset_type: false,
		asset_id: false,
		name: false,
		id: false,
	}
	const router = useRouter()
	const [rowSelection, setRowSelection] = React.useState({})
	const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
	const [editedData, setEditedData] = React.useState<
		Partial<SavingsPlanWithAsset & { worth_string: string }>
	>({})

	const client = createClient()

	const handleEdit = (row: Row<SavingsPlanWithAsset>) => {
		setEditingRowId(row.id)
		setEditedData(row.original)
	}

	const handleSave = async (
		edited: Partial<typeof editedData>,
		row: Row<SavingsPlanWithAsset>
	) => {
		const p_id = row.getValue("id") as number
		const p_asset_id = edited.asset_id || row.getValue("asset_id")
		const worth = edited.worth_string ? parseFloat(edited.worth_string) : null
		const p_worth = worth || row.getValue("worth")
		const p_frequency = edited.frequency || row.getValue("frequency")

		if (!p_id) {
			return new Error("No active savings plan selected")
		}

		if (!p_asset_id) {
			return new Error("No asset selected")
		}

		if (!p_worth) {
			return new Error("No worth provided")
		}

		if (!p_frequency) {
			return new Error("No frequency provided")
		}

		const { error } = await client.schema("depots").rpc("update_savings_plan", {
			p_id,
			p_asset_id,
			p_worth,
			p_frequency,
		})

		if (error) {
			return error
		}

		setEditingRowId(null)
		setEditedData({})

		router.refresh()

		return
	}

	const handleCancel = () => {
		setEditingRowId(null)
		setEditedData({})
	}

	const handleDelete = async (row: Row<SavingsPlanWithAsset>) => {
		const id = row.getValue("id") as number | null | undefined


		if (!id) {
			return new Error("No ID provided")
		}

		const { error } = await client
			.schema("depots")
			.rpc("delete_savings_plan", { p_ids: [id] })

		if (error) {
			return error
		}

		router.refresh()

		return
	}

	const handleDeleteSelected = async () => {
		const ids = table
			.getFilteredSelectedRowModel()
			.rows.map(row => row.getValue("id") as number)
			.filter(id => id)

		if (!ids.length) {
			return new Error("No IDs provided")
		}

		const { error } = await client
			.schema("depots")
			.rpc("delete_savings_plan", { p_ids: ids })

		if (error) {
			return error
		}

		router.refresh()

		return
	}

	const updateEditedData = (
		field: keyof typeof editedData,
		value: (typeof editedData)[keyof typeof editedData]
	) => {
		setEditedData(prev => ({ ...prev, [field]: value }))
	}

	const columns: ColumnDef<SavingsPlanWithAsset>[] = [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Alle auswählen"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={value => row.toggleSelected(!!value)}
					aria-label="Auswählen"
					disabled={editingRowId === row.id}
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 40,
		},
		{
			id: "asset_type",
			accessorKey: "asset_type",
			enableHiding: true,
		},
		{
			id: "name",
			accessorKey: "name",
			enableHiding: true,
		},
		{
			id: "asset_id",
			accessorKey: "asset_id",
			enableHiding: true,
		},
		{
			id: "id",
			accessorKey: "id",
			enableHiding: true,
		},
		{
			accessorKey: "symbol",
			header: "Wertpapier",
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id
				const symbol = row.getValue("symbol") as string
				const asset_type = row.getValue("asset_type") as AssetType
				const asset_id = row.getValue("asset_id") as number
				const name = row.getValue("name") as string
				const icon = getIconURL(symbol, asset_type, 32)

				if (isEditing) {
					return (
						<AssetPickerDialog
							className="!w-fit"
							displayName={false}
							value={(editedData.asset_id as number) || asset_id}
							onValueChange={asset => {
								updateEditedData("symbol", asset.symbol)
								updateEditedData("asset_id", asset.id)
								updateEditedData("asset_type", asset.asset_type)
								updateEditedData("name", asset.name)
							}}
							defaultValue={{
								asset_type: editedData.asset_type || asset_type,
								id: editedData.asset_id || asset_id,
								name: editedData.name || name,
								symbol: editedData.symbol || symbol,
							}}
						/>
					)
				}

				return (
					<Link
						href={getStockPagePath(asset_id)}
						className="flex flex-row gap-2"
					>
						{icon ? (
							<URLIcon
								iconURL={icon}
								className="size-[1lh] rounded"
								size={32}
							/>
						) : null}
						<span>{symbol}</span>
					</Link>
				)
			},
		},
		{
			accessorKey: "worth",
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						className="px-0 hover:bg-transparent"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Betrag
						<ArrowUpDown />
					</Button>
				)
			},
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id
				const worth = row.getValue("worth") as number
				const percentage = monthlyBudget && (worth / monthlyBudget) * 100
				if (isEditing) {
					return (
						<Input
							key={`worth-${row.id}`}
							type="number"
							autoFocus
							value={editedData.worth_string ?? worth}
							onChange={e => {
								updateEditedData("worth_string", e.target.value)
							}}
							className="h-8 number"
						/>
					)
				}
				return (
					<div className="flex flex-row gap-2">
						<div className="number">{currencyFormat.format(worth)}</div>
						<div className="number text-muted-foreground">
							{percentage?.toFixed(1)}%
						</div>
					</div>
				)
			},
		},
		{
			accessorKey: "frequency",
			header: ({ column }) => (
				<Button
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					variant="ghost"
					className="px-0 hover:bg-transparent"
				>
					Frequenz
					<ArrowUpDown />
				</Button>
			),
			enableResizing: false,
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id
				const frequency = row.getValue("frequency") as Frequency

				if (isEditing) {
					return (
						<Select
							value={(editedData.frequency as Frequency) || frequency}
							onValueChange={value => updateEditedData("frequency", value)}
						>
							<SelectTrigger className="max-w-[140px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(frequenciesDisplay).map(([key, value]) => (
									<SelectItem key={key} value={key}>
										{value}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)
				}

				return <div>{frequenciesDisplay[frequency]}</div>
			},
		},
		{
			accessorKey: "created",
			header: ({ column }) => (
				<Button
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					variant="ghost"
					className="px-0 hover:bg-transparent"
				>
					Erstellt
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const created = new Date(row.getValue("created") as string)
				return (
					<div className="flex flex-row gap-2">
						<span>{toAbsoluteTimeString(created)}</span>
						<span className="text-muted-foreground font-normal">
							{relativeDateString(created)}
						</span>
					</div>
				)
			},
		},
		{
			id: "actions",
			enableHiding: false,
			size: 100,
			minSize: 100,
			maxSize: 100,
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id

				if (isEditing) {
					return (
						<ButtonGroup>
							<Button
								variant="outline"
								size="icon"
								onClick={() => {
									handleSave(editedData, row).then(e => {
										console.log("HIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII")
										if (e) {
											toast.error(e.message)
										}
									})
								}}
							>
								<Check className="stroke-emerald-600" />
							</Button>
							<Button variant="outline" size="icon" onClick={handleCancel}>
								<X className="stroke-muted-foreground/50" />
							</Button>
						</ButtonGroup>
					)
				}

				return (
					<ButtonGroup>
						<Button
							variant="outline"
							size="icon"
							onClick={() => handleEdit(row)}
						>
							<Edit />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={() =>
								handleDelete(row).then(error => {
									if (error) {
										toast.error(error.message)
									}
								})
							}
						>
							<Trash2 className="stroke-destructive" />
						</Button>
					</ButtonGroup>
				)
			},
		},
	]

	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: () => { },
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	})
	const selectedRows = table.getFilteredSelectedRowModel().rows
	return (
		<div className="flex flex-col gap-4 h-full grow">
			<div className={cn("rounded-md border grow p-2 ", className)}>
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map(headerGroup => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map(header => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
													header.column.columnDef.header,
													header.getContext()
												)}
										</TableHead>
									)
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.map(row => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
								className={editingRowId === row.id ? "bg-muted/50" : ""}
							>
								{row.getVisibleCells().map(cell => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end space-x-2 py-4">
				<div className="text-muted-foreground flex-1 text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{" "}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div>
			</div>
			<ButtonGroup className="flex flex-row justify-stretch *:grow w-full">
				<ButtonGroup>
					<NewEntryDialog
						trigger={
							<Button size="icon">
								<Plus />
							</Button>
						}
					/>
				</ButtonGroup>
				<ButtonGroup className="flex flex-row justify-center">
					{selectedRows.length > 0 && (
						<Button
							variant="destructive"
							onClick={() => {
								handleDeleteSelected().then(e => {
									if (e) {
										toast.error(e.message)
									}
								})
							}}
						>
							<Trash />
							Lösche {selectedRows.length}
						</Button>
					)}
				</ButtonGroup>
				<ButtonGroup className="justify-end">
					<Tooltip name="Vorherige Seite">
						<Button
							onClick={() => table.previousPage()}
							variant="outline"
							size="icon"
						>
							<ArrowLeft aria-label="Vorherige Seite" />
						</Button>
					</Tooltip>
					<Tooltip name="Nächste Seite">
						<Button
							onClick={() => table.nextPage()}
							variant="outline"
							size="icon"
						>
							<ArrowRight aria-label="Nächste Seite" />
						</Button>
					</Tooltip>
				</ButtonGroup>
			</ButtonGroup>
		</div>
	)
}
