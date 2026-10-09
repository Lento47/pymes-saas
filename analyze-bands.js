import { readFileSync } from "node:fs";

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel) {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, c * 255)));
}

function toOklab(hex) {
  const read = (i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = [read(1), read(3), read(5)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([l, a, b]) {
  const _l = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const _m = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const _s = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return "#" + [
    4.0767416621 * _l - 3.3077115913 * _m + 0.2309699292 * _s,
    -1.2684380046 * _l + 2.6097574011 * _m - 0.3413193965 * _s,
    -0.0041960863 * _l - 0.7034186147 * _m + 1.707614701 * _s,
  ].map(fromLinear).map((v) => v.toString(16).padStart(2, "0")).join("");
}

function mixOklab(first, second, firstWeight) {
  const from = toOklab(first);
  const to = toOklab(second);
  return fromOklab([
    from[0] + (to[0] - from[0]) * (1 - firstWeight),
    from[1] + (to[1] - from[1]) * (1 - firstWeight),
    from[2] + (to[2] - from[2]) * (1 - firstWeight),
  ]);
}

function relativeLuminance(hex) {
  const read = (i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * read(1) + 0.7152 * read(3) + 0.0722 * read(5);
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function bandAnchor(color, page, target = 4.5) {
  if (contrastRatio(color, page) >= target) return color;
  const maxChromaAt = (lightness, hue) => {
    const linear = (chroma) => {
      const ca = chroma * Math.cos(hue);
      const cb = chroma * Math.sin(hue);
      const l = (lightness + 0.3963377774 * ca + 0.2158037573 * cb) ** 3;
      const m = (lightness - 0.1055613458 * ca - 0.0638541728 * cb) ** 3;
      const s = (lightness - 0.0894841775 * ca - 1.291485548 * cb) ** 3;
      return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      ];
    };
    const inGamut = (chroma) =>
      linear(chroma).every((ch) => ch >= 0 && ch <= 1);
    if (!inGamut(0)) return 0;
    let low = 0;
    let high = Math.hypot(a, b) * 2;
    if (inGamut(high)) return high;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (inGamut(middle)) low = middle;
      else high = middle;
    }
    return low;
  };
  const [startLightness, a, b] = toOklab(color);
  const hue = Math.atan2(b, a);
  const at = (lightness) => {
    const chroma = maxChromaAt(lightness, hue);
    return fromOklab([lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
  };
  const clears = (lightness) => contrastRatio(at(lightness), page) >= target;
  const darker = (() => {
    if (!clears(0)) return null;
    let low = 0;
    let high = startLightness;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (clears(middle)) low = middle;
      else high = middle;
    }
    return low;
  })();
  const lighter = (() => {
    if (!clears(1)) return null;
    let low = startLightness;
    let high = 1;
    for (let step = 0; step < 20; step += 1) {
      const middle = (low + high) / 2;
      if (clears(middle)) high = middle;
      else low = middle;
    }
    return high;
  })();
  if (darker === null && lighter === null) return color;
  if (darker === null) return at(lighter);
  if (lighter === null) return at(darker);
  return Math.abs(darker - startLightness) <= Math.abs(lighter - startLightness)
    ? at(darker)
    : at(lighter);
}

const tokensSrc = readFileSync("L:/PROJECTS/pymes-saas/pymes-saas/apps/mobile/theme/tokens.ts", "utf8");

function getVal(inner, name) {
  const m = inner.match(new RegExp(`\\b${name}: "(#........)"`));
  return m ? m[1] : null;
}

const themeIds = ["amber", "berry", "blue", "coral", "emerald", "indigo", "lime", "navy", "orange", "periwinkle", "red", "sunset", "teal"];
const stages = ["basket", "inCart", "checkout", "confirmed", "paid", "delivery"];

for (const scheme of ["light", "dark"]) {
  console.log("=== " + scheme + " ===");
  for (const stage of stages) {
    const bands = [];
    for (const id of themeIds) {
      if (scheme === "dark" && id === "lime") continue;
      const innerMatch = tokensSrc.match(new RegExp(`${id}:\\s*{(.*?)^\\t\\},`, "m"));
      if (!innerMatch) continue;
      const inner = innerMatch[1];
      const bg = getVal(inner, "background");
      const fg = getVal(inner, "foreground");
      const prim = getVal(inner, "primary");
      const basket = getVal(inner, "basket");
      const inCart = getVal(inner, "inCart");
      const checkout = getVal(inner, "checkout");
      const info = getVal(inner, "info");
      const success = getVal(inner, "success");
      const themed = (semantic, w) => mixOklab(prim, semantic, w);
      const bandColor = (semantic, w) => bandAnchor(themed(semantic, w), bg);
      let c;
      if (stage === "basket") c = bandColor(basket, 0.78);
      else if (stage === "inCart") c = bandColor(inCart, 0.84);
      else if (stage === "checkout") c = bandColor(checkout, 0.9);
      else if (stage === "confirmed") c = bandColor(info, 0.82);
      else if (stage === "paid") c = bandColor(success, 0.82);
      else if (stage === "delivery") c = bandColor(info, 0.9);

      if (c) bands.push({ id: id, color: c });
    }
    const seen = new Map();
    const collisions = [];
    for (const item of bands) {
      if (seen.has(item.color)) collisions.push([seen.get(item.color), item.id]);
      else seen.set(item.color, item.id);
    }
    if (collisions.length > 0) {
      console.log("  " + stage + ": UNIQUE=" + seen.size + " of " + themeIds.length + "  COLLISIONS=" + collisions.map((x) => x.join(" x ")).join("; "));
    } else {
      console.log("  " + stage + ": all " + bands.length + " unique");
    }
  }
}
