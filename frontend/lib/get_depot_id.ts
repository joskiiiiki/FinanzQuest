"use server"
import { createClient } from "@/utils/supabase/server"
import { getDepotDefaultId } from "./db"
import { getActiveDepotId } from "./depot_cookie/server"

export async function getDepotIdWithInspect() {
	const client = await createClient()

	if (params.inspect_depot) {
		const parsedDepotId = parseInt(params.inspect_depot, 10)
		if (!Number.isNaN(parsedDepotId)) {
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

	console.log("default depot:", defaultRes)

	return {
		depotId: defaultRes.depotId,
		error: null,
		noDepot: defaultRes.depotId === null || defaultRes.depotId === undefined,
		isInspect: false,
	}
}

export async function getDepotId() {
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
