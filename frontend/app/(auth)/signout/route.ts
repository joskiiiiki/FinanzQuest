import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { clearActiveDepotId } from "@/lib/depot_cookie/server"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
	const client = await createClient()
	clearActiveDepotId()
	await client.auth.signOut()
	revalidatePath("/", "layout")
	redirect("/")
}
