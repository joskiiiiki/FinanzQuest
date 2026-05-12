async function hash(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value)
	const buffer = await crypto.subtle.digest("SHA-256", encoded)
	return Array.from(new Uint8Array(buffer))
		.map(b => b.toString(16).padStart(2, "0"))
		.join("")
}

export async function signature(
	depotId: number,
	userId: string
): Promise<string> {
	return hash(`${userId}${depotId}`)
}

export async function encodeDepotCookie(
	depotId: number,
	userId: string
): Promise<string> {
	const sign = await signature(depotId, userId)
	const payload = `${depotId}:${sign}`
	const encoded = Buffer.from(payload).toString("base64")
	return encoded
}

export async function decodeDepotCookie(
	encoded: string,
	userId: string
): Promise<{ depotId?: number; valid: boolean }> {
	const decoded = Buffer.from(encoded, "base64").toString("utf-8")
	const split = decoded.split(":")
	if (split.length !== 2) return { depotId: 0, valid: false }
	const [depotId, originalSignature] = split

	const depotIdNumber = parseInt(depotId, 10)
	if (Number.isNaN(depotIdNumber)) return { depotId: 0, valid: false }

	const sign = await signature(depotIdNumber, userId)
	const valid = sign === originalSignature

	return { depotId: depotIdNumber, valid }
}
