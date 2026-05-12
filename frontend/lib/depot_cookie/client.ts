"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { decodeDepotCookie, encodeDepotCookie } from "./encode"

// lib/store.ts

export async function setDepotCookie(depotId: number, userId: string) {
	const day = 24 * 3600 * 1000
	await window.cookieStore.set({
		name: "activeDepotId",
		value: await encodeDepotCookie(depotId, userId),
		expires: Date.now() + day,
		sameSite: "lax",
		path: "/",
		partitioned: true,
	})
}

export async function getDepotCookie(userId: string): Promise<number | null> {
	const cookie = await window.cookieStore.get("activeDepotId")
	const encoded = cookie?.value
	if (!encoded) return null
	const { depotId, valid } = await decodeDepotCookie(encoded, userId)
	if (!valid || !depotId) return null
	return depotId
}

export async function getActiveDepotId(
	userId: string,
	searchParam?: string | null
): Promise<number | null> {
	const parsed = searchParam && parseInt(searchParam, 10)
	if (parsed) {
		return parsed
	}

	return await getDepotCookie(userId)
}

export function useActiveDepotId(userId: string) {
	const searchParams = useSearchParams()
	const [depotId, setDepotId] = useState<number | null>()

	useEffect(() => {
		getActiveDepotId(userId, searchParams.get("depot")).then(setDepotId)
	}, [searchParams, userId])

	return depotId
}
