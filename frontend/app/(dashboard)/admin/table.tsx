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
	Ban,
	Check,
	Edit,
	FolderIcon,
	KeyRound,
	MoreVertical,
	Plus,
	Trash2,
	UserStar,
	X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import SimpleAlertDialog from "@/components/simple_alert_dialog"
import SimpleDialog from "@/components/simple_dialog"
import Tooltip from "@/components/tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import type { UserOverview } from "@/database/custom_types"
import {
	banUser,
	changePassword,
	deleteUser,
	grantTeacher,
	newUser,
	revokeTeacher,
	unbanUser,
	updateUser,
} from "@/lib/admin_actions"
import { getTimeBetweenDates, relativeDateString } from "@/lib/util"
import { cn } from "@/lib/utils"
import { BanForm, ChangePasswordForm } from "./forms"
import { NewUserDialog } from "./new_user_dialog"

interface AdminUsersTableProps {
	data: UserOverview[]
	className?: string
}

const rolesDisplay = {
	admin: "Administrator",
	teacher: "Lehrer",
}

// Helper function to format date
const formatDate = (dateString: string) => {
	const date = new Date(dateString)
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date)
}

const handleError = ({ error }: { error?: Error | null }) => {
	if (error) {
		console.error(error)
		toast.error(`${error.name && `${error.name}: `}${error.message}`)
	}
}

export function AdminUsersTable({ data, className }: AdminUsersTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[]
	)
	const columnVisibility: VisibilityState = {
		id: false,
	}
	const [rowSelection, setRowSelection] = React.useState({})
	const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
	const [editedData, setEditedData] = React.useState<{
		user_name?: string | null
		email?: string | null
	}>({})

	const handleEdit = (row: Row<UserOverview>) => {
		setEditingRowId(row.id)
		setEditedData({
			user_name: row.original.user_name ?? undefined,
			email: row.original.email,
		})
	}

	const router = useRouter()

	const handleSave = async (row: Row<UserOverview>) => {
		// Implement save logic here
		const user_id = row.original.id

		if (user_id) updateUser(user_id, editedData).then(handleError)
		else toast.error("User ID is missing")

		setEditingRowId(null)
		setEditedData({})
		router.refresh()
	}

	const handleCancel = () => {
		setEditingRowId(null)
		setEditedData({})
	}

	const updateEditedData = (field: keyof typeof editedData, value: string) => {
		setEditedData(prev => ({ ...prev, [field]: value }))
	}

	const columns: ColumnDef<UserOverview>[] = [
		// {
		//   id: "select",
		//   header: ({ table }) => (
		//     <Checkbox
		//       checked={
		//         table.getIsAllPageRowsSelected() ||
		//         (table.getIsSomePageRowsSelected() && "indeterminate")
		//       }
		//       onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
		//       aria-label="Alle auswählen"
		//     />
		//   ),
		//   cell: ({ row }) => (
		//     <Checkbox
		//       checked={row.getIsSelected()}
		//       onCheckedChange={(value) => row.toggleSelected(!!value)}
		//       aria-label="Auswählen"
		//       disabled={editingRowId === row.id}
		//     />
		//   ),
		//   enableSorting: false,
		//   enableHiding: false,
		//   size: 40,
		// },
		{
			id: "id",
			accessorKey: "id",
			enableHiding: true,
		},
		{
			accessorKey: "user_name",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Name
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id
				const userName = row.getValue("user_name") as string | null

				if (isEditing) {
					return (
						<Input
							type="text"
							autoFocus
							value={editedData.user_name ?? userName ?? ""}
							onChange={e => updateEditedData("user_name", e.target.value)}
							className="h-8"
						/>
					)
				}

				return <div>{userName ?? "-"}</div>
			},
		},
		{
			accessorKey: "email",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					E-Mail
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const isEditing = editingRowId === row.id
				const email = row.getValue("email") as string

				if (isEditing) {
					return (
						<Input
							type="email"
							value={editedData.email ?? email}
							onChange={e => updateEditedData("email", e.target.value)}
							className="h-8"
						/>
					)
				}

				return <div className="font-mono text-sm">{email}</div>
			},
		},
		{
			accessorKey: "created_at",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Erstellt
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const created = row.getValue("created_at") as string
				return (
					<div className="flex flex-row gap-2">
						<span>{formatDate(created)}</span>
						<span className="text-muted-foreground font-normal">
							{relativeDateString(new Date(created), "never")}
						</span>
					</div>
				)
			},
		},
		{
			accessorKey: "banned_until",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Gesperrt
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const bannedUntil = row.getValue("banned_until") as string | null
				if (!bannedUntil) {
					return (
						<div className="flex flex-row gap-2">
							<span>-</span>
						</div>
					)
				}
				return (
					<div className="flex flex-row gap-2">
						<span>{formatDate(bannedUntil)}</span>
						<span className="text-muted-foreground font-normal">
							{getTimeBetweenDates(new Date(), new Date(bannedUntil))} Tage
						</span>
					</div>
				)
			},
		},
		{
			accessorKey: "depot_count",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Depots
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const count = row.getValue("depot_count") as number
				const userId = row.getValue("id") as string
				return (
					<Link
						href={`/admin/depots?user_id=${userId}`}
						className="text-center"
					>
						{count}
					</Link>
				)
			},
		},
		{
			accessorKey: "position_count",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Positionen
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const count = row.getValue("position_count") as number
				return <div className="text-center">{count}</div>
			},
		},
		{
			accessorKey: "transaction_count",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="px-0 hover:bg-transparent"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Transaktionen
					<ArrowUpDown />
				</Button>
			),
			cell: ({ row }) => {
				const count = row.getValue("transaction_count") as number
				return <div className="text-center">{count}</div>
			},
		},
		{
			accessorKey: "user_roles",
			header: "Rollen",
			cell: ({ row }) => {
				const roles = row.original.user_roles
				const grantedAt = row.original.role_granted_at

				if (!roles || roles.length === 0) {
					return "-"
				}

				return (
					<div className="flex gap-1 flex-wrap">
						{roles.map((role, index) => {
							const granted = grantedAt?.[index]

							const badge = (
								<Badge variant="secondary">
									{(rolesDisplay as Record<string, string>)[role as string]}
								</Badge>
							)
							if (!granted) {
								return badge
							}
							return (
								<Tooltip
									key={role}
									name={`Erteilt: ${relativeDateString(new Date(granted), "necessary")}`}
								>
									{badge}
								</Tooltip>
							)
						})}
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
				const userId = row.getValue("id") as string
				const banned = row.getValue("banned_until") as string | null | undefined

				const isTeacher = (
					row.getValue("user_roles") as string[] | undefined
				)?.includes("teacher")

				if (isEditing) {
					return (
						<ButtonGroup>
							<Button
								variant="outline"
								size="icon"
								onClick={() => handleSave(row)}
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
							<span className="sr-only">Bearbeiten</span>
						</Button>
						<DotsMenu userId={userId} banned={banned} isTeacher={isTeacher} />
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
		onColumnVisibilityChange: () => {},
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	})

	return (
		<div className="flex flex-col gap-4 h-full w-full max-w-full">
			<div className={cn("border rounded-lg p-2", className)}>
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
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map(row => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={editingRowId === row.id ? "bg-muted/50" : ""}
								>
									{row.getVisibleCells().map(cell => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									Keine Benutzer gefunden.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-row items-center justify-between gap-2">
				<NewUserDialog
					onSubmit={data => {
						newUser(data).then(handleError)
					}}
					trigger={
						<Button size="icon">
							<Plus />
						</Button>
					}
				/>
				<ButtonGroup className="justify-end">
					<Tooltip name="Vorherige Seite">
						<Button
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
							variant="outline"
							size="icon"
						>
							<ArrowLeft aria-label="Vorherige Seite" />
						</Button>
					</Tooltip>
					<Tooltip name="Nächste Seite">
						<Button
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
							variant="outline"
							size="icon"
						>
							<ArrowRight aria-label="Nächste Seite" />
						</Button>
					</Tooltip>
				</ButtonGroup>
			</div>
		</div>
	)
}
function DotsMenu({
	userId,
	banned,
	isTeacher = false,
}: {
	userId: string
	banned?: string | null
	isTeacher?: boolean
}) {
	"use client"
	function handleSubmit<T extends unknown[]>(
		f: (...args: T) => Promise<unknown> | unknown
	) {
		return (...params: T) => {
			setOpen(null)
			return f(...params)
		}
	}

	const forms: Record<
		string,
		{ title: string; description: string; content: React.ReactNode }
	> = {
		changePassword: {
			title: "Passwort ändern",
			description: "Geben Sie ein neues Passwort ein.",
			content: (
				<ChangePasswordForm
					user_id={userId}
					onSubmit={handleSubmit(password => {
						changePassword(userId, password).then(handleError)
						router.refresh()
					})}
				/>
			),
		},
		banUser: {
			title: "Benutzer sperren",
			description:
				"Sperren Sie den Benutzer auf die Plattform für eine bestimmte Zeit.",
			content: (
				<BanForm
					user_id={userId}
					onSubmit={handleSubmit(duration => {
						banUser(userId, duration).then(handleError)
						router.refresh()
					})}
				/>
			),
		},
	}
	const [open, setOpen] = React.useState<keyof typeof forms | null>(null)
	const [alertOpen, setAlertOpen] = React.useState(false)
	const router = useRouter()

	const dialogs = (
		<>
			<SimpleDialog
				key={1}
				open={Boolean(open)}
				onOpenChange={() => setOpen(null)}
				title={open && forms[open].title}
				description={open && forms[open].description}
			>
				{open && forms[open].content}
			</SimpleDialog>
			<SimpleAlertDialog
				key={2}
				open={alertOpen}
				onOpenChange={open => setAlertOpen(open)}
				title="Benutzer löschen"
				description="Sind Sie sicher, dass Sie diesen Benutzer löschen möchten?"
				cancel="Abbrechen"
				confirm="Löschen"
				onConfirm={() => {
					deleteUser(userId).then(handleError)
					router.refresh()
				}}
			/>
		</>
	)
	return (
		<>
			{dialogs}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="icon">
						<MoreVertical className="size-4" />
						<span className="sr-only">Aktionen öffnen</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem>
						<Link
							className="flex flex-row items-center gap-2"
							href={`/admin/depots?user_id=${userId}`}
						>
							<FolderIcon className="mr-2 size-4" />
							Depots anzeigen
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={() => setOpen("changePassword")}>
						<KeyRound className="mr-2 size-4" />
						Passwort ändern
					</DropdownMenuItem>

					{isTeacher ? (
						<DropdownMenuItem
							onClick={() => {
								revokeTeacher(userId).then(handleError)
								router.refresh()
							}}
						>
							<UserStar className="mr-2 size-4" />
							Lehrer entziehen
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem
							onClick={() => {
								grantTeacher(userId).then(handleError)
								router.refresh()
							}}
						>
							<UserStar className="mr-2 size-4" />
							Zum Lehrer machen
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					{banned ? (
						<DropdownMenuItem
							onClick={() => {
								unbanUser(userId).then(handleError)
								router.refresh()
							}}
						>
							<Ban className="mr-2 size-4" />
							Benutzer entsperren
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => setOpen("banUser")}
						>
							<Ban className="mr-2 size-4" />
							Benutzer sperren
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onClick={() => setAlertOpen(true)}
						className="text-destructive focus:text-destructive"
					>
						<Trash2 className="mr-2 size-4" />
						Benutzer löschen
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	)
}
