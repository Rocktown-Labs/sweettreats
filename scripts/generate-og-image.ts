import sharp from "sharp";
import path from "node:path";

const width = 1200;
const height = 630;

const bgPath = path.resolve("scripts/assets/bakery-hero.jpg");
const logoPath = path.resolve("apps/web/public/sweet-treats-logo.png");
const outputPath = path.resolve("apps/web/public/og-image.png");

async function main() {
  // 1. Process background: Cover crop right-aligned so cookies stay completely visible
  const bgBuffer = await sharp(bgPath)
    .resize(width, height, { fit: "cover", position: "right" })
    .png()
    .toBuffer();

  // 2. Process logo: 92x92 circular avatar with sharp lanczos3 interpolation
  const logoSize = 92;
  const logoBuffer = await sharp(logoPath)
    .resize(logoSize, logoSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const cardX = 40;
  const cardY = 38;
  const cardW = 505;
  const cardH = 554;

  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Dual-layer drop shadow for luxury physical card feel -->
      <filter id="cardShadow" x="-12%" y="-12%" width="130%" height="130%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#140902" flood-opacity="0.35" />
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#140902" flood-opacity="0.18" />
      </filter>

      <filter id="pillShadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#241408" flood-opacity="0.07" />
      </filter>

      <!-- Warm cream card gradient -->
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFDF9" stop-opacity="0.98" />
        <stop offset="50%" stop-color="#FFFBF4" stop-opacity="0.98" />
        <stop offset="100%" stop-color="#FCF5E8" stop-opacity="0.99" />
      </linearGradient>

      <!-- Honey gold pill gradient -->
      <linearGradient id="goldPill" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#F6C453" />
        <stop offset="100%" stop-color="#EAA824" />
      </linearGradient>

      <!-- Soft vignette on left edge for balanced contrast -->
      <linearGradient id="leftFade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#140902" stop-opacity="0.32" />
        <stop offset="42%" stop-color="#140902" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#140902" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Edge vignette -->
    <rect width="${width}" height="${height}" fill="url(#leftFade)" />

    <!-- Frosted Editorial Card on Left -->
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24"
          fill="url(#cardBg)" stroke="#EAD8BF" stroke-width="2" filter="url(#cardShadow)" />

    <!-- Inner gold hairline border -->
    <rect x="${cardX + 8}" y="${cardY + 8}" width="${cardW - 16}" height="${cardH - 16}" rx="18"
          fill="none" stroke="#F6C453" stroke-width="1.2" stroke-opacity="0.55" />

    <!-- CARD CONTENT -->

    <!-- Header Lockup: Text starts to the right of logo -->
    <!-- Logo will be composited at (cardX + 24, cardY + 24) = (64, 62) -->
    <g transform="translate(${cardX + 126}, ${cardY + 34})">
      <!-- Eyebrow Pill -->
      <rect x="0" y="0" width="206" height="22" rx="11" fill="#241408" />
      <text x="103" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="10" font-weight="800" fill="#F6C453" text-anchor="middle" letter-spacing="1.3">
        LITTLE ROCK'S COOKIE SHOP
      </text>

      <!-- Brand Name -->
      <text x="0" y="54" font-family="Georgia, serif" font-size="34" font-weight="bold" fill="#241408" letter-spacing="-0.5">
        Sweet Treats LR
      </text>

      <!-- Tagline -->
      <text x="0" y="76" font-family="Georgia, serif" font-style="italic" font-size="14.5" fill="#B8731F">
        “Don't cheat ya self, treat ya self”
      </text>
    </g>

    <!-- Decorative Divider Line -->
    <line x1="${cardX + 26}" y1="${cardY + 132}" x2="${cardX + cardW - 26}" y2="${cardY + 132}" stroke="#EEDDC7" stroke-width="1.5" />

    <!-- Main Value Headline -->
    <g transform="translate(${cardX + 26}, ${cardY + 164})">
      <text x="0" y="0" font-family="Georgia, serif" font-size="25" font-weight="bold" fill="#241408">
        Warm, Fresh-Baked Cookies
      </text>
      <text x="0" y="25" font-family="Georgia, serif" font-size="20" font-style="italic" fill="#8C5C26">
        &amp; Handcrafted Sweet Treats
      </text>

      <text x="0" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14.5" fill="#5A4330" font-weight="500">
        Brown butter chocolate chip, red velvet cream cheese,
      </text>
      <text x="0" y="78" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14.5" fill="#5A4330" font-weight="500">
        snickerdoodles, and signature dessert jars made daily.
      </text>
    </g>

    <!-- Feature Row 1: Pickup Locations -->
    <g transform="translate(${cardX + 26}, ${cardY + 278})">
      <rect x="0" y="0" width="${cardW - 52}" height="46" rx="12" fill="#FFFFFF" stroke="#E6D4BE" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Pin icon SVG -->
      <path d="M 22 13 C 17.5 13 14 16.5 14 21 C 14 27 22 34 22 34 C 22 34 30 27 30 21 C 30 16.5 26.5 13 22 13 Z M 22 23 C 20.9 23 20 22.1 20 21 C 20 19.9 20.9 19 22 19 C 23.1 19 24 19.9 24 21 C 24 22.1 23.1 23 22 23 Z" fill="#B8731F" />
      <text x="38" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14" font-weight="700" fill="#241408">
        Little Rock &amp; North Little Rock Pickup
      </text>
    </g>

    <!-- Feature Row 2: Same-day Ordering -->
    <g transform="translate(${cardX + 26}, ${cardY + 334})">
      <rect x="0" y="0" width="${cardW - 52}" height="46" rx="12" fill="#FFFFFF" stroke="#E6D4BE" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Clock icon SVG -->
      <circle cx="22" cy="23" r="8.5" fill="none" stroke="#B8731F" stroke-width="2"/>
      <polyline points="22,18 22,23 26.5,23" fill="none" stroke="#B8731F" stroke-width="2" stroke-linecap="round"/>
      <text x="38" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14" font-weight="700" fill="#241408">
        Order Ahead Online • Same-Day Pickup
      </text>
    </g>

    <!-- Feature Row 3: Rotating Batch Flavors -->
    <g transform="translate(${cardX + 26}, ${cardY + 390})">
      <rect x="0" y="0" width="${cardW - 52}" height="46" rx="12" fill="#FFFFFF" stroke="#E6D4BE" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Sparkle Star SVG -->
      <path d="M 22 15 L 23.8 19.5 L 28.5 20.2 L 25 23.5 L 26 28 L 22 25.5 L 18 28 L 19 23.5 L 15.5 20.2 L 20.2 19.5 Z" fill="#B8731F" />
      <text x="38" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="14" font-weight="700" fill="#241408">
        Fresh Daily Batches • Custom Orders Available
      </text>
    </g>

    <!-- CTA Button / Footer Bar -->
    <g transform="translate(${cardX + 26}, ${cardY + 458})">
      <rect x="0" y="0" width="${cardW - 52}" height="56" rx="16" fill="#241408" filter="url(#pillShadow)" />
      <text x="28" y="34" font-family="Georgia, serif" font-style="italic" font-size="18" fill="#F6C453">
        Order Today Online
      </text>
      <!-- Pill badge on right of CTA button -->
      <rect x="${cardW - 52 - 188}" y="10" width="176" height="36" rx="18" fill="url(#goldPill)" />
      <text x="${cardW - 52 - 100}" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="13.5" font-weight="800" fill="#241408" text-anchor="middle" letter-spacing="0.3">
        sweettreatslr.com →
      </text>
    </g>

    <!-- Top-Right Floating Bakery Badge -->
    <g transform="translate(${width - 220}, 34)">
      <rect x="0" y="0" width="184" height="38" rx="19" fill="#241408" fill-opacity="0.88" stroke="#F6C453" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Sparkle star -->
      <path d="M 22 14 L 23.5 18 L 27.5 18.5 L 24.5 21.5 L 25.5 25.5 L 22 23.5 L 18.5 25.5 L 19.5 21.5 L 16.5 18.5 L 20.5 18 Z" fill="#F6C453" />
      <text x="36" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            font-size="11.5" font-weight="800" fill="#FFFFFF" letter-spacing="1">
        BAKED IN LITTLE ROCK
      </text>
    </g>
  </svg>
  `;

  const compositeImages = [
    { input: bgBuffer, top: 0, left: 0 },
    { input: Buffer.from(svgOverlay), top: 0, left: 0 },
    {
      input: logoBuffer,
      top: cardY + 26,
      left: cardX + 22,
    },
  ];

  const result = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(compositeImages)
    .png({ quality: 96 })
    .toFile(outputPath);

  console.log("Generated premium bakery og-image.png successfully:", result);
}

main().catch(console.error);
