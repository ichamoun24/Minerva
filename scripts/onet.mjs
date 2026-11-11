// Builds Minerva's hiring baseline from the O*NET database (U.S. Department of Labor, CC BY 4.0).
// O*NET surveys people working in each occupation. For each one we keep:
//   - the education level people in the job say it requires (share at each level)
//   - how much related work experience it takes before starting (share in each band)
//   - the Job Zone (1–5: how much preparation the occupation needs)
//   - the software and tools most named for it
// plus O*NET's ~60,000 job titles, so fetch.mjs can tag each posting with its occupation.
//
// Writes data/onet.json (occupations, also published to the site) and data/onet-titles.json (title index).
// Run: node scripts/onet.mjs            downloads the current database
//      ONET_DIR=path node scripts/onet.mjs   uses an already-unzipped database (tests)
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = process.env.ONET_OUT || path.join(ROOT, "data");
const PAGE = "https://www.onetcenter.org/database.html";
const FALLBACK = "https://www.onetcenter.org/dl_files/database/db_30_3_text.zip";
const UA = { "user-agent": "MinervaJobFeed/0.1 (+https://github.com)" };
export const BUILDER = 2;   // bump when the output format or parsing changes, so the next run rebuilds

// O*NET "Required Level of Education" (RL) categories -> Minerva's degree levels (0 none … 5 doctorate/professional)
const RL_TO_DEG = { 1: 0, 2: 1, 3: 1, 4: 1, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 5 };
// "Related Work Experience" (RW) categories -> bands
export const EXP_BANDS = ["None", "Under 1 year", "1–2 years", "2–4 years", "4–6 years", "6–10 years", "Over 10 years"];
const RW_TO_BAND = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 10: 5, 11: 6 };

async function download() {
  let url = FALLBACK;
  try {
    const html = await (await fetch(PAGE, { headers: UA })).text();
    const m = html.match(/href="([^"]*db_\d+_\d+_text\.zip)"/i);
    if (m) url = new URL(m[1], PAGE).href;
  } catch (e) { console.log("Couldn't read the O*NET download page, trying the known address: " + e.message); }
  console.log("Downloading " + url);
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`O*NET download failed: HTTP ${r.status}`);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "onet-"));
  const zip = path.join(dir, "onet.zip");
  await fs.writeFile(zip, Buffer.from(await r.arrayBuffer()));
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  return { dir, version: (url.match(/db_(\d+)_(\d+)/) || []).slice(1).join(".") };
}

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else if (/\.txt$/i.test(e.name)) out.push(p);
  }
  return out;
}
async function table(files, nameRe) {
  const f = files.find(p => nameRe.test(path.basename(p)));
  if (!f) return null;
  const lines = (await fs.readFile(f, "utf8")).replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split("\t");
  return { file: path.basename(f), head, rows: lines.map(l => l.split("\t")) };
}
const col = (t, re, skip = []) => t.head.findIndex((h, i) => re.test(h.trim()) && !skip.includes(i));

export async function build(dir, version = "") {
  const files = await walk(dir);
  const occT = await table(files, /^occupation data\.txt$/i);
  if (!occT) throw new Error("Occupation Data.txt not found in the O*NET download");
  const cC = col(occT, /soc code/i), cT = col(occT, /^title$/i);
  const occ = [], idx = new Map();
  for (const r of occT.rows) { idx.set(r[cC], occ.length); occ.push({ code: r[cC], title: r[cT], zone: 0, edu: null, exp: null, tech: [] }); }

  // Titles: official first, then alternates, then titles workers reported.
  const titles = occ.map((o, i) => [o.title, i]);
  for (const t of await Promise.all([/^alternate titles\.txt$/i, /^job titles\.txt$/i, /^sample of reported titles\.txt$/i].map(re => table(files, re)))) {
    if (!t) continue;
    const c = col(t, /soc code/i), main = col(t, /^title$/i);
    const a = t.head.findIndex((h, i) => /title/i.test(h) && i !== main && !/short/i.test(h));
    if (c < 0 || a < 0) continue;
    for (const r of t.rows) if (idx.has(r[c]) && r[a]) titles.push([r[a], idx.get(r[c])]);
    console.log(`  ${t.file}: ${t.rows.length.toLocaleString()} titles`);
  }

  const jz = await table(files, /^job zones\.txt$/i);
  if (jz) { const c = col(jz, /soc code/i), z = col(jz, /job zone/i); for (const r of jz.rows) if (idx.has(r[c])) occ[idx.get(r[c])].zone = +r[z] || 0; }

  // Education and experience: newer releases split this file, so read every table that has RL/RW scale rows.
  console.log("  files: " + files.map(f => path.basename(f)).join(" | "));
  const eteFiles = files.filter(f => /educ|train|experience/i.test(path.basename(f)) && !/categor/i.test(path.basename(f)));
  for (const f of eteFiles) {
    const ete = await table([f], /./);
    if (col(ete, /scale id/i) < 0 || col(ete, /^category$/i) < 0) continue;
    const c = col(ete, /soc code/i), s = col(ete, /scale id/i), k = col(ete, /^category$/i), v = col(ete, /data value/i), sup = col(ete, /recommend suppress/i);
    for (const r of ete.rows) {
      const o = occ[idx.get(r[c])]; if (!o) continue;
      if (sup >= 0 && r[sup] === "Y") continue;
      const val = +r[v] || 0, cat = +r[k];
      if (r[s] === "RL" && RL_TO_DEG[cat] != null) { o.edu = o.edu || [0, 0, 0, 0, 0, 0]; o.edu[RL_TO_DEG[cat]] += val; }
      if (r[s] === "RW" && RW_TO_BAND[cat] != null) { o.exp = o.exp || [0, 0, 0, 0, 0, 0, 0]; o.exp[RW_TO_BAND[cat]] += val; }
    }
    console.log(`  ${ete.file}: education/experience rows read`);
  }

  const tech = await table(files, /^(technology|software|tools).*\.txt$/i);
  if (tech) {
    console.log(`  ${tech.file} columns: ${tech.head.join(" | ")}`);
    const c = col(tech, /soc code/i), hot = col(tech, /hot/i), dem = col(tech, /in demand/i);
    let e = col(tech, /^example$/i);
    if (e < 0) e = tech.head.findIndex(h => /example|software|skill|technology|tool|name/i.test(h) && !/code|commodity|hot|demand|^title$|soc/i.test(h));
    const pick = new Map();
    for (const r of tech.rows) {
      const i = idx.get(r[c]); if (i == null || !r[e]) continue;
      const score = (r[hot] === "Y" ? 2 : 0) + (r[dem] === "Y" ? 1 : 0);
      (pick.get(i) || pick.set(i, []).get(i)).push([score, r[e]]);
    }
    for (const [i, list] of pick) occ[i].tech = [...new Set(list.sort((a, b) => b[0] - a[0]).map(x => x[1]))].slice(0, 8);
  }

  // Some occupations haven't been surveyed yet. Borrow from the closest surveyed one in the same family
  // (same first 6, then 4 characters of the code) and say so.
  for (const o of occ) {
    if (o.edu || o.exp) continue;
    for (const n of [7, 6, 4]) {
      const near = occ.find(x => x !== o && (x.edu || x.exp) && x.code.slice(0, n) === o.code.slice(0, n) && !x.borrowed);
      if (near) { o.edu = near.edu; o.exp = near.exp; if (!o.zone) o.zone = near.zone; if (!o.tech.length) o.tech = near.tech; o.borrowed = near.title; break; }
    }
  }
  const round = a => a && a.map(x => Math.round(x));
  const out = { builder: BUILDER, builtAt: new Date().toISOString(), version, source: "O*NET " + (version || "database") + ", U.S. Department of Labor/Employment and Training Administration (CC BY 4.0)", expBands: EXP_BANDS,
    occ: occ.map(o => [o.code, o.title, o.zone, round(o.edu), round(o.exp), o.tech, o.borrowed || ""]) };
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, "onet.json"), JSON.stringify(out));
  await fs.writeFile(path.join(OUT, "onet-titles.json"), JSON.stringify(titles));
  console.log(`O*NET ${version}: ${occ.length} occupations, ${titles.length.toLocaleString()} titles, ${occ.filter(o => o.edu).length} with education data`);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  if (process.env.ONET_IF_STALE === "1") {
    try {
      const cur = JSON.parse(await fs.readFile(path.join(OUT, "onet.json"), "utf8"));
      if (cur.builder === BUILDER && Date.now() - Date.parse(cur.builtAt) < 30 * 864e5) { console.log(`Baseline is current (O*NET ${cur.version}, built ${cur.builtAt.slice(0, 10)}).`); process.exit(0); }
    } catch {}
  }
  if (process.env.ONET_DIR) await build(process.env.ONET_DIR, process.env.ONET_VERSION || "");
  else { const { dir, version } = await download(); await build(dir, version); }
}
