const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ICON_DIR = path.join(__dirname, "..", "public", "icons");
const SVG_PATH = path.join(ICON_DIR, "icon.svg");

const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  console.log("Generating ScanIQ icons...\n");

  // Ensure icon directory exists
  if (!fs.existsSync(ICON_DIR)) {
    fs.mkdirSync(ICON_DIR, { recursive: true });
  }

  for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;
    const outputPath = path.join(ICON_DIR, filename);

    try {
      await sharp(SVG_PATH)
        .resize(size, size)
        .png({ quality: 90 })
        .toFile(outputPath);
      console.log(`✓ ${filename}`);
    } catch (error) {
      console.error(`✗ ${filename}:`, error.message);
    }
  }

  // Generate shortcut icons (scan, generate, history)
  const shortcutIcons = [
    { name: "icon-scan.png", color: "#06b6d4" },
    { name: "icon-generate.png", color: "#8b5cf6" },
    { name: "icon-history.png", color: "#f59e0b" },
  ];

  for (const icon of shortcutIcons) {
    const outputPath = path.join(ICON_DIR, icon.name);
    try {
      // Create a simple colored icon with scanner symbol
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
          <rect width="192" height="192" rx="32" fill="${icon.color}"/>
          <g fill="none" stroke="white" stroke-width="10" stroke-linecap="round">
            <path d="M60 76v-16c0-6.6 5.4-12 12-12h16"/>
            <path d="M132 76v-16c0-6.6-5.4-12-12-12h-16"/>
            <path d="M60 116v16c0 6.6 5.4 12 12 12h16"/>
            <path d="M132 116v16c0 6.6-5.4 12-12 12h-16"/>
          </g>
          <rect x="84" y="84" width="24" height="24" rx="4" fill="white"/>
        </svg>
      `;

      await sharp(Buffer.from(svg))
        .resize(192, 192)
        .png()
        .toFile(outputPath);
      console.log(`✓ ${icon.name}`);
    } catch (error) {
      console.error(`✗ ${icon.name}:`, error.message);
    }
  }

  console.log("\nDone!");
}

generateIcons();
