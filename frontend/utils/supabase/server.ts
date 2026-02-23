import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"
import { cookies } from "next/headers"
import type { Database } from "@/database/types"

export async function createClient(): Promise<SupabaseClient<Database>> {
	const cookieStore = await cookies()

	const url = process.env.NEXT_PUBLIC_SUPABASE_SERVER_URL
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	if (!url || !key) {
		throw new Error("Missing Supabase credentials")
	}

	return createServerClient<Database>(url, key, {
		cookies: {
			getAll() {
				return cookieStore.getAll()
			},
			setAll(
				cookiesToSet: {
					name: string
					value: string
					options: Partial<ResponseCookie>
				}[]
			) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options)
					}
				} catch {
					// The `setAll` method was called from a Server Component.
					// This can be ignored if you have middleware refreshing
					// user sessions.
				}
			},
		},
	}) as unknown as SupabaseClient<Database>
}
