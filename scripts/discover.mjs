// Finds company job boards hosted on Greenhouse, Lever and Ashby.
// Sources: seeds/boards.txt (hand-picked), data/boards.json (previous runs),
// and the public Common Crawl URL index, which lists career-page URLs it has seen.
// Output: data/boards.json  { greenhouse: [...], lever: [...], ashby: [...], updatedAt }
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "data", "boards.json");
const UA = process.env.USER_AGENT || "MinervaJobFeed/0.1 (+https://github.com)";
const CRAWLS = Number(process.env.CC_CRAWLS || 2);          // how many recent crawls to read
const MAX_PAGES = Number(process.env.CC_MAX_PAGES || 40);   // index pages per domain per crawl

const PATTERNS = [
  { ats: "greenhouse", url: "boards.greenhouse.io/*" },
  { ats: "greenhouse", url: "job-boards.greenhouse.io/*" },
  { ats: "lever", url: "jobs.lever.co/*" },
  { ats: "ashby", url: "jobs.ashbyhq.com/*" },
];
const RESERVED = new Set(["embed", "v1", "api", "static", "assets", "favicon.ico", "robots.txt", "sitemap.xml", "jobs", "job_app", "boards", "search", "_next", "cdn-cgi"]);

export function slugFromUrl(ats, raw) {
  let u;
  try { u = new URL(raw.startsWith("http") ? raw : "https://" + raw); } catch { return null; }
  if (ats === "greenhouse") {
    const forParam = u.searchParams.get("for");               // boards.greenhouse.io/embed/job_board?for=acme
    if (forParam) return clean(forParam);
  }
  const seg = u.pathname.split("/").filter(Boolean)[0];
  return seg ? clean(seg) : null;
}
function clean(s) {
  s = decodeURIComponent(s).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/.test(s) || RESERVED.has(s)) return null;
  return s;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getText(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA } });
      if (r.ok) return await r.text();
      if (r.status === 404) return "";
    } catch {}
    await sleep(1500 * (i + 1));
  }
  return "";
}

async function fromCommonCrawl(found) {
  const info = await getText("https://index.commoncrawl.org/collinfo.json");
  if (!info) { console.log("Common Crawl index unavailable; skipping."); return; }
  const crawls = JSON.parse(info).slice(0, CRAWLS);
  for (const c of crawls) {
    for (const p of PATTERNS) {
      const base = `${c["cdx-api"]}?url=${encodeURIComponent(p.url)}&output=json&fl=url&filter=status:200`;
      const meta = await getText(base + "&showNumPages=true");
      let pages = 1;
      try { pages = JSON.parse(meta).pages || 1; } catch {}
      pages = Math.min(pages, MAX_PAGES);
      let added = 0;
      for (let pg = 0; pg < pages; pg++) {
        const body = await getText(`${base}&page=${pg}`);
        for (const line of body.split("\n")) {
          if (!line) continue;
          try { const s = slugFromUrl(p.ats, JSON.parse(line).url); if (s && !found[p.ats].has(s)) { found[p.ats].add(s); added++; } } catch {}
        }
        await sleep(400); // be gentle with the free index
      }
      console.log(`${c.id} ${p.url}: ${pages} pages, +${added} boards`);
    }
  }
}

export async function loadSeeds() {
  const found = { greenhouse: new Set(), lever: new Set(), ashby: new Set() };
  try {
    const txt = await fs.readFile(path.join(ROOT, "seeds", "boards.txt"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.trim().match(/^(greenhouse|lever|ashby):([a-z0-9._-]+)/i);
      if (m) found[m[1].toLowerCase()].add(m[2].toLowerCase());
    }
  } catch {}
  try {
    const prev = JSON.parse(await fs.readFile(OUT, "utf8"));
    for (const k of Object.keys(found)) (prev[k] || []).forEach(s => found[k].add(s));
    for (const k of Object.keys(found)) (prev.dead?.[k] || []).forEach(s => found[k].delete(s));
  } catch {}
  return found;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const found = await loadSeeds();
  if (process.env.SKIP_CRAWL !== "1") await fromCommonCrawl(found);
  let dead = {};
  try { dead = JSON.parse(await fs.readFile(OUT, "utf8")).dead || {}; } catch {}
  const out = { updatedAt: new Date().toISOString(), dead };
  for (const k of Object.keys(found)) out[k] = [...found[k]].sort();
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 0));
  console.log(`Boards: greenhouse ${out.greenhouse.length}, lever ${out.lever.length}, ashby ${out.ashby.length}`);
}
