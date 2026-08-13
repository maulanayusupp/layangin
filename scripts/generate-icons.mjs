/**
 * Rasterises the brand SVGs in `brand/` into every icon the site references.
 *
 * Run with `pnpm icons` after editing any file in `brand/`. The output is
 * committed to the repository on purpose: deployments then need neither `sharp`
 * nor a build step for images, and the icons cannot silently change between
 * environments.
 *
 * Outputs (all under `public/`):
 *   favicon.ico                 16/32/48 multi-size, for legacy tabs and bookmarks
 *   icons/favicon.svg           vector tab icon, preferred by modern browsers
 *   icons/favicon-16.png        fallback tab icon
 *   icons/favicon-32.png        fallback tab icon
 *   icons/apple-touch-icon.png  180×180, iOS home screen (no transparency allowed)
 *   icons/icon-192.png          PWA manifest
 *   icons/icon-512.png          PWA manifest
 *   icons/maskable-512.png      PWA manifest, safe-area padded
 *   og-image.png                1200×630 social card
 *   site.webmanifest            manifest referencing the icons above
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brandDir = resolve(root, 'brand')
const publicDir = resolve(root, 'public')
const iconsDir = resolve(publicDir, 'icons')

/** Background used wherever transparency is not allowed (iOS, OG card). */
const GROUND = { r: 10, g: 15, b: 31, alpha: 1 }

async function render(sourceSvg, size, outputPath, { flatten = false } = {}) {
  let pipeline = sharp(sourceSvg, { density: 384 }).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })

  if (flatten) pipeline = pipeline.flatten({ background: GROUND })

  await pipeline.png({ compressionLevel: 9 }).toFile(outputPath)
  return outputPath
}

/**
 * Social card. Composited rather than drawn as one SVG so the wordmark text uses
 * a real font metric from a rendered SVG instead of guessing at kerning.
 */
async function renderOgImage(iconSvg) {
  const width = 1200
  const height = 630

  const backdrop = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stop-color="#06090F"/>
          <stop offset="0.55" stop-color="#0D1430"/>
          <stop offset="1" stop-color="#2A1330"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.78" cy="0.9" r="0.6">
          <stop offset="0" stop-color="#FF6A2B" stop-opacity="0.4"/>
          <stop offset="1" stop-color="#FF6A2B" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      <g font-family="Helvetica, Arial, sans-serif" fill="#EDF1FF">
        <text x="96" y="300" font-size="104" font-weight="700" letter-spacing="-3">Layangin</text>
        <text x="96" y="366" font-size="36" fill="#B6C0DE">Indonesian kite-fighting arena</text>
        <text x="96" y="430" font-size="26" fill="#FF9662" letter-spacing="3">CROSS LINES. CUT FIRST.</text>
      </g>
      <rect x="96" y="470" width="120" height="4" fill="#FF6A2B"/>
    </svg>
  `)

  const markSize = 340
  const mark = await sharp(iconSvg, { density: 384 })
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp(backdrop)
    .composite([{ input: mark, left: width - markSize - 96, top: (height - markSize) / 2 }])
    .flatten({ background: GROUND })
    .png({ compressionLevel: 9 })
    .toFile(resolve(publicDir, 'og-image.png'))
}

async function writeManifest() {
  const manifest = {
    name: 'Layangin — kite-fighting arena',
    short_name: 'Layangin',
    description:
      'A browser kite-fighting game. Fly a simulated kite, cross lines with an opponent, and cut theirs first.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0A0F1F',
    theme_color: '#0A0F1F',
    categories: ['games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  await writeFile(
    resolve(publicDir, 'site.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  const iconSvg = resolve(brandDir, 'icon.svg')
  const faviconSvg = resolve(brandDir, 'favicon.svg')

  // The vector favicon is served as-is; modern browsers prefer it.
  await writeFile(resolve(iconsDir, 'favicon.svg'), await readFile(faviconSvg, 'utf8'), 'utf8')

  const ico16 = await render(faviconSvg, 16, resolve(iconsDir, 'favicon-16.png'))
  const ico32 = await render(faviconSvg, 32, resolve(iconsDir, 'favicon-32.png'))
  const ico48 = await render(faviconSvg, 48, resolve(iconsDir, 'favicon-48.png'))

  // iOS renders the icon on an opaque tile and does not honour transparency.
  await render(iconSvg, 180, resolve(iconsDir, 'apple-touch-icon.png'), { flatten: true })

  await render(iconSvg, 192, resolve(iconsDir, 'icon-192.png'))
  await render(iconSvg, 512, resolve(iconsDir, 'icon-512.png'))
  // icon.svg already reserves the ~20% safe margin a maskable icon requires.
  await render(iconSvg, 512, resolve(iconsDir, 'maskable-512.png'))

  await writeFile(resolve(publicDir, 'favicon.ico'), await pngToIco([ico16, ico32, ico48]))

  await renderOgImage(iconSvg)
  await writeManifest()

  console.log('Icons written to public/icons, public/favicon.ico, public/og-image.png')
}

main().catch((error) => {
  console.error('Icon generation failed:', error)
  process.exitCode = 1
})
