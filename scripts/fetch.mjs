// Pulls every open job from each discovered board, normalizes them into one shape,
// and writes static JSON for the website:
//   site/data/stats.json            totals, per-city counts, last run time
//   site/data/<city>.json           compact job list for each city (and "remote")
//   site/data/companies.json        company name, ATS, job count
//   site/data/seen.json             job id -> first-seen date (lets the next run mark New / Closed)
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BOARDS = path.join(ROOT, "data", "boards.json");
const OUTDIR = path.join(ROOT, "site", "data");
const UA = process.env.USER_AGENT || "MinervaJobFeed/0.1 (+https://github.com)";
const CONCURRENCY = Number(process.env.CONCURRENCY || 16);
const LIMIT = Number(process.env.BOARD_LIMIT || 0);          // 0 = every board
const PREV_URL = process.env.PREV_URL || "";                 // live site, to carry first-seen dates
const FIXTURES = process.env.FIXTURES || "";                 // offline test mode

export const CITIES = {
  nyc: { name: "New York", re: /\b(new york|nyc|manhattan|brooklyn|queens|bronx|staten island|long island city)\b/i },
  sf: { name: "San Francisco Bay Area", re: /\b(san francisco|sf\b|bay area|oakland|berkeley|emeryville|palo alto|menlo park|mountain view|sunnyvale|san mateo|redwood city|san jose|santa clara|south san francisco|foster city|burlingame)\b/i },
  boston: { name: "Boston", re: /\b(boston|cambridge, ma|somerville)\b/i },
  seattle: { name: "Seattle", re: /\b(seattle|bellevue|redmond|kirkland)\b/i },
  austin: { name: "Austin", re: /\baustin\b/i },
  la: { name: "Los Angeles", re: /\b(los angeles|santa monica|culver city|venice, ca|playa vista|pasadena|irvine)\b/i },
  chicago: { name: "Chicago", re: /\bchicago\b/i },
  dc: { name: "Washington, DC", re: /\b(washington,? d\.?c\.?|arlington, va|bethesda|reston|mclean)\b/i },
  denver: { name: "Denver / Boulder", re: /\b(denver|boulder)\b/i },
  miami: { name: "Miami", re: /\b(miami|fort lauderdale)\b/i },
};
const REMOTE_RE = /\bremote\b|\banywhere\b|work from home/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, tries = 3) {
  if (FIXTURES) {
    const name = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 150) + ".json";
    try { return { ok: true, data: JSON.parse(await fs.readFile(path.join(FIXTURES, name), "utf8")) }; }
    catch { return { ok: false, status: 404 }; }
  }
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (r.status === 404) return { ok: false, status: 404 };
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, data: await r.json() };
    } catch { await sleep(1000 * (i + 1)); }
  }
  return { ok: false, status: 0 };
}

const titleCase = s => s.replace(/[-_.]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const money = (min, max, cur = "USD", per = "") => {
  if (!min && !max) return "";
  const sym = cur === "USD" || !cur ? "$" : cur + " ";
  const f = n => n >= 1000 ? `${sym}${(n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, "")}K` : `${sym}${n}`;
  const per2 = per && !/year|annual|yr/i.test(per) ? ` /${per.replace(/^per[-_ ]?/i, "").toLowerCase()}` : "";
  return (min && max && min !== max ? `${f(min)}–${f(max)}` : f(min || max)) + per2;
};
const isoDay = v => { if (!v) return ""; const d = new Date(typeof v === "number" ? v : String(v)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };

/* ---------- per-ATS readers ---------- */
export function fromGreenhouse(slug, data, boardName) {
  return (data.jobs || []).map(j => {
    const loc = j.location?.name || (j.offices || []).map(o => o.name).join("; ");
    const pr = (j.pay_input_ranges || [])[0];
    return {
      i: `gh:${slug}:${j.id}`, s: "greenhouse", c: boardName || titleCase(slug), t: j.title || "",
      l: loc, d: (j.departments || []).map(d => d.name).join(", "),
      p: pr ? money(Math.round(pr.min_cents / 100), Math.round(pr.max_cents / 100), pr.currency_type) : "",
      u: j.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
      o: isoDay(j.first_published || j.updated_at),
    };
  });
}
export function fromLever(slug, data) {
  return (Array.isArray(data) ? data : []).map(j => {
    const cat = j.categories || {};
    const locs = cat.allLocations?.length ? cat.allLocations.join("; ") : (cat.location || "");
    const sr = j.salaryRange || {};
    return {
      i: `lv:${slug}:${j.id}`, s: "lever", c: titleCase(slug), t: j.text || "",
      l: locs + (j.workplaceType === "remote" && !/remote/i.test(locs) ? "; Remote" : ""), d: [cat.department, cat.team].filter(Boolean).join(", "),
      p: money(sr.min, sr.max, sr.currency, sr.interval), u: j.hostedUrl || j.applyUrl || "",
      o: isoDay(j.createdAt), k: cat.commitment || "",
    };
  });
}
export function fromAshby(slug, data) {
  return (data.jobs || []).filter(j => j.isListed !== false).map(j => {
    const locs = [j.location, ...(j.secondaryLocations || []).map(x => x.location || x)].filter(x => typeof x === "string" && x).join("; ");
    return {
      i: `ab:${slug}:${j.id}`, s: "ashby", c: titleCase(slug), t: j.title || "",
      l: locs + (j.isRemote && !/remote/i.test(locs) ? "; Remote" : ""), d: [j.department, j.team].filter(Boolean).join(", "),
      p: j.compensation?.compensationTierSummary || j.compensation?.scrapeableCompensationSalarySummary || "",
      u: j.jobUrl || j.applyUrl || "", o: isoDay(j.publishedAt), k: j.employmentType || "",
    };
  });
}

async function readBoard(ats, slug) {
  if (ats === "greenhouse") {
    const r = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?pay_transparency=true`);
    if (!r.ok) return r;
    let name = "";
    if ((r.data.jobs || []).length) { const b = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}`); name = b.ok ? b.data.name : ""; }
    return { ok: true, jobs: fromGreenhouse(slug, r.data, name) };
  }
  if (ats === "lever") {
    const r = await getJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return r.ok ? { ok: true, jobs: fromLever(slug, r.data) } : r;
  }
  const r = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
  return r.ok ? { ok: true, jobs: fromAshby(slug, r.data) } : r;
}

async function pool(items, n, fn) {
  let i = 0; const out = [];
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

export function citiesFor(loc) {
  const hits = Object.entries(CITIES).filter(([, c]) => c.re.test(loc)).map(([k]) => k);
  if (REMOTE_RE.test(loc)) hits.push("remote");
  return hits;
}

/* ---------- main ---------- */
export async function run() {
  const boards = JSON.parse(await fs.readFile(BOARDS, "utf8"));
  let list = ["greenhouse", "lever", "ashby"].flatMap(ats => (boards[ats] || []).map(slug => ({ ats, slug })));
  if (LIMIT) list = list.slice(0, LIMIT);
  console.log(`Reading ${list.length} boards with ${CONCURRENCY} at a time…`);

  let seenPrev = {};
  if (PREV_URL) { const r = await getJSON(PREV_URL.replace(/\/$/, "") + "/data/seen.json"); if (r.ok) seenPrev = r.data; }

  const t0 = Date.now(); const dead = { greenhouse: [], lever: [], ashby: [] }; let failed = 0, done = 0;
  const results = await pool(list, CONCURRENCY, async b => {
    const r = await readBoard(b.ats, b.slug);
    if (++done % 500 === 0) console.log(`  ${done}/${list.length} boards`);
    if (!r.ok) { if (r.status === 404) dead[b.ats].push(b.slug); else failed++; return []; }
    return r.jobs;
  });

  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map();
  for (const j of results.flat()) if (j.t && j.u && !byId.has(j.i)) byId.set(j.i, j);
  // Same company posting the same title in the same place on two boards: keep one.
  const dedupe = new Map();
  for (const j of byId.values()) { const k = `${j.c}|${j.t}|${j.l}`.toLowerCase(); if (!dedupe.has(k)) dedupe.set(k, j); }
  const jobs = [...dedupe.values()];

  const seen = {}; let newCount = 0;
  for (const j of jobs) { j.f = seenPrev[j.i] || today; if (!seenPrev[j.i]) newCount++; seen[j.i] = j.f; }
  const closed = Object.keys(seenPrev).filter(id => !seen[id]).length;

  const buckets = {}; const companies = new Map();
  for (const j of jobs) {
    j.r = REMOTE_RE.test(j.l) ? 1 : 0;
    for (const c of citiesFor(j.l)) (buckets[c] = buckets[c] || []).push(j);
    const ck = j.c + "|" + j.s; companies.set(ck, { c: j.c, s: j.s, n: (companies.get(ck)?.n || 0) + 1 });
  }

  await fs.mkdir(OUTDIR, { recursive: true });
  for (const [city, arr] of Object.entries(buckets)) {
    arr.sort((a, b) => (b.f || "").localeCompare(a.f || "") || (b.o || "").localeCompare(a.o || ""));
    await fs.writeFile(path.join(OUTDIR, `${city}.json`), JSON.stringify(arr));
  }
  await fs.writeFile(path.join(OUTDIR, "companies.json"), JSON.stringify([...companies.values()].sort((a, b) => b.n - a.n)));
  await fs.writeFile(path.join(OUTDIR, "seen.json"), JSON.stringify(seen));
  const stats = {
    updatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
    boards: list.length, boardsFailed: failed, boardsGone: Object.values(dead).flat().length,
    jobs: jobs.length, newSinceLastRun: PREV_URL && Object.keys(seenPrev).length ? newCount : null, closedSinceLastRun: Object.keys(seenPrev).length ? closed : null,
    withPay: jobs.filter(j => j.p).length, companies: companies.size,
    bySource: Object.fromEntries(["greenhouse", "lever", "ashby"].map(s => [s, jobs.filter(j => j.s === s).length])),
    cities: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, { name: CITIES[k]?.name || "Remote", jobs: v.length }]).sort((a, b) => b[1].jobs - a[1].jobs)),
  };
  await fs.writeFile(path.join(OUTDIR, "stats.json"), JSON.stringify(stats, null, 1));

  // Remember boards that no longer exist so discovery stops retrying them.
  boards.dead = boards.dead || {};
  for (const k of Object.keys(dead)) boards.dead[k] = [...new Set([...(boards.dead[k] || []), ...dead[k]])];
  for (const k of Object.keys(dead)) boards[k] = (boards[k] || []).filter(s => !dead[k].includes(s));
  await fs.writeFile(BOARDS, JSON.stringify(boards));
  console.log(JSON.stringify(stats, null, 1));
  return stats;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await run();
