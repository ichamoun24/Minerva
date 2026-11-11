// Job sources beyond company boards on Greenhouse, Lever and Ashby.
// These bring in work that office-focused boards miss: arts and culture, schools,
// clinics and care, nonprofits, trades, and city and federal government.
//   workable  Workable's public cross-company job search (jobs.workable.com), searched by city
//   nycgov    New York City government postings (NYC Open Data, updated daily)
//   usajobs   Federal jobs (needs a free key: set USAJOBS_KEY and USAJOBS_EMAIL as repo secrets)
const sleep = ms => new Promise(r => setTimeout(r, ms));

const WORKABLE_CITIES = { nyc: "New York", sf: "San Francisco", boston: "Boston", seattle: "Seattle", austin: "Austin", la: "Los Angeles", chicago: "Chicago", dc: "Washington", denver: "Denver", miami: "Miami" };
const WK_MAX_PAGES = Number(process.env.WK_MAX_PAGES || 400);   // 20 jobs a page

const isoDay = v => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };
const fmtK = n => n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, "")}K` : `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
function pay(min, max, per) {
  min = +min || 0; max = +max || 0; if (min >= 1000) min = Math.round(min); if (max >= 1000) max = Math.round(max); if (!min && !max) return "";
  const s = min && max && min !== max ? `${fmtK(min)}–${fmtK(max)}` : fmtK(min || max);
  return s + (per ? ` /${per}` : "");
}
const smartCase = s => String(s || "").toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase())
  .replace(/\b(Nyc|Hra|Dss|Doe|Dot|Dep|Dcas|Hpd|Nypd|Fdny|Doitt|Dohmh|Cuny|Ii|Iii|Iv|Hr|It|Gis|Eeo|Ada|Llc)\b/g, w => w.toUpperCase())
  .replace(/\b(Of|And|For|The|To|In|On|At)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase());

async function getJSON(url, headers = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", ...headers } });
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok) return { ok: false, status: r.status };
      return { ok: true, data: await r.json() };
    } catch { await sleep(1500 * (i + 1)); }
  }
  return { ok: false, status: 0 };
}

const host = u => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch { return ""; } };
export function fromWorkable(j) {
  const locs = (j.locations || []).length ? j.locations.join("; ") : [j.location?.city, j.location?.subregion, j.location?.countryName].filter(Boolean).join(", ");
  return {
    i: `wk:${j.id}`, s: "workable", c: j.company?.title || "", t: j.title || "",
    l: locs + (j.workplace === "remote" && !/remote|telecommute/i.test(locs) ? "; Remote" : j.workplace === "hybrid" && !/hybrid/i.test(locs) ? " (Hybrid)" : ""),
    d: j.department || "", p: "", u: j.url || "", o: isoDay(j.created), k: j.employmentType || "", w: host(j.company?.website),
  };
}
async function workableCity(city, q, log) {
  const out = []; let token = "", pages = 0;
  do {
    const u = `https://jobs.workable.com/api/v1/jobs?location=${encodeURIComponent(q)}${token ? "&pageToken=" + encodeURIComponent(token) : ""}`;
    const r = await getJSON(u);
    if (!r.ok) { log(`  workable ${city}: stopped at page ${pages + 1} (HTTP ${r.status})`); break; }
    (r.data.jobs || []).forEach(j => out.push(fromWorkable(j)));
    token = r.data.nextPageToken || ""; pages++;
    await sleep(250);
  } while (token && pages < WK_MAX_PAGES);
  return out;
}
export async function workableJobs(log = console.log) {
  const all = await Promise.all(Object.entries(WORKABLE_CITIES).map(async ([k, q]) => { const j = await workableCity(k, q, log); log(`  workable ${k}: ${j.length} jobs`); return j; }));
  return all.flat();
}

export function fromNycGov(r) {
  const per = /hour/i.test(r.salary_frequency || "") ? "hour" : /day/i.test(r.salary_frequency || "") ? "day" : "";
  return {
    i: `ny:${r.job_id}`, s: "nycgov", c: smartCase(r.agency), t: smartCase(r.business_title || r.civil_service_title),
    l: [r.work_location, "New York City"].filter(Boolean).join(" · "), d: r.job_category || "",
    p: pay(r.salary_range_from, r.salary_range_to, per), u: `https://cityjobs.nyc.gov/job/${r.job_id}`,
    o: isoDay(r.posting_date), k: r.full_time_part_time_indicator === "P" ? "Part-time" : r.full_time_part_time_indicator === "F" ? "Full-time" : "",
  };
}
export async function nycGovJobs(log = console.log) {
  const sel = "job_id,agency,business_title,civil_service_title,job_category,full_time_part_time_indicator,salary_range_from,salary_range_to,salary_frequency,work_location,posting_date";
  const r = await getJSON(`https://data.cityofnewyork.us/resource/kpav-sd4t.json?$select=${sel}&$where=posting_type='External'&$limit=10000`);
  if (!r.ok) { log(`  nycgov: failed (HTTP ${r.status})`); return []; }
  const seen = new Set(), out = [];
  for (const row of r.data) { if (seen.has(row.job_id)) continue; seen.add(row.job_id); out.push(fromNycGov(row)); }
  log(`  nycgov: ${out.length} jobs`); return out;
}

export function fromUsaJobs(m) {
  const rem = (m.PositionRemuneration || [])[0] || {};
  const per = rem.RateIntervalCode === "PH" ? "hour" : rem.RateIntervalCode === "PD" ? "day" : "";
  return {
    i: `us:${m.PositionID || m.PositionURI}`, s: "usajobs", c: m.OrganizationName || m.DepartmentName || "", t: m.PositionTitle || "",
    l: m.PositionLocationDisplay || (m.PositionLocation || []).map(x => x.LocationName).join("; "), d: m.DepartmentName || "",
    p: pay(rem.MinimumRange, rem.MaximumRange, per), u: m.PositionURI || "", o: isoDay(m.PublicationStartDate),
    k: ((m.PositionSchedule || [])[0] || {}).Name || "",
  };
}
export async function usaJobs(log = console.log) {
  const key = process.env.USAJOBS_KEY, email = process.env.USAJOBS_EMAIL;
  if (!key || !email) { log("  usajobs: skipped (add USAJOBS_KEY and USAJOBS_EMAIL secrets to include federal jobs)"); return []; }
  const places = { nyc: "New York, New York", sf: "San Francisco, California", boston: "Boston, Massachusetts", seattle: "Seattle, Washington", austin: "Austin, Texas", la: "Los Angeles, California", chicago: "Chicago, Illinois", dc: "Washington, District of Columbia", denver: "Denver, Colorado", miami: "Miami, Florida" };
  const out = [];
  for (const [k, place] of Object.entries(places)) {
    let n = 0;
    for (let page = 1; page <= 6; page++) {
      const r = await getJSON(`https://data.usajobs.gov/api/search?LocationName=${encodeURIComponent(place)}&ResultsPerPage=500&Page=${page}`, { "Host": "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key });
      if (!r.ok) { log(`  usajobs ${k}: HTTP ${r.status}`); break; }
      const items = r.data?.SearchResult?.SearchResultItems || [];
      items.forEach(it => { out.push(fromUsaJobs(it.MatchedObjectDescriptor || {})); n++; });
      if (items.length < 500) break;
      await sleep(400);
    }
    log(`  usajobs ${k}: ${n} jobs`);
  }
  return out;
}

// Fast food and retail store jobs are left out on purpose.
const EXCLUDE = /\b(cashier|crew member|crew trainer|store (associate|manager|supervisor|lead|team member)|assistant store manager|(retail|store|stock|sales floor) (associate|team member|specialist|lead)|retail sales|sales associate|stocker|merchandiser|shift (lead|leader|supervisor|manager)|barista|busser|dishwasher|food runner|line cook|prep cook|fast food|drive[- ]thru|quick service|restaurant team member|(restaurant|banquet|cocktail|food) server|host(ess)?\s*\/\s*server|delivery driver|grocery|sandwich artist|cook\s*\/\s*cashier)\b/i;
const KEEP = /engineer|developer|software|analyst|scientist|head of|vp\b|vice president|corporate/i;
export const isRetailOrFastFood = title => EXCLUDE.test(title) && !KEEP.test(title);
