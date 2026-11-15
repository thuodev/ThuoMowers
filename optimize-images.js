// Turns photos into website-ready WebP files.
//
//   1. Drop photos (jpg, png, webp) into the incoming/ folder
//   2. Run:  npm run images
//   3. Finished files appear in public/images/, and the originals are
//      moved to originals/ so they stay out of the website.
//
// Options:  npm run images -- --width=1000 --quality=75
//   --width    longest side in pixels (default 1200; use 1600 for a hero photo)
//   --quality  1-100 (default 78)

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = __dirname;
const INCOMING = path.join(ROOT, "incoming");
const OUTPUT = path.join(ROOT, "public", "images");
const ORIGINALS = path.join(ROOT, "originals");

// read --width=... and --quality=...
function option(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split("=")[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const maxSize = option("width", 1200);
const quality = Math.min(option("quality", 78), 100);

// "My Photo (2).JPG" -> "my-photo-2"
function slugify(filename) {
  return path
    .parse(filename)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  fs.mkdirSync(INCOMING, { recursive: true });
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.mkdirSync(ORIGINALS, { recursive: true });

  const files = fs
    .readdirSync(INCOMING)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file));

  if (files.length === 0) {
    console.log("Nothing to do. Put photos in incoming/ and run again.");
    return;
  }

  for (const file of files) {
    const input = path.join(INCOMING, file);
    const name = slugify(file);
    const output = path.join(OUTPUT, `${name}.webp`);

    await sharp(input)
      .rotate() // respects the phone's orientation
      .resize({
        width: maxSize,
        height: maxSize,
        fit: "inside", // longest side = maxSize, keeps proportions
        withoutEnlargement: true, // never blows small photos up
      })
      .webp({ quality })
      .toFile(output);

    const { width, height } = await sharp(output).metadata();
    const before = fs.statSync(input).size;
    const after = fs.statSync(output).size;

    console.log(`${file}  ->  images/${name}.webp`);
    console.log(
      `   ${kb(before)} -> ${kb(after)}   use: width="${width}" height="${height}"`,
    );

    // keep the original, out of the website
    fs.renameSync(input, path.join(ORIGINALS, file));
  }

  console.log(`\nDone. Originals moved to originals/.`);
}

main().catch((error) => {
  console.error("Image conversion failed:", error.message);
  process.exit(1);
});
