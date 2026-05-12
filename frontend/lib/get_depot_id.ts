"use server"
import type { SearchParams } from "@/database/custom_types"
import { createClient } from "@/utils/supabase/server"
import { getDepotDefaultId } from "./db"
import { getActiveDepotId } from "./depot_cookie/server"

export async function getDepotIdWithInspect(params: SearchParams) {
	const client = await createClient()

	if (params.inspect_depot) {
		const parsedDepotId = parseInt(params.inspect_depot, 10)
		if (!Number.isNaN(parsedDepotId)) {
			console.log("parse failed")
			return {
				depotId: parsedDepotId,
				error: null,
				noDepot: null,
				isInspect: true,
			}
		}
	}

	if (params.depot) {
		const parsedDepotId = parseInt(params.depot, 10)
		if (!Number.isNaN(parsedDepotId)) {
			return {
				depotId: parsedDepotId,
				error: null,
				noDepot: null,
				isInspect: false,
			}
		}
	}

	const userId = (await client.auth.getUser()).data.user?.id

	if (userId) {
		const depotId = await getActiveDepotId(userId)
		if (depotId) {
			console.log("found depot")
			return {
				depotId,
				error: null,
				noDepot: null,
				isInspect: false,
			}
		}
	}

	const defaultRes = await getDepotDefaultId(client)

	if (defaultRes.error) {
		console.log("got error", defaultRes.noDepot)
		return {
			depotId: null,
			error: defaultRes.error,
			noDepot: defaultRes.noDepot,
			isInspect: false,
		}
	}

	console.log(defaultRes)

	return {
		depotId: defaultRes.depotId,
		error: null,
		noDepot: defaultRes.depotId ?? null,
		isInspect: false,
	}
}

export async function getDepotId(params: SearchParams) {
	if (params.depot) {
		const parsedDepotId = parseInt(params.depot, 10)
		if (!Number.isNaN(parsedDepotId)) {
			return {
				depotId: parsedDepotId,
				error: null,
				noDepot: null,
			}
		}
	}
	const client = await createClient()
	const userId = (await client.auth.getUser()).data.user?.id

	if (userId) {
		const depotId = await getActiveDepotId(userId)
		if (depotId) {
			return {
				depotId,
				error: null,
				noDepot: null,
			}
		}
	}

	return await getDepotDefaultId(client)
}
