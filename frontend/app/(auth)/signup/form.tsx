"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { signUpRedirect } from "../actions"
import { formSchema } from "./form_schema"

export default function SignUpForm() {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			fullName: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	})

	async function onSubmit(data: z.infer<typeof formSchema>) {
		const error = await signUpRedirect(data.fullName, data.email, data.password)

		console.error(error)

		if (error) {
			toast("Failed to sign up", {
				description: error.message,
			})
			return
		}
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-8 flex flex-col gap-0"
			>
				<FormField
					control={form.control}
					name="fullName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input type="text" placeholder="John Doe" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>E-Mail</FormLabel>
							<FormControl>
								<Input
									type="email"
									placeholder="maxmustermann@beispiel.de"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Passwort</FormLabel>
							<FormMessage />
							<FormControl>
								<Input
									className="rounded-b-none border-b-0 focus-visible:ring-2 ring-inset"
									type="password"
									placeholder="Passwort"
									{...field}
								/>
							</FormControl>
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="confirmPassword"
					render={({ field }) => (
						<FormItem className="!mt-0">
							<FormControl>
								<Input
									className="rounded-t-none focus-visible:ring-2 ring-inset"
									type="password"
									placeholder="Passwort bestätigen"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="termsAccepted"
					render={({ field }) => (
						<FormItem className="flex flex-row items-start space-x-3 space-y-0">
							<FormControl>
								<Checkbox
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
							<FormLabel>
								Ich akzeptiere die{" "}
								<Link className="underline underline-offset-2" href={"/terms"}>
									Nutzungsbedingungen
								</Link>
							</FormLabel>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button className="w-full mx-auto" type="submit">
					Registrieren
				</Button>
			</form>
		</Form>
	)
}
