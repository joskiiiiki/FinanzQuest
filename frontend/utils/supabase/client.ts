import { createBrowserClient } from "@supabase/ssr"
import type { Client } from "@/database/custom_types"
import type { Database } from "@/database/types"

export function createClient(): Client {
	const url = process.env.NEXT_PUBLIC_SUPABASE_CLIENT_URL
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !key) {
		throw new Error("Missing Supabase credentials")
	}
	return createBrowserClient<Database>(url, key) as unknown as Client
}

export const supabase = createClient()
