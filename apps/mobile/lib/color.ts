export function mixHex(
	first: string,
	second: string,
	firstWeight: number,
): string {
	const channels = [1, 3, 5].map((index) => {
		const from = Number.parseInt(first.slice(index, index + 2), 16);
		const to = Number.parseInt(second.slice(index, index + 2), 16);
		return Math.round(from * firstWeight + to * (1 - firstWeight))
			.toString(16)
			.padStart(2, "0");
	});
	return `#${channels.join("")}`;
}
