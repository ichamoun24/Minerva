// Offline tests: requirement extraction, resume reading, and the ghost-job scan.
import assert from "node:assert/strict";
import { requirementsOf, resumeProfile } from "../scripts/skills.mjs";
import { info } from "../scripts/describe.mjs";
import { scan, pipelineLanguage, generalTitle } from "../scripts/ghost.mjs";

const set = s => new Set((s || "").split(",").filter(Boolean));

// Requirements
let r = requirementsOf(`<h3>Requirements</h3><ul><li>Bachelor's degree in Finance or Economics</li><li>Advanced Excel and PowerPoint skills</li><li>Experience with financial modeling and valuation (DCF, comps)</li></ul>
<h3>Nice to have</h3><ul><li>Experience with SQL or Python</li><li>CFA Level I</li></ul>`);
assert.ok(set(r.sk).has("xl") && set(r.sk).has("ppt") && set(r.sk).has("model") && set(r.sk).has("val"), "required skills read");
assert.ok(!set(r.sk).has("sql") && !set(r.sk).has("py"), "nice-to-have skills left out");
assert.equal(r.lc, undefined, "preferred license left out");
assert.equal(r.ed, 3, "bachelor's required");

r = requirementsOf("Bachelor's degree or equivalent practical experience. Salesforce experience a plus.");
assert.equal(r.ed, -3, "degree or equivalent experience");
assert.ok(!set(r.sk).has("sfdc"));

r = requirementsOf("Must hold an active Series 7 and Series 63. We are unable to sponsor visas for this role. Travel up to 25%. This role is in the office 4 days a week.");
assert.deepEqual([...set(r.lc)].sort(), ["s63", "s7"]);
assert.equal(r.ns, 1); assert.equal(r.tv, 25); assert.equal(r.od, 4);

r = requirementsOf("Candidates must be authorized to work in the US without the need for current or future visa sponsorship.");
assert.equal(r.ns, 1, "without sponsorship = no sponsor");
r = requirementsOf("Visa sponsorship is available for this position.");
assert.equal(r.sp, 1); assert.equal(r.ns, undefined);

r = requirementsOf("Experience wheel-throwing and glazing; comfortable loading and firing a kiln. Teaching artist experience with youth.");
assert.ok(set(r.sk).has("ceramics") && set(r.sk).has("teachart"), "arts skills read");
r = requirementsOf("Experience in Microsoft Excel and the ability to excel in a fast-paced environment.");
assert.ok(set(r.sk).has("xl"));
assert.ok(!set(requirementsOf("You will excel in a fast-paced environment.").sk).has("xl"), "excel the verb is not Excel");
console.log("✓ requirements from descriptions");

// Resume
const cv = resumeProfile(`Jane Doe
EDUCATION  University of Michigan, B.A. Economics
EXPERIENCE  Morgan Stanley, Investment Banking Analyst — built DCF and LBO models, comps; pitch books in PowerPoint; Capital IQ, FactSet
SKILLS  Excel, PowerPoint, Python (basic), Bloomberg Terminal. Series 79 and 63. Fluent in Spanish.`);
for (const id of ["xl", "ppt", "py", "lbo", "val", "capiq", "bbg", "spanish"]) assert.ok(cv.skills.includes(id), "resume skill " + id);
assert.deepEqual(cv.lic.sort(), ["s63", "s79"]);
assert.equal(cv.degree, 3);
console.log("✓ resume skills, licenses and degree");

// Ghost scan
assert.ok(pipelineLanguage("We are building a talent pool for future opportunities on our team."));
assert.ok(pipelineLanguage("This is an evergreen role; we are always accepting applications."));
assert.ok(!pipelineLanguage("You will build a sales pipeline and close new business."), "a sales pipeline is not a talent pipeline");
assert.ok(generalTitle("General Application - New York"));
assert.ok(!generalTitle("Account Executive, Startups"));
assert.equal(info("Join our talent community for future opportunities.").gp, 1);

const today = "2026-11-11";
const jobs = () => [
  { i: "gh:a:1", s: "greenhouse", c: "Acme", t: "Analyst", l: "New York, NY", o: "2026-11-01" },
  { i: "gh:a:2", s: "greenhouse", c: "Acme", t: "Sales Lead", l: "New York, NY", o: "2026-04-01" },
  { i: "gh:a:3", s: "greenhouse", c: "Acme", t: "Talent Community", l: "New York, NY", o: "2026-11-01" },
  { i: "ny:9", s: "nycgov", c: "Parks", t: "Clerk", l: "New York City", o: "2025-01-01" },
  { i: "gh:a:4", s: "greenhouse", c: "Acme", t: "Designer", l: "New York, NY", o: "2026-11-01", gp: 1 },
];
const city = () => "nyc";
let js = jobs(); let hist = scan(js, {}, today, city);
const by = id => js.find(j => j.i === id);
assert.equal(by("gh:a:1").g, undefined, "fresh posting is fine");
assert.equal(by("gh:a:2").g, 1); assert.equal(by("gh:a:2").gr, "a180");
assert.equal(by("gh:a:3").g, 2, "general-application title");
assert.equal(by("ny:9").g, undefined, "government postings are not penalized for time open");
assert.equal(by("gh:a:4").g, 2); assert.equal(by("gh:a:4").gp, undefined, "gp dropped after scan");

// The analyst role closes, then comes back under a new id: a repost.
js = jobs().filter(j => j.i !== "gh:a:1"); hist = scan(js, hist, "2026-11-12", city);
js = jobs().map(j => j.i === "gh:a:1" ? { ...j, i: "gh:a:99", o: "2026-11-20" } : j); hist = scan(js, hist, "2026-11-20", city);
assert.equal(by("gh:a:99").g, undefined, "one quick repost alone is not enough");
// …and again
js = jobs().filter(j => j.i !== "gh:a:1"); hist = scan(js, hist, "2026-11-25", city);
js = jobs().map(j => j.i === "gh:a:1" ? { ...j, i: "gh:a:100", o: "2026-11-30" } : j); scan(js, hist, "2026-11-30", city);
assert.equal(by("gh:a:100").g, 1); assert.equal(by("gh:a:100").gr, "rp3", "third posting of the same role");
// a long-lived role that keeps getting reposted: time open counts from the first sighting
js = [{ i: "gh:z:1", s: "greenhouse", c: "Zed", t: "Analyst", l: "NYC", o: "2026-11-01" }];
let h2 = scan(js, {}, "2026-06-01", city); js = [{ ...js[0], i: "gh:z:2", o: "2026-11-01" }]; scan(js, h2, "2026-11-11", city);
assert.equal(js[0].gr, "a90,rp2"); assert.equal(js[0].g, 1);

// 15+ identical postings
js = Array.from({ length: 16 }, (_, n) => ({ i: "gh:b:" + n, s: "greenhouse", c: "Big", t: "Sales Rep", l: "City " + n, o: "2026-08-01" }));
scan(js, {}, today, () => "");
assert.equal(js[0].gr, "a90,mass");
console.log("✓ ghost-job scan");
// boilerplate and look-alike words are not requirements
r = requirementsOf("We are an equal opportunity employer and comply with all laws; our recruiting team reviews every application. Salary is negotiable. Attention to accurate data.");
assert.equal(r.sk, undefined, "boilerplate, 'negotiable' and 'accurate' don't count");
console.log("✓ boilerplate ignored");
