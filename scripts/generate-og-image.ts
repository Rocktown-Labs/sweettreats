import sharp from "sharp";
import path from "node:path";

const width = 1200;
const height = 630;

const logoPath = path.resolve("apps/web/public/sweet-treats-logo.png");

async function main() {
  const logoBuffer = await sharp(logoPath).resize(170, 170).png().toBuffer();

  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFDF7" />
        <stop offset="40%" stop-color="#FFFBF0" />
        <stop offset="100%" stop-color="#FDF1D6" />
      </linearGradient>

      <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#F6C453" />
        <stop offset="100%" stop-color="#EDB338" />
      </linearGradient>

      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="100%" stop-color="#FCF8EF" />
      </linearGradient>

      <filter id="shadowHeavy" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#241408" flood-opacity="0.14" />
      </filter>

      <filter id="shadowPill" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#241408" flood-opacity="0.08" />
      </filter>
    </defs>

    <!-- Warm Canvas Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Subtle Polka / Flour Dappling Pattern -->
    <g opacity="0.06" fill="#241408">
      <circle cx="80" cy="80" r="3" />
      <circle cx="160" cy="120" r="2" />
      <circle cx="240" cy="70" r="3.5" />
      <circle cx="340" cy="140" r="2.5" />
      <circle cx="480" cy="90" r="3" />
      <circle cx="620" cy="130" r="2" />
      <circle cx="760" cy="80" r="3.5" />
      <circle cx="900" cy="120" r="2.5" />
      <circle cx="1040" cy="70" r="3" />
      <circle cx="1120" cy="130" r="2.5" />

      <circle cx="100" cy="520" r="3" />
      <circle cx="220" cy="550" r="2.5" />
      <circle cx="380" cy="510" r="3.5" />
      <circle cx="540" cy="560" r="2" />
      <circle cx="700" cy="510" r="3" />
      <circle cx="860" cy="550" r="2.5" />
      <circle cx="1000" cy="500" r="3.5" />
      <circle cx="1110" cy="540" r="2" />
    </g>

    <!-- Outer Decorative Framing Border -->
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="24" fill="none" stroke="#241408" stroke-width="4.5" />
    <rect x="34" y="34" width="${width - 68}" height="${height - 68}" rx="18" fill="none" stroke="#F6C453" stroke-width="2.5" />

    <!-- Center Card Hero Panel -->
    <rect x="70" y="70" width="${width - 140}" height="${height - 140}" rx="20" fill="url(#cardGrad)" stroke="#EEDCC4" stroke-width="1.5" filter="url(#shadowHeavy)" />

    <!-- Content Area (Centered Layout) -->
    <!-- Brand Title -->
    <text x="600" y="278" font-family="'Fraunces', Georgia, serif" font-size="58" font-weight="900" fill="#241408" text-anchor="middle" letter-spacing="-1.5">
      Sweet Treats LR
    </text>

    <!-- Tagline Banner Pill: Cookies, Cakes, Shakes & More -->
    <g transform="translate(325, 308)">
      <rect width="550" height="54" rx="27" fill="url(#badgeGrad)" stroke="#241408" stroke-width="2.5" filter="url(#shadowPill)" />
      <text x="275" y="36" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="900" fill="#241408" text-anchor="middle" letter-spacing="0.5">
        COOKIES • CAKES • SHAKES &amp; MORE
      </text>
    </g>

    <!-- Region / Location Subtitle -->
    <text x="600" y="405" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="700" fill="#755635" text-anchor="middle" letter-spacing="0.2">
      Little Rock &amp; North Little Rock • Central Arkansas
    </text>

    <!-- Feature Pills Row -->
    <g transform="translate(140, 436)">
      <!-- Pill 1: Fresh-Baked Daily -->
      <g transform="translate(0, 0)">
        <rect width="210" height="42" rx="21" fill="#FFFDF8" stroke="#DCC5A3" stroke-width="1.5" />
        <text x="105" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="14.5" font-weight="700" fill="#241408" text-anchor="middle">
          ✨ Fresh-Baked Daily
        </text>
      </g>

      <!-- Pill 2: Custom Cakes & Jars -->
      <g transform="translate(230, 0)">
        <rect width="220" height="42" rx="21" fill="#FFFDF8" stroke="#DCC5A3" stroke-width="1.5" />
        <text x="110" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="14.5" font-weight="700" fill="#241408" text-anchor="middle">
          🎂 Custom Cakes &amp; Jars
        </text>
      </g>

      <!-- Pill 3: Signature Shakes -->
      <g transform="translate(470, 0)">
        <rect width="200" height="42" rx="21" fill="#FFFDF8" stroke="#DCC5A3" stroke-width="1.5" />
        <text x="100" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="14.5" font-weight="700" fill="#241408" text-anchor="middle">
          🥤 Signature Shakes
        </text>
      </g>

      <!-- Pill 4: Order Ahead Pickup -->
      <g transform="translate(690, 0)">
        <rect width="230" height="42" rx="21" fill="#FFFDF8" stroke="#DCC5A3" stroke-width="1.5" />
        <text x="115" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="14.5" font-weight="700" fill="#241408" text-anchor="middle">
          📍 Order Ahead for Pickup
        </text>
      </g>
    </g>

    <!-- Bottom Brand Bar -->
    <g transform="translate(0, 508)">
      <line x1="120" y1="0" x2="1080" y2="0" stroke="#EAD8BF" stroke-width="1.2" />
      <text x="300" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#241408">
        🌐 sweettreatslr.com
      </text>
      <text x="600" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#E07A5F" text-anchor="middle">
        Pickup Across Central Arkansas
      </text>
      <text x="900" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#241408" text-anchor="end">
        📸 @sweettreatslr
      </text>
    </g>
  </svg>
  `;

  // Composite: Background canvas + logo centered at top (x: 515, y: 92) + SVG overlay
  const logoTop = 92;
  const logoLeft = Math.round((width - 170) / 2); // 515

  const result = await sharp(Buffer.from(svgOverlay))
    .composite([
      {
        input: logoBuffer,
        top: logoTop,
        left: logoLeft,
      },
    ])
    .png({ quality: 95 })
    .toFile(path.resolve("apps/web/public/og-image.png"));

  console.log("Generated clean static og-image.png successfully:", result);
}

main().catch(console.error);
