"use client"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
	ArrowLeftRight,
	Home,
	LayoutDashboard,
	type LucideIcon,
	PiggyBank,
	SearchIcon,
	Trophy,
} from "lucide-react"
import { Suspense, useEffect, useState } from "react"
import DepotPicker from "@/components/navbar/desktop/depot_picker"
import { SearchBarPopOut } from "@/components/search_bar"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Database } from "@/database/types"
import { hasSpecialRoles } from "@/lib/db"
import { createClient } from "@/utils/supabase/client"
import User from "./user"

export function AppSidebar() {
	const [isTeacher, setIsTeacher] = useState(false)
	useEffect(() => {
		const client: SupabaseClient<Database> = createClient()

		hasSpecialRoles(["teacher"], client).then(result => {
			setIsTeacher(result.hasPermission)
		})
	}, [])

	interface ItemT {
		title: string
		url: string
		icon: LucideIcon
	}
	const tree: Record<string, Array<ItemT>> = {
		Depot: [
			{ title: "Mein Depot", url: "/", icon: Home },
			{ title: "Transaktionen", url: "/transactions", icon: ArrowLeftRight },
			{ title: "Sparplan", url: "/savings_plan", icon: PiggyBank },
		],
		// Aktien: [{ title: "Suche", url: "/search", icon: SearchIcon }],
		Wettbewerb: [{ title: "Leaderboard", url: "/leaderboard", icon: Trophy }],
	}

	if (isTeacher) {
		tree.Administration = [
			{ title: "Dashboard", url: "/admin", icon: LayoutDashboard },
		]
	}

	return (
		<Sidebar className="bg-sidebar px-3 pt-3">
			<SidebarHeader>
				<h1 className="font-bold text-3xl">FinanzQuest</h1>
			</SidebarHeader>
			<SidebarContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<SearchBarPopOut doRedirect>
								<div className="w-full flex items-center gap-2 justify-center whitespace-nowrap text-ellipsis overflow-hidden rounded-md text-sm font-medium transition-colors border border-input shadow-sm bg-background h-9 px-3 py-1">
									<SearchIcon className="size-5 shrink-0 stroke-muted-foreground" />
									<span className="text-muted-foreground shrink truncate hidden lg:inline">
										Wertpapiersuche...
									</span>
								</div>
							</SearchBarPopOut>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{Object.entries(tree).map(([label, items]) => (
					<SidebarGroup key={label}>
						<SidebarGroupLabel>{label}</SidebarGroupLabel>
						<SidebarMenu>
							{items.map(item => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<a href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="flex flex-col gap-0 *:bg-background/50">
				<Suspense fallback={<div>Loading...</div>}>
					<User />
					<DepotPicker />
				</Suspense>
			</SidebarFooter>
		</Sidebar>
	)
}
