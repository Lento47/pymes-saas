/**
 * Next.js static image imports: a raster import resolves to an image metadata
 * object (`src`, `width`, `height`, `blurDataURL`), not a plain URL string —
 * SVGs are the exception and return a string. This declaration lets the
 * package's own `tsc --noEmit` typecheck both shapes' consumers.
 */
declare module "*.png" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}
