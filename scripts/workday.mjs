// Jobs from employers that use Workday for hiring (most large banks, insurers, hospitals,
// universities and Fortune 500 companies). Each employer's career site has a public JSON
// endpoint behind its search page:
//   POST https://{tenant}.{wdN}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs      list (20 per page)
//   GET  https://{tenant}.{wdN}.myworkdayjobs.com/wday/cxs/{tenant}/{site}{path}     one posting, with description
// Boards are stored as "tenant|wdN|site" in data/boards.json under "workday".
// Only postings in Minerva's cities (or remote) are read in full, to keep runs short.
import { info } from "./describe.mjs";
import { CITY_RE_ALL, REMOTE_RE } from "./cities.mjs";

const UA = process.env.USER_AGENT || "MinervaJobFeed/0.1 (+https://github.com)";
const BUDGET_MS = Number(process.env.WD_MINUTES || 45) * 60000;
const MAX_PAGES = Number(process.env.WD_MAX_PAGES || 60);     // 20 a page
const CONC = Number(process.env.WD_CONCURRENCY || 6);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function parseBoard(s) {
  const [tenant, wd, site] = String(s).split("|");
  if (!tenant || !/^wd\d+$/.test(wd || "") || !site) return null;
  const host = `https://${tenant}.${wd}.myworkdayjobs.com`;
  return { tenant, wd, site, host, api: `${host}/wday/cxs/${tenant}/${site}`, pub: `${host}/${site}` };
}
export function boardFromUrl(raw) {
  let u; try { u = new URL(raw.startsWith("http") ? raw : "https://" + raw); } catch { return null; }
  const m = u.hostname.toLowerCase().match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/); if (!m) return null;
  const segs = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  let i = 0; if (segs[i] && /^[a-z]{2}-[a-z]{2}$/i.test(segs[i])) i++;
  if (segs[i] === "wday" && segs[i + 1] === "cxs") i += 3;                  // api URLs: /wday/cxs/tenant/site
  const site = segs[i];
  if (!site || /^(job|jobs|details|login|apply|userHome|wday|introduceYourself)$/i.test(site) || !/^[A-Za-z0-9_.-]{1,80}$/.test(site)) return null;
  return `${m[1]}|${m[2]}|${site}`;
}

async function call(url, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { "user-agent": UA, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000),
      });
      if (r.status === 404 || r.status === 410 || r.status === 422) return { ok: false, status: r.status };
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, data: await r.json() };
    } catch { await sleep(1500 * (i + 1)); }
  }
  return { ok: false, status: 0 };
}

// Location facet values that are in one of our cities, so the list can be narrowed before paging.
function cityFacets(facets) {
  const out = {};
  const visit = f => {
    if (!f) return;
    const vals = f.values || [];
    for (const v of vals) {
      if (v.values) { visit(v); continue; }
      if (f.facetParameter && /locat/i.test(f.facetParameter + " " + (f.descriptor || "")) && (CITY_RE_ALL.test(v.descriptor || "") || REMOTE_RE.test(v.descriptor || "")))
        (out[f.facetParameter] = out[f.facetParameter] || []).push(v.id);
    }
  };
  (facets || []).forEach(visit);
  return out;
}

const DAYS = s => { const t = String(s || "").toLowerCase(); if (/today/.test(t)) return 0; if (/yesterday/.test(t)) return 1; const m = t.match(/(\d+)\+?\s*day/); return m ? +m[1] : null; };
const isoAgo = d => d == null ? "" : new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const titleCase = s => s.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export function fromWorkday(b, item, detail) {
  const p = detail?.jobPostingInfo || {};
  const locs = [p.location || item.locationsText, ...(p.additionalLocations || [])].filter(Boolean);
  const remote = /remote/i.test(p.remoteType || "") || /remote/i.test(locs.join(" "));
  return {
    i: `wd:${b.tenant}:${p.jobReqId || p.id || (item.bulletFields || [])[0] || item.externalPath}`, s: "workday",
    c: detail?.hiringOrganization?.name || titleCase(b.tenant), t: p.title || item.title || "",
    l: locs.join("; ") + (remote && !/remote/i.test(locs.join(" ")) ? "; Remote" : ""), d: "",
    p: "", u: p.externalUrl || `${b.pub}${item.externalPath}`,
    o: p.startDate ? String(p.startDate).slice(0, 10) : isoAgo(DAYS(item.postedOn)), k: p.timeType || "",
    ...info(p.jobDescription || ""),
  };
}

async function readTenant(b, deadline, log) {
  const first = await call(`${b.api}/jobs`, { appliedFacets: {}, limit: 20, offset: 0, searchText: "" });
  if (!first.ok) return { ok: false, status: first.status };
  const total = first.data.total || 0;
  const facets = cityFacets(first.data.facets);
  const narrowed = Object.keys(facets).length > 0;
  let items = narrowed ? [] : first.data.jobPostings || [];
  let n = narrowed ? 0 : items.length, pageTotal = narrowed ? Infinity : total;
  for (let page = narrowed ? 0 : 1; page < MAX_PAGES && n < pageTotal && Date.now() < deadline; page++) {
    const r = await call(`${b.api}/jobs`, { appliedFacets: facets, limit: 20, offset: page * 20, searchText: "" });
    if (!r.ok) break;
    if (page === 0) pageTotal = r.data.total || 0;
    const got = r.data.jobPostings || []; if (!got.length) break;
    items.push(...got); n += got.length;
    await sleep(150);
  }
  // Keep postings in our cities; multi-location postings ("3 Locations") are checked from the full posting.
  const want = items.filter(it => CITY_RE_ALL.test(it.locationsText || "") || REMOTE_RE.test(it.locationsText || "") || /\d+\s+locations/i.test(it.locationsText || ""));
  const jobs = [];
  for (let i = 0; i < want.length && Date.now() < deadline; i += 4) {
    const part = await Promise.all(want.slice(i, i + 4).map(async it => {
      const d = await call(`${b.api}${it.externalPath}`);
      const j = fromWorkday(b, it, d.ok ? d.data : null);
      return CITY_RE_ALL.test(j.l) || REMOTE_RE.test(j.l) ? j : null;
    }));
    jobs.push(...part.filter(Boolean));
  }
  return { ok: true, jobs, total, narrowed };
}

export async function workdayJobs(boards, log = console.log) {
  const list = (boards || []).map(s => [s, parseBoard(s)]).filter(([, b]) => b);
  if (!list.length) { log("  workday: no boards yet (discovery adds them)"); return { jobs: [], dead: [] }; }
  const deadline = Date.now() + BUDGET_MS, dead = [], out = []; let i = 0, failed = 0, done = 0, skipped = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < list.length) {
      const [s, b] = list[i++];
      if (Date.now() > deadline) { skipped++; continue; }
      const r = await readTenant(b, deadline, log);
      if (!r.ok) { if (r.status === 404 || r.status === 410 || r.status === 422) dead.push(s); else failed++; continue; }
      out.push(...r.jobs);
      if (++done % 50 === 0) log(`  workday: ${done}/${list.length} employers, ${out.length} jobs so far`);
    }
  }));
  log(`  workday: ${out.length} jobs from ${done} employers (${dead.length} gone, ${failed} failed${skipped ? `, ${skipped} skipped for time` : ""})`);
  return { jobs: out, dead };
}
