import { MAX_UPLOAD_BYTES, type UploadMimeType } from "@pymeshub/shared";

/** ImagePicker may re-encode a screenshot without updating its original MIME metadata. */
export function paymentProofImage(base64: string | null | undefined): {
	base64: string;
	mimeType: UploadMimeType;
} | null {
	if (
		!base64 ||
		base64.length % 4 === 1 ||
		!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
	)
		return null;
	const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	const size = Math.floor((base64.length * 3) / 4) - padding;
	if (size === 0 || size > MAX_UPLOAD_BYTES) return null;
	// Read just the signature, without allocating a decoded copy of a multi-megabyte image.
	const alphabet =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	const header: number[] = [];
	let buffer = 0;
	let bits = 0;
	for (const char of base64.slice(0, 16)) {
		const digit = alphabet.indexOf(char);
		if (digit < 0) break;
		buffer = (buffer << 6) | digit;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			header.push((buffer >>> bits) & 255);
		}
	}
	const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
		(byte, i) => header[i] === byte,
	);
	const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
	const webp =
		[82, 73, 70, 70].every((byte, i) => header[i] === byte) &&
		[87, 69, 66, 80].every((byte, i) => header[i + 8] === byte);
	const mimeType = png
		? "image/png"
		: jpeg
			? "image/jpeg"
			: webp
				? "image/webp"
				: null;
	return mimeType ? { base64, mimeType } : null;
}
