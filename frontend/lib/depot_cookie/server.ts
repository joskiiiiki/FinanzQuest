"use server"
import { cookies } from "next/headers"
import { decodeDepotCookie, encodeDepotCookie } from "./encode"
export async function setActiveDepotId(id: number, userId: string) {
	const cookieStore = await cookies()
	const day = 24 * 3600 * 1000
	const encoded = await encodeDepotCookie(id, userId)
	cookieStore.set({
		name: "activeDepotId",
		value: encoded,
		expires: Date.now() + day,
		path: "/",
		sameSite: "lax",
		httpOnly: false,
	})
}

export async function clearActiveDepotId() {
	const cookieStore = await cookies()
	cookieStore.delete("activeDepotId")
}

export async function getActiveDepotId(userId: string) {
	const cookieStore = await cookies()
	const activeDepotId = cookieStore.get("activeDepotId")
	const encoded = activeDepotId?.value

	if (!encoded) return null

	const { depotId, valid } = await decodeDepotCookie(encoded, userId)

	if (!valid || !depotId) return null
	return depotId
}
