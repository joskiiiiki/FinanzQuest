"use server"

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Database } from "@/database/types"
import { getDepotDefaultId } from "@/lib/db"
import { clearActiveDepotId } from "@/lib/store/server"
import { createClient } from "@/utils/supabase/server"

export async function loginRedirect(email: string, password: string) {
	const client = await createClient()
	const { error } = await login(email, password, client)

	if (error) {
		return error
	}

	const depot = (await getDepotDefaultId(client)).depotId

	revalidatePath("/", "layout")

	const path = depot ? `/?depot=${depot}` : "/"

	redirect(path)
}

export async function login(
	email: string,
	password: string,
	client?: SupabaseClient
) {
	const supabase = client || (await createClient())
	const data = {
		email: email as string,
		password: password as string,
	}

	const { error } = await supabase.auth.signInWithPassword(data)

	if (error) {
		console.error(error)
		return { error: error.message, success: false }
	}

	revalidatePath("/", "layout")

	return { error: null, success: true }
}

export async function createDepotRedirect() {
	const { data, error } = await createDepotAction()

	if (error) {
		return error
	}

	if (!data) {
		return new Error("Depot not found")
	}

	redirect(`/?depot=${data}`)
}

export async function createDepotAction() {
	const client = await createClient()
	const { data, error } = await client.auth.getUser()

	if (error || !data) {
		return { error: error ?? new Error("Could not fetch user"), data: null }
	}

	const uuid = data.user.id

	const res = await client
		.schema("depots")
		.rpc("new_depot_for_user", { p_user_id: uuid })

	return res
}

export async function createDepot(
	uuid: string,
	client: SupabaseClient<Database>
) {
	return await client
		.schema("depots")
		.rpc("new_depot_for_user", { p_user_id: uuid })
}

export async function signUpRedirect(
	fullName: string,
	email: string,
	password: string,
	client?: SupabaseClient<Database>
) {
	console.log("signing up")
	const { error } = await signup(fullName, email, password, client)
	console.log("signed up")

	if (error) return error

	revalidatePath("/", "layout")
	redirect("/")
}

export async function signup(
	fullName: string,
	email: string,
	password: string,
	client?: SupabaseClient<Database>
) {
	const c = client ?? (await createClient())
	// type-casting here for convenience
	// in practice, you should validate your inputs
	const data = {
		email: email as string,
		password: password as string,
		options: {
			data: { name: fullName as string },
		},
	}

	const { error } = await c.auth.signUp(data)

	if (error) {
		return { error: error.message, success: false }
	}

	revalidatePath("/", "layout")

	return { error: null, success: true }
}

export async function logout(client?: SupabaseClient<Database>) {
	const c = client ?? (await createClient())

	clearActiveDepotId()
	await c.auth.signOut()
	revalidatePath("/", "layout")
	redirect("/login")
}
