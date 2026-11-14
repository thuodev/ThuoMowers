// Builds the website: fills in shared details, adds the shared header,
// footer and phone bar, and writes finished plain HTML files to dist/.
// Run it with:  node build.js

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PAGES = path.join(ROOT, "pages");
const PARTIALS = path.join(ROOT, "partials");
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");

// ---------- load the shared details ----------
let site;
try {
  site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));
} catch (error) {
  console.error("Could not read site.json:", error.message);
  console.error(
    "Check for a missing comma or an extra comma on the last line.",
  );
  process.exit(1);
}
site.year = String(new Date().getFullYear());

// ---------- check the folders exist ----------
for (const folder of [PAGES, PARTIALS, PUBLIC]) {
  if (!fs.existsSync(folder)) {
    console.error(`Missing folder: ${path.relative(ROOT, folder)}/`);
    process.exit(1);
  }
}

// ---------- helpers ----------
// so a value like "Fix & Mow" can't break the HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readPartials() {
  const partials = {};
  for (const file of fs.readdirSync(PARTIALS)) {
    if (file.endsWith(".html")) {
      const name = file.replace(/\.html$/, "");
      partials[name] = fs.readFileSync(path.join(PARTIALS, file), "utf8");
    }
  }
  return partials;
}

// adds aria-current="page" to this page's link in the navbar
// (starts after the logo, so "index.html" doesn't match the logo link)
function markCurrentPage(header, pageFile) {
  const start = header.indexOf('class="navbar-links"');
  if (start === -1) return header;

  const before = header.slice(0, start);
  const after = header
    .slice(start)
    .replace(
      `<a href="${pageFile}"`,
      `<a aria-current="page" href="${pageFile}"`,
    );
  return before + after;
}

function buildPage(source, pageFile, partials, problems) {
  // 1. {{> header}}, {{> footer}}, {{> contact-bar}}
  let html = source.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (match, name) => {
    if (!(name in partials)) {
      problems.push(`${pageFile}: no partial called "${name}"`);
      return match;
    }
    return name === "header"
      ? markCurrentPage(partials[name], pageFile)
      : partials[name];
  });

  // 2. {{wa:Some message}} -> WhatsApp link with the message filled in
  html = html.replace(
    /\{\{wa:([^}]*)\}\}/g,
    (match, text) =>
      `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text.trim())}`,
  );

  // 3. {{wa}} and {{anyKeyFromSiteJson}}
  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === "wa") return `https://wa.me/${site.whatsapp}`;
    if (key in site) return escapeHtml(site[key]);
    problems.push(`${pageFile}: unknown token ${match}`);
    return match;
  });

  return html;
}

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });

const partials = readPartials();
const problems = [];
// fill tokens in script.js too, e.g. {{whatsapp}}
const scriptPath = path.join(DIST, "script.js");
if (fs.existsSync(scriptPath)) {
  const filled = fs
    .readFileSync(scriptPath, "utf8")
    .replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in site) return site[key];
      problems.push(`script.js: unknown token ${match}`);
      return match;
    });
  fs.writeFileSync(scriptPath, filled);
}
const pageFiles = fs
  .readdirSync(PAGES)
  .filter((file) => file.endsWith(".html"));

for (const pageFile of pageFiles) {
  const source = fs.readFileSync(path.join(PAGES, pageFile), "utf8");
  const output = buildPage(source, pageFile, partials, problems);
  fs.writeFileSync(path.join(DIST, pageFile), output);
}

if (problems.length > 0) {
  console.error("\nBuild finished with problems:");
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exitCode = 1;
} else {
  console.log(`Built ${pageFiles.length} pages into dist/`);
}
