/**
 * Generates square PWA icons from public/logo.png using sharp.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';

const LOGO = 'public/logo.png';
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const GREEN = { r: 27, g: 122, b: 54, alpha: 1 }; // brand #1B7A36

async function make(size, out, bg, pad) {
  const inner = Math.round(size * (1 - pad));
  const logo = await sharp(LOGO)
    .resize(inner, inner, { fit: 'contain', background: bg })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

await make(192, 'public/pwa-192x192.png', WHITE, 0.12);
await make(512, 'public/pwa-512x512.png', WHITE, 0.12);
await make(512, 'public/pwa-maskable-512x512.png', GREEN, 0.25);
await make(180, 'public/apple-touch-icon.png', WHITE, 0.12);
console.log('Done.');
