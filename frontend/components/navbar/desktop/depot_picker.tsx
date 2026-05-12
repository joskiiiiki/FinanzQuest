"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { Depot } from "@/database/custom_types"
import { getUserId } from "@/lib/db"
import { getActiveDepotId, setDepotCookie } from "@/lib/depot_cookie/client"
import { createClient } from "@/utils/supabase/client"

async function fetchDepots() {
	const client = createClient()
	const { error, userId } = await getUserId(client)
	if (error) {
		return { error, data: null }
	}
	return await client
		.schema("depots")
		.from("depots")
		.select("*")
		.contains("users", [userId])
}

export default function DepotPicker() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const [activeDepotId, setActiveDepotId] = useState<number | null>(null)
	const [depots, setDepots] = useState<Depot[] | null>([])

	function setDepot(id: number, userId: string) {
		setDepotCookie(id, userId)
		router.push(`?depot=${id}`)
		router.refresh()
	}

	useEffect(() => {
		fetchDepots().then(res => {
			if (res.error) {
				console.error(res.error)
				setDepots(null)
				return
			}
			setDepots(res.data)
		})
	}, [])

	useEffect(() => {
		;(async () => {
			const client = createClient()
			const userId = (await client.auth.getUser()).data.user?.id

			if (!userId) return

			const depot = await getActiveDepotId(userId, searchParams.get("depot"))
			if (depot) {
				setActiveDepotId(depot)
			}
		})()
	}, [searchParams])

	return (
		<Select
			value={activeDepotId?.toString()}
			onValueChange={async value => {
				const client = createClient()
				const userId = (await client.auth.getUser()).data.user?.id
				const id = parseInt(value, 10)
				if (id && userId) {
					setActiveDepotId(id)
					setDepot(id, userId)
				}
			}}
		>
			<SelectTrigger className="!rounded-t-none focus:!ring-transparent">
				<SelectValue placeholder="Select a depot" />
			</SelectTrigger>
			<SelectContent align="start" side="right" sideOffset={10}>
				{depots?.map(depot => (
					<SelectItem key={depot.id} value={depot.id.toString()}>
						Depot {depot.id}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
