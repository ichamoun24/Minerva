// Ghost-job scan: flags postings that are unlikely to lead to a hire right now.
// No single signal proves a posting is fake, so each one adds to a score and is shown as a reason.
//
// Signals:
//   pl   the text says it is a pipeline, talent pool or future-opening posting
//   gt   the title itself is a general application / talent community / expression of interest
//   a90  open 90+ days            a180  open 180+ days (most real roles fill in 30–45)
//   rp   the same company has reposted the same title in the same city under a new id (rp2, rp3… = times)
//   mass the company has 15+ open postings with this exact title
//
// Score -> level:  0–1 none, 2 "some signs", 3+ "likely ghost"
// History is kept in site/data/history.json between runs (via the live site, like seen.json).

const PIPELINE = new RegExp([
  String.raw`talent (pool|pipeline|community|network)`,
  String.raw`(build|building|grow|growing) (a |our )?(pipeline|bench|talent pool)`,
  String.raw`future (opportunit|opening|role|position|need|hiring)`,
  String.raw`(not|isn'?t) (a |an )?(current|active|open|immediate)(ly)? (open|opening|role|position|vacanc)`,
  String.raw`no (current|immediate) (opening|vacanc|position)`,
  String.raw`evergreen (role|position|posting|requisition|req)`,
  String.raw`(this|the) (role|position|posting|requisition) is evergreen`,
  String.raw`(always|continuously|continually|ongoing(ly)?) (accepting|reviewing|looking for|hiring|seeking) (applications|resumes|candidates|talented)`,
  String.raw`accept(ing)? applications on a rolling basis for future`,
  String.raw`as (positions|roles|openings) become available`,
  String.raw`when (a |an )?(position|role|opening|need) (becomes available|arises|opens)`,
  String.raw`keep your (resume|application|information) on file`,
  String.raw`general (application|interest)`,
  String.raw`expression of interest`,
].join("|"), "i");

const GENERAL_TITLE = /\b(general application|general interest|talent (community|pool|network|pipeline)|future (opportunit|opening|role)|expression of interest|don'?t see (a|the|your) (role|job|position)|join our talent|open application|spontaneous application|evergreen)\b/i;

export function pipelineLanguage(text) { return PIPELINE.test(String(text || "")); }
export function generalTitle(title) { return GENERAL_TITLE.test(String(title || "")); }

// Small, stable string hash so history.json stays compact.
export function h(s) {
  let x = 2166136261; s = String(s);
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0).toString(36);
}
const EPOCH = Date.UTC(2026, 0, 1);
export const dayNum = iso => Math.round((Date.parse(iso + "T00:00:00Z") - EPOCH) / 864e5);
const normTitle = t => String(t).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s*[-–—|,]\s*(remote|hybrid|on[- ]?site|nyc|new york|sf|us|usa)\b.*$/i, "").replace(/[^a-z0-9+#]+/g, " ").trim();
const normCo = c => String(c).toLowerCase().replace(/[^a-z0-9]+/g, "");
export const roleKey = (j, city) => h(`${normCo(j.c)}|${normTitle(j.t)}|${city || ""}`);

// Mutates jobs: sets g (1 = some signs, 2 = likely ghost) and gr (comma-separated reasons) when there are any.
// prevHistory: { key: [firstSeenDay, lastSeenDay, timesPosted, idHash] }. Returns the new history.
export function scan(jobs, prevHistory, today, cityOf = () => "") {
  const T = dayNum(today), hist = {};
  for (const [k, v] of Object.entries(prevHistory || {})) if (T - v[1] <= 180) hist[k] = v.slice();   // forget roles gone 6 months

  const groups = new Map(), titleCount = new Map();
  for (const j of jobs) {
    const k = roleKey(j, cityOf(j)); j._rk = k;
    (groups.get(k) || groups.set(k, []).get(k)).push(j);
    const tc = normCo(j.c) + "|" + normTitle(j.t); titleCount.set(tc, (titleCount.get(tc) || 0) + 1);
  }
  for (const [k, arr] of groups) {
    const ids = arr.map(j => h(j.i)), first = ids.slice().sort()[0];
    const v = hist[k];
    if (!v) hist[k] = [T, T, 1, first];
    else {
      const gone = T - v[1] > 2;                       // missing for more than a couple of days, then back
      if (!ids.includes(v[3]) || gone) { v[2]++; v[3] = first; }
      v[1] = T;
    }
  }
  for (const j of jobs) {
    const v = hist[j._rk]; const reasons = []; let score = 0;
    if (j.gp) { reasons.push("pl"); score += 3; }
    if (generalTitle(j.t)) { reasons.push("gt"); score += 3; }
    const starts = [j.o, j.f].filter(Boolean).map(dayNum); if (v) starts.push(v[0]);
    // Government postings often stay open by law ("continuous recruitment"), so time open isn't held against them.
    const age = starts.length && !/^(nycgov|usajobs)$/.test(j.s) ? T - Math.min(...starts) : 0;
    if (age >= 180) { reasons.push("a180"); score += 2; } else if (age >= 90) { reasons.push("a90"); score += 1; }
    if (v && v[2] >= 2) { reasons.push("rp" + v[2]); score += v[2] >= 3 ? 2 : 1; }
    if ((titleCount.get(normCo(j.c) + "|" + normTitle(j.t)) || 0) >= 15) { reasons.push("mass"); score += 1; }
    delete j._rk; delete j.gp;
    if (score >= 2) { j.g = score >= 3 ? 2 : 1; j.gr = reasons.join(","); }
  }
  return hist;
}
