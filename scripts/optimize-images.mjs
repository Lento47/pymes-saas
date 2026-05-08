/**
 * Image optimization script for PymesHub landing page assets.
 * Run with: node scripts/optimize-images.mjs
 * Requires: sharp (pnpm --filter rest-express add sharp)
 *
 * Converts PNG landing icons and branding images to WebP,
 * resizing them to their actual display dimensions.
 * Reduces total image payload from ~12 MB → ~300 KB.
 */

import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'apps', 'web', 'client', 'public');

const OPTIMIZE = [
  { src: 'landing-icons/world.png',              w: 160, h: 107 },
  { src: 'landing-icons/Smart-automations.png',   w: 160, h: 107 },
  { src: 'landing-icons/performance.png',         w: 160, h: 107 },
  { src: 'landing-icons/enterprise-workspace-control.png', w: 160, h: 107 },
  { src: 'landing-icons/readytolunch.png',        w: 160, h: 107 },
  { src: 'landing-icons/security.png',            w: 160, h: 107 },
  { src: 'images/PymesHub.png',                   w: 240, h: 48 },
  { src: 'images/appIcon.png',                    w: 96,  h: 96 },
  { src: 'images/hero-bg.png',                    w: 1920, h: 800, quality: 80, keepSuffix: true },
];

async function main() {
  const outDir = join(PUBLIC_DIR, '_optimized');
  await mkdir(outDir, { recursive: true });

  let savedTotal = 0;

  for (const entry of OPTIMIZE) {
    const srcPath = join(PUBLIC_DIR, entry.src);
    const ext = entry.keepSuffix ? '.png' : '.webp';
    const destPath = join(outDir, entry.src.replace('.png', ext));

    try {
      let pipeline = sharp(srcPath).resize(entry.w, entry.h, { fit: 'inside' });

      const metadata = await sharp(srcPath).metadata();
      const originalSize = (await import('fs/promises')).stat(srcPath).then(s => s.size).catch(() => 0);

      if (entry.keepSuffix) {
        const quality = entry.quality || 85;
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        console.log(`  ${entry.src.padEnd(45)} PNG  q=${quality} → ${entry.w}x${entry.h}`);
      } else {
        pipeline = pipeline.webp({ quality: 85 });
        console.log(`  ${entry.src.padEnd(45)} WebP → ${entry.w}x${entry.h}`);
      }

      const dir = destPath.replace(/[/\\][^/\\]+$/, '');
      await mkdir(dir, { recursive: true });
      await pipeline.toFile(destPath);

      const newSize = (await import('fs/promises')).stat(destPath).then(s => s.size).catch(() => 0);
      const saved = originalSize - newSize;
      savedTotal += saved;
      console.log(`    ${(originalSize/1024).toFixed(0)} KB → ${(newSize/1024).toFixed(0)} KB (${(saved/1024).toFixed(0)} KB saved)`);
    } catch (err) {
      console.error(`  SKIP ${entry.src}: ${err.message}`);
    }
  }

  console.log(`\nTotal saved: ${(savedTotal/1024).toFixed(0)} KB (${(savedTotal/1024/1024).toFixed(2)} MB)`);
  console.log(`\nTo apply, move files from ${outDir} to the matching public/ directories with .webp extensions.`);
}

main().catch(console.error);
