export const currencyFormat = Intl.NumberFormat("de-DE", {
	style: "currency",
	minimumFractionDigits: 0,
	currency: "EUR",
	currencyDisplay: "symbol",
})
export const currencyFormatFixedLength = Intl.NumberFormat("de-DE", {
	style: "currency",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	currency: "EUR",
	currencyDisplay: "symbol",
})

export function to_display_string(
	amount: number | null,
	absolute?: boolean,
	dec_places = 3,
	abbreviate = true
): string {
	if (
		amount === 0 ||
		amount === null ||
		amount === undefined ||
		Number.isNaN(amount)
	) {
		return "-"
	}

	if (!abbreviate) {
		return (absolute ? Math.abs(amount) : amount).toFixed(dec_places)
	}

	const sign = absolute ? 1 : Math.sign(amount)
	const money_amount: number = Math.abs(amount)

	if (money_amount < 1) {
		return (money_amount * sign).toFixed(dec_places)
	}

	const abbreviations: Map<number, string> = new Map([
		[1, ""],
		[1000, "k"],
		[1000 * 1000, "M"],
		[1000 * 1000 * 1000, "B"],
	])

	let display_string = ""
	let biggest_divisor = 0
	let biggest_short = ""

	const pre_round_fac = 10 ** dec_places

	for (const [divisor, short] of abbreviations) {
		if (biggest_divisor < divisor && money_amount >= divisor) {
			biggest_divisor = divisor
			biggest_short = short
		}
	}

	display_string = `${
		(Math.round((money_amount / biggest_divisor) * pre_round_fac) /
			pre_round_fac) *
		sign
	}${biggest_short}`

	return display_string
}
