import { reqYearsOf } from "../scripts/years.mjs";
const cases = [
  ["<p>We're looking for someone with 8+ years of experience in enterprise sales.</p>", 8],
  ["Requirements:\n• 3-5 years of experience in FP&A\n• Strong Excel skills", 3],
  ["You have at least five years in a client-facing role.", 5],
  ["Minimum Qualifications\n- 2+ years of professional experience\nPreferred Qualifications\n- 7+ years of experience in fintech", 2],
  ["5+ years of experience in product management; 10+ years preferred", 5],
  ["With over 20 years of experience serving clients, Acme is a leader. You bring 2+ years of experience in marketing.", 2],
  ["This is a two-year commitment starting in July. No experience required.", 0],
  ["Bachelor's degree (4-year degree) required. 1+ year of experience working with students.", 1],
  ["Our company has 15 years of experience in logistics.", 0],
  ["A baccalaureate degree from an accredited college and 3 years of satisfactory full-time experience in community work.", 3],
  ["&lt;p&gt;Requirements&lt;/p&gt;&lt;ul&gt;&lt;li&gt;6+ years of software engineering experience&lt;/li&gt;&lt;/ul&gt;", 6],
  ["Fellowship term: 2 years. Ideal for recent graduates.", 0],
  ["Experience: 4+ years managing teams", 4],
  ["Must be at least 18 years old.", 0],
  ["Nice to have:\n• 8+ years of experience in ceramics\nWhat you'll need:\n• 1+ years of studio experience", 1],
];
const nyc = "1. A baccalaureate degree from an accredited college and two years of full-time satisfactory experience in community work; or 2. A four-year high school diploma and six years of full-time satisfactory experience as described in 1 above.";
if (reqYearsOf(nyc, "min") !== 2) { console.log("✗ NYC alternatives (min mode) got", reqYearsOf(nyc, "min")); process.exit(1); }
let fail = 0;
for (const [t, want] of cases) { const got = reqYearsOf(t); if (got !== want) { fail++; console.log(`✗ got ${got}, want ${want}: ${t.slice(0, 80)}`); } }
console.log(fail ? `${fail} failed` : `✓ years parser: ${cases.length} cases`);
process.exit(fail ? 1 : 0);
