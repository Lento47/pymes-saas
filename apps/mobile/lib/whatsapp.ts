/** WhatsApp links require country-code digits, without the E.164 plus sign. */
export function customerWhatsAppUrl(phone: string | null): string | null {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, "");
	const international = digits.length === 8 ? `506${digits}` : digits;
	if (!/^\d{9,15}$/.test(international)) return null;
	return `https://wa.me/${international}`;
}
