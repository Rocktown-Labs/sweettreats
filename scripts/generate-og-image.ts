import sharp from "sharp";
import path from "node:path";

const width = 1200;
const height = 630;

const logoPath = path.resolve("apps/web/public/sweet-treats-logo.png");
const chocPath = path.resolve("apps/web/public/products/chocolate-chip-cookie.png");
const redVelvetPath = path.resolve("apps/web/public/products/red-velvet-cookie.png");

async function prepareCardImage(inputPath: string, w: number, h: number) {
  // Rounded top corners for card photo
  const resized = await sharp(inputPath).resize(w, h, { fit: "cover" }).toBuffer();

  const mask = Buffer.from(`
    <svg width="${w}" height="${h}">
      <rect width="${w}" height="${h}" rx="14" fill="#fff"/>
    </svg>
  `);

  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function main() {
  const logoBuffer = await sharp(logoPath).resize(110, 110).png().toBuffer();
  const cardImgW = 240;
  const cardImgH = 190;
  const chocImg = await prepareCardImage(chocPath, cardImgW, cardImgH);
  const redVelvetImg = await prepareCardImage(redVelvetPath, cardImgW, cardImgH);

  // SVG graphic overlay for typography and layout
  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFDF8" />
        <stop offset="50%" stop-color="#FFFBF2" />
        <stop offset="100%" stop-color="#FFF3DA" />
      </linearGradient>
      <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#241408" flood-opacity="0.16" />
      </filter>
      <filter id="pillShadow" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#241408" flood-opacity="0.10" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Outer Decorative Border -->
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="22" fill="none" stroke="#241408" stroke-width="4" stroke-opacity="0.95" />
    <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="16" fill="none" stroke="#F6C453" stroke-width="2.5" />

    <!-- LEFT COLUMN: Brand & Messaging -->
    <!-- Brand Tag -->
    <rect x="180" y="58" width="310" height="34" rx="17" fill="#241408" />
    <text x="335" y="80" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#F6C453" text-anchor="middle" letter-spacing="1.5">LITTLE ROCK'S COOKIE SHOP</text>

    <!-- Main Title -->
    <text x="180" y="136" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#241408" letter-spacing="-0.5">Sweet Treats LR</text>

    <!-- Tagline -->
    <text x="64" y="195" font-family="Georgia, serif" font-style="italic" font-size="25" fill="#B8731F">Order Today • Fresh Baked Cookies</text>

    <!-- Body Description -->
    <text x="64" y="245" font-family="system-ui, -apple-system, sans-serif" font-size="19" fill="#4A3423" font-weight="500">
      Thick, warm, golden cookies with brown butter, gourmet
    </text>
    <text x="64" y="272" font-family="system-ui, -apple-system, sans-serif" font-size="19" fill="#4A3423" font-weight="500">
      toppings, and dessert jars made fresh daily in Little Rock.
    </text>

    <!-- Pickup Location Info Badges -->
    <g transform="translate(64, 305)">
      <!-- Badge 1: Downtown -->
      <rect x="0" y="0" width="240" height="42" rx="12" fill="#FFFFFF" stroke="#EADBBF" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Pin icon -->
      <path d="M 22 14 C 18 14 15 17 15 21 C 15 27 22 34 22 34 C 22 34 29 27 29 21 C 29 17 26 14 22 14 Z M 22 23 C 20.9 23 20 22.1 20 21 C 20 19.9 20.9 19 22 19 C 23.1 19 24 19.9 24 21 C 24 22.1 23.1 23 22 23 Z" fill="#B8731F" />
      <text x="36" y="27" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#241408">Downtown Little Rock</text>

      <!-- Badge 2: West Little Rock -->
      <rect x="252" y="0" width="220" height="42" rx="12" fill="#FFFFFF" stroke="#EADBBF" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Pin icon -->
      <path d="M 274 14 C 270 14 267 17 267 21 C 267 27 274 34 274 34 C 274 34 281 27 281 21 C 281 17 278 14 274 14 Z M 274 23 C 272.9 23 272 22.1 272 21 C 272 19.9 272.9 19 274 19 C 275.1 19 276 19.9 276 21 C 276 22.1 275.1 23 274 23 Z" fill="#B8731F" />
      <text x="288" y="27" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#241408">West Little Rock</text>
    </g>

    <!-- Hours & Service Badge -->
    <g transform="translate(64, 362)">
      <rect x="0" y="0" width="240" height="40" rx="12" fill="#FFFFFF" stroke="#EADBBF" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Clock icon -->
      <circle cx="22" cy="20" r="8" fill="none" stroke="#B8731F" stroke-width="2"/>
      <polyline points="22,15 22,20 26,20" fill="none" stroke="#B8731F" stroke-width="2" stroke-linecap="round"/>
      <text x="38" y="25" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#241408">Hours: 11 AM – 11 PM</text>

      <rect x="252" y="0" width="220" height="40" rx="12" fill="#FFFFFF" stroke="#EADBBF" stroke-width="1.5" filter="url(#pillShadow)" />
      <!-- Sparkle/Cookie icon -->
      <text x="270" y="25" font-family="system-ui, sans-serif" font-size="15" fill="#B8731F">★</text>
      <text x="288" y="25" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#241408">Same-Day Pickup</text>
    </g>

    <!-- Trust Feature Bullets -->
    <g transform="translate(64, 422)">
      <text x="0" y="24" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#241408">✓ Multi-location pickup ordering with real-time availability</text>
      <text x="0" y="52" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#241408">✓ Rotating weekly menu: Brown Butter, Red Velvet, Crunch</text>
      <text x="0" y="80" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#241408">✓ Easy online checkout • Pay online or at pickup</text>
    </g>

    <!-- RIGHT COLUMN: PRODUCT SHOWCASE CARDS -->
    <!-- Card 1: Brown Butter Chocolate Chip -->
    <g transform="translate(605, 75)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="260" height="425" rx="16" fill="#FFFFFF" stroke="#241408" stroke-width="2.5" />
      <!-- Header inside card -->
      <text x="14" y="222" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#7C6F64" letter-spacing="1">TODAY'S BATCH</text>
      <text x="246" y="222" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#241408" text-anchor="end">$3.50</text>
      <text x="14" y="248" font-family="Georgia, serif" font-size="19" font-weight="bold" fill="#241408">Brown Butter</text>
      <text x="14" y="270" font-family="Georgia, serif" font-size="19" font-weight="bold" fill="#241408">Chocolate Chip</text>
      <text x="14" y="294" font-family="system-ui, sans-serif" font-size="12" fill="#6A5A4D">Thick golden cookie with</text>
      <text x="14" y="312" font-family="system-ui, sans-serif" font-size="12" fill="#6A5A4D">chopped chocolate middle.</text>
      <!-- Pill button -->
      <rect x="14" y="332" width="125" height="24" rx="12" fill="#EAF7EC" />
      <text x="22" y="348" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#2E7D32">● AVAILABLE TODAY</text>
      <rect x="14" y="370" width="232" height="38" rx="19" fill="#241408" />
      <text x="130" y="394" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF" text-anchor="middle">+ Add to Order</text>
    </g>

    <!-- Card 2: Red Velvet White Chip -->
    <g transform="translate(885, 75)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="260" height="425" rx="16" fill="#FFFFFF" stroke="#241408" stroke-width="2.5" />
      <!-- Header inside card -->
      <text x="14" y="222" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#7C6F64" letter-spacing="1">TODAY'S BATCH</text>
      <text x="246" y="222" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#241408" text-anchor="end">$4.00</text>
      <text x="14" y="248" font-family="Georgia, serif" font-size="19" font-weight="bold" fill="#241408">Red Velvet</text>
      <text x="14" y="270" font-family="Georgia, serif" font-size="19" font-weight="bold" fill="#241408">White Chip</text>
      <text x="14" y="294" font-family="system-ui, sans-serif" font-size="12" fill="#6A5A4D">Soft cocoa red velvet loaded</text>
      <text x="14" y="312" font-family="system-ui, sans-serif" font-size="12" fill="#6A5A4D">with white chocolate chips.</text>
      <!-- Pill button -->
      <rect x="14" y="332" width="125" height="24" rx="12" fill="#EAF7EC" />
      <text x="22" y="348" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#2E7D32">● AVAILABLE TODAY</text>
      <rect x="14" y="370" width="232" height="38" rx="19" fill="#241408" />
      <text x="130" y="394" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF" text-anchor="middle">+ Add to Order</text>
    </g>

    <!-- Bottom Footer Bar -->
    <rect x="36" y="546" width="${width - 72}" height="52" rx="12" fill="#241408" />
    <text x="64" y="578" font-family="Georgia, serif" font-style="italic" font-size="18" fill="#F6C453">
      “Don't cheat ya self, treat ya self”
    </text>
    <text x="${width - 64}" y="578" font-family="system-ui, sans-serif" font-size="17" font-weight="800" fill="#FFFFFF" text-anchor="end" letter-spacing="1">
      sweettreatslr.com
    </text>
  </svg>
  `;

  const finalImage = await sharp(Buffer.from(svgOverlay))
    .composite([
      { input: logoBuffer, top: 54, left: 56 },
      { input: chocImg, top: 85, left: 615 },
      { input: redVelvetImg, top: 85, left: 895 },
    ])
    .png()
    .toFile("apps/web/public/og-image.png");

  console.log("Generated og-image.png successfully:", finalImage);
}

main().catch(console.error);
