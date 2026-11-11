// Matches a job title to an O*NET occupation using O*NET's own list of job titles
// (official titles, alternate titles and titles reported by workers).
const SENIORITY = /\b(senior|sr|junior|jr|lead|principal|staff|head|entry level|entry-level|mid level|mid-level|level [0-9ivx]+|[ivx]{1,4}|[0-9])\b/g;
const NOISE = /\b(remote|hybrid|on ?site|onsite|contract|temporary|temp|part time|part-time|full time|full-time|new york|nyc|san francisco|sf|us|usa|emea|apac|americas)\b/g;

export function norm(t) {
  return String(t || "").toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/&/g, " and ").replace(/\bsr\.|\bjr\./g, m => m.slice(0, 2))
    .replace(/[^a-z0-9+#/ ]+/g, " ").replace(/\//g, " ")
    .replace(/\s+/g, " ").trim();
}
const core = t => norm(t).replace(NOISE, " ").replace(SENIORITY, " ").replace(/\s+/g, " ").trim();
const firstPart = t => String(t || "").split(/\s[-–—|]\s|,|:/)[0];
const STOP = new Set(["and", "of", "the", "for", "to", "in", "a", "an", "at", "with", "on"]);
const toks = s => s.split(" ").filter(w => w && !STOP.has(w));

// titles: array of [title, occupationIndex], earlier entries win on duplicates (put official titles first).
export function buildIndex(titles) {
  const exact = new Map(), byLast = new Map();
  for (const [t, oc] of titles) {
    for (const k of new Set([norm(t), core(t)])) if (k && !exact.has(k)) exact.set(k, oc);
    const tk = toks(core(t)); if (!tk.length) continue;
    const last = tk[tk.length - 1];
    (byLast.get(last) || byLast.set(last, []).get(last)).push([tk, oc]);
  }
  return { exact, byLast };
}

// Returns an occupation index, or -1 when nothing fits well enough.
export function matcher(index) {
  const cache = new Map();
  return title => {
    const key = norm(title); if (cache.has(key)) return cache.get(key);
    let oc = -1;
    for (const k of [key, core(title), norm(firstPart(title)), core(firstPart(title))]) if (k && index.exact.has(k)) { oc = index.exact.get(k); break; }
    if (oc < 0) {
      // the longest O*NET title whose words all appear in this title, ending on one of its words (the job's head noun)
      const words = toks(core(firstPart(title))), have = new Set(words); let best = 0;
      for (const w of have) for (const [tk, o] of index.byLast.get(w) || []) {
        if (tk.length < 2 && words.length > 2) continue;           // a single word is too loose for a long title
        if (tk.length > best && tk.every(x => have.has(x))) { best = tk.length; oc = o; }
      }
    }
    cache.set(key, oc); return oc;
  };
}
