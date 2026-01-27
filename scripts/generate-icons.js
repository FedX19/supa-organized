const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// SVG content for the icon - black background with orange folder stack
const svgTemplate = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid black background -->
  <rect width="${size}" height="${size}" fill="#0a0a0a"/>

  <!-- Stacked folders icon - properly centered with ~25% margins -->
  <g transform="translate(${size * 0.25}, ${size * 0.22}) scale(${size / 180})">
    <!-- Back folder (most transparent) -->
    <rect x="0" y="8" width="50" height="60" rx="6" fill="#f59e0b" opacity="0.25"/>

    <!-- Middle folder -->
    <rect x="20" y="16" width="50" height="60" rx="6" fill="#f59e0b" opacity="0.5"/>

    <!-- Front folder (solid) -->
    <rect x="40" y="24" width="50" height="60" rx="6" fill="#f59e0b"/>

    <!-- Plus icon on front folder -->
    <circle cx="65" cy="54" r="10" fill="white"/>
    <path d="M 60 54 L 70 54 M 65 49 L 65 59" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>
`;

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const svg = svgTemplate(size);
    const outputPath = path.join(publicDir, name);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      console.log(`Generated: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`Error generating ${name}:`, error.message);
    }
  }

  console.log('\nDone! Icons generated in /public/');
}

generateIcons();
