// Offline test: discovery parsing, normalizers, city tagging, and a full run on fixture responses.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { slugFromUrl } from "../scripts/discover.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
assert.equal(slugFromUrl("greenhouse", "https://boards.greenhouse.io/stripe/jobs/123"), "stripe");
assert.equal(slugFromUrl("greenhouse", "https://boards.greenhouse.io/embed/job_board?for=Acme"), "acme");
assert.equal(slugFromUrl("greenhouse", "https://job-boards.greenhouse.io/embed/job_app?token=1"), null);
assert.equal(slugFromUrl("lever", "https://jobs.lever.co/palantir/abc-123"), "palantir");
assert.equal(slugFromUrl("ashby", "https://jobs.ashbyhq.com/Ramp/xyz"), "ramp");
console.log("✓ board discovery parsing");

// Use a throwaway board list and output folder
process.env.FIXTURES = path.join(ROOT, "test", "fixtures");
await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
const boardsPath = path.join(ROOT, "data", "boards.json");
let backup = null; try { backup = await fs.readFile(boardsPath, "utf8"); } catch {}
try {
await fs.writeFile(boardsPath, JSON.stringify({ greenhouse: ["stripe", "doesnotexist"], lever: ["palantir"], ashby: ["ramp"] }));
const { run, citiesFor } = await import("../scripts/fetch.mjs");
assert.deepEqual(citiesFor("San Francisco, CA; Remote in US"), ["sf", "remote"]);
assert.deepEqual(citiesFor("Brooklyn, NY"), ["nyc"]);
console.log("✓ city tagging");

const stats = await run();
const nyc = JSON.parse(await fs.readFile(path.join(ROOT, "site", "data", "nyc.json"), "utf8"));
assert.equal(stats.jobs, 5, "hidden Ashby job and duplicates excluded");
assert.equal(nyc.length, 3);
const ae = nyc.find(j => j.c === "Stripe");
assert.equal(ae.p, "$120K–$165K");
assert.equal(nyc.find(j => j.s === "lever").p, "$110K–$200K");
assert.ok(nyc.find(j => j.s === "ashby").p.startsWith("$90K"));
const after = JSON.parse(await fs.readFile(boardsPath, "utf8"));
assert.deepEqual(after.greenhouse, ["stripe"], "missing board dropped");
assert.deepEqual(after.dead.greenhouse, ["doesnotexist"]);
console.log("✓ full run on sample data:", stats.jobs, "jobs,", Object.keys(stats.cities).join(", "));
} finally {
  // always put the real board list back, even when an assertion above fails
  if (backup) await fs.writeFile(boardsPath, backup); else await fs.rm(boardsPath, { force: true });
}

