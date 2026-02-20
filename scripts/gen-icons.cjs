const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '..', 'public', 'logo-icon.svg');
const svg = fs.readFileSync(svgPath);

const sizes = [192, 512];

async function generate() {
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, '..', 'public', `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(svg)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');
}

generate().catch(console.error);
