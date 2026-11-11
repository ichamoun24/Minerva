// Reads how many years of experience a job description requires.
// Returns the largest *required* number of years, or 0 when the posting doesn't say.
// Ignored on purpose:
//   - preferred / nice-to-have amounts ("7+ years preferred")
//   - the company's own history ("with over 20 years of experience serving clients, we…")
//   - commitments and terms ("two-year commitment", "12-month contract", "4-year degree")
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", hellip: "…" };

export function plainText(s) {
  let t = String(s || "");
  for (let i = 0; i < 2 && /&(lt|gt|amp);/.test(t); i++) t = t.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, decode);
  t = t.replace(/<(br|\/p|\/li|\/h\d|\/div|\/ul|li)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ");
  t = t.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, decode);
  return t.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
function decode(m, e) {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isNaN(n) ? m : String.fromCodePoint(n); }
  return ENT[e.toLowerCase()] ?? m;
}

const NUM = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)";
const RE = new RegExp(`\\b${NUM}\\s*(\\+|plus)?\\s*(?:(?:-|–|—|to)\\s*${NUM})?\\s*\\+?\\s*(?:or more\\s+|or greater\\s+)?(?:full[- ]time\\s+)?years?\\b`, "gi");

// Is this position under a "Preferred qualifications" style heading? Looks back for the nearest short
// heading-like line that mentions either preferred or required qualifications.
const PREF_WORDS = /\b(preferred|nice[- ]to[- ]have|bonus|desired|pluses|ideally|ideal candidate)\b/i;
const REQ_WORDS = /\b(required|requirements|minimum|basic|qualifications|what you('ll)? (need|bring)|who you are|about you|you have|must have)\b/i;
function inPreferredSection(t, i) {
  const lines = t.slice(0, i).split("\n"); lines.pop();          // drop the line the match is on
  for (let k = lines.length - 1; k >= 0 && k >= lines.length - 25; k--) {
    const l = lines[k].trim(); if (!l || l.length > 70) continue;
    if (PREF_WORDS.test(l)) return true;
    if (REQ_WORDS.test(l)) return false;
  }
  return false;
}

export function reqYearsOf(raw) {
  const t = plainText(raw); if (!t) return 0;
  let best = 0, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(t))) {
    const n = WORDNUM[m[1].toLowerCase()] ?? parseInt(m[1], 10);
    if (!(n >= 1 && n <= 15)) continue;
    const before = t.slice(Math.max(0, m.index - 140), m.index).toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 90).toLowerCase();
    const near = before.slice(-40) + " " + after.slice(0, 40);
    if (/^['’]?\s*(old|ago|of age|-?\s*degree|program|college|university|bachelor|undergrad)/.test(after)) continue;
    if (/^\s*(in business|of history|of operation|of serving|of service to|of growth|running)/.test(after)) continue;
    if (/commit|contract\b|\bterm\b|fellowship|residency program|warranty|lease|vesting|cliff|tenure|anniversary|guarantee/.test(near)) continue;
    if (/\b(we|we've|we have|our (company|firm|team|organization|agency|founders?)|the company|the firm)\s+(have|has|bring|brings|boasts?)\b[^.]{0,25}$|\b(for|with) over\s*$|founded|since\s*$|serving\s*$/.test(before.slice(-70))) continue;
    // must be about the candidate's experience
    const exp = /^[^.\n]{0,70}\b(experience|exp\b|working|work in|in (a|an|the)\b|as (a|an)\b|of (professional|relevant|related|progressive|industry|hands-on|direct|post|full)|managing|leading|selling|building|teaching|practice)/.test(after)
      || /\b(experience|minimum of|at least|requires?|required|must have|bring)\b[^.\n]{0,25}$/.test(before);
    if (!exp) continue;
    const pref = /\b(prefer|preferred|nice to have|bonus|ideally|ideal candidate|a plus|desired|desirable)\b[^\n]{0,100}$/.test(before)
      || /^[^.;\n]{0,70}\b(preferred|is a plus|a plus|nice to have|is a bonus|desired)\b/.test(after);
    if (pref || inPreferredSection(t, m.index)) continue;
    if (n > best) best = n;
  }
  return best;
}
