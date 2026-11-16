// Builds the website: fills in shared details, adds the shared header,
// footer and phone bar, and writes finished plain HTML files to dist/.
//   node build.js            build once
//   node build.js --watch    build, then rebuild whenever you save a file

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PAGES = path.join(ROOT, "pages");
const PARTIALS = path.join(ROOT, "partials");
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");

// ---------- helpers ----------
function loadSite() {
  try {
    const site = JSON.parse(
      fs.readFileSync(path.join(ROOT, "site.json"), "utf8"),
    );
    site.year = String(new Date().getFullYear());
    return site;
  } catch (error) {
    console.error("Could not read site.json:", error.message);
    console.error(
      "Check for a missing comma or an extra comma on the last line.",
    );
    return null;
  }
}

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

function buildPage(source, pageFile, partials, site, problems) {
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
    if (key === "schema") return makeSchema(site, problems, pageFile);
    if (key === "wa") return `https://wa.me/${site.whatsapp}`;
    if (key in site) return escapeHtml(site[key]);
    problems.push(`${pageFile}: unknown token ${match}`);
    return match;
  });

  return html;
}

// ---------- local business structured data (JSON-LD) ----------
function to24h(hour, minute, meridiem) {
  let h = Number(hour) % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// reads the town names from public/areas-data.js, so there is one list only
function readTowns() {
  try {
    const text = fs.readFileSync(path.join(PUBLIC, "areas-data.js"), "utf8");
    const areas = new Function(`${text}; return AREAS;`)();
    return areas.map((area) => area.town);
  } catch (error) {
    return [];
  }
}

function makeSchema(site, problems, pageFile) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.businessName,
    url: site.siteUrl,
    telephone: site.phoneTel,
    email: site.email,
    description: site.description,
    address: { "@type": "PostalAddress", addressCountry: "KE" },
  };

  const towns = readTowns();
  if (towns.length > 0) {
    data.areaServed = towns.map((name) => ({ "@type": "City", name }));
  }

  // "7:00am to 6:00pm" -> opens 07:00, closes 18:00
  const hours = String(site.hoursWeekdays).match(
    /(\d{1,2}):(\d{2})\s*(am|pm)\s*to\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,
  );
  if (hours) {
    data.openingHoursSpecification = [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: to24h(hours[1], hours[2], hours[3]),
        closes: to24h(hours[4], hours[5], hours[6]),
      },
    ];
  } else {
    problems.push(
      `${pageFile}: could not read hoursWeekdays ("${site.hoursWeekdays}"). Use a form like "7:00am to 6:00pm".`,
    );
  }

  // the < is escaped so nothing inside the data can close the script tag
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n    </script>`;
}

// ---------- sitemap.xml and robots.txt ----------
let warnedAboutPlaceholder = false;

function writeSearchFiles(site, pageFiles) {
  const base = site.siteUrl.replace(/\/+$/, "");

  if (base.includes("example") && !warnedAboutPlaceholder) {
    console.warn(
      "Note: siteUrl in site.json is still a placeholder. Set the real address before launch.",
    );
    warnedAboutPlaceholder = true;
  }

  // home page first, then the rest in alphabetical order
  const urls = [...pageFiles]
    .sort((a, b) =>
      a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b),
    )
    .map((file) => (file === "index.html" ? `${base}/` : `${base}/${file}`));

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(DIST, "robots.txt"), robots);
}

// ---------- one full build; returns true when there were no problems ----------
function build() {
  const site = loadSite();
  if (!site) return false;

  for (const folder of [PAGES, PARTIALS, PUBLIC]) {
    if (!fs.existsSync(folder)) {
      console.error(`Missing folder: ${path.relative(ROOT, folder)}/`);
      return false;
    }
  }

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
    const output = buildPage(source, pageFile, partials, site, problems);
    fs.writeFileSync(path.join(DIST, pageFile), output);
  }

  writeSearchFiles(site, pageFiles);

  if (problems.length > 0) {
    console.error("\nBuild finished with problems:");
    problems.forEach((problem) => console.error(`  - ${problem}`));
    return false;
  }

  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] Built ${pageFiles.length} pages into dist/`);
  return true;
}

// ---------- watch mode ----------
function listFolders(folder) {
  const folders = [folder];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      folders.push(...listFolders(path.join(folder, entry.name)));
    }
  }
  return folders;
}

function watch() {
  let timer;

  // wait a moment so several quick saves cause only one rebuild
  function rebuildSoon(changed) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\nChanged: ${changed}`);
      build();
    }, 150);
  }

  for (const root of [PAGES, PARTIALS, PUBLIC]) {
    for (const folder of listFolders(root)) {
      fs.watch(folder, (event, filename) => rebuildSoon(filename || folder));
    }
  }

  // site.json lives in the project root; ignore everything else there
  fs.watch(ROOT, (event, filename) => {
    if (filename === "site.json") rebuildSoon("site.json");
  });

  console.log(
    "Watching pages/, partials/, public/ and site.json. Press Ctrl+C to stop.",
  );
}

// ---------- run ----------
const ok = build();

if (process.argv.includes("--watch")) {
  // keep going even if the first build had problems, so you can fix them
  watch();
} else if (!ok) {
  process.exit(1);
}
