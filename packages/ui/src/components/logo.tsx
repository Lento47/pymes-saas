import type * as React from "react";
import mark from "./pymeshub-logo.png";

/**
 * The brand mark.
 *
 * The product's own asset, versioned here so the header, the auth shell and
 * the agent panel all render the same file. Sized by the caller's className,
 * exactly like the inline SVG this replaced.
 */
const Logo = (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
	<img
		src={mark.src}
		width={mark.width}
		height={mark.height}
		alt=""
		{...props}
	/>
);

export default Logo;
