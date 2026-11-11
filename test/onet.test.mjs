// Offline test: building the O*NET baseline from a tiny sample in O*NET's file format, and title matching.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.env.ONET_OUT = await fs.mkdtemp(path.join(os.tmpdir(), "onet-out-"));
const { build } = await import("../scripts/onet.mjs");
const { buildIndex, matcher } = await import("../scripts/occmatch.mjs");

const out = await build(path.join(ROOT, "test", "fixtures", "onet", "db"), "30.3");
const fa = out.occ.find(o => o[0] === "13-2051.00");
assert.equal(fa[2], 4, "job zone");
assert.deepEqual(fa[3], [0, 5, 0, 70, 25, 0], "education shares by degree level");
assert.deepEqual(fa[4], [20, 0, 30, 50, 0, 0, 0], "experience bands, suppressed rows left out");
assert.deepEqual(fa[5].slice(0, 2), ["Microsoft Excel", "Bloomberg Terminal"], "hot technologies first");
console.log("✓ O*NET baseline built from sample files");

const titles = JSON.parse(await fs.readFile(path.join(process.env.ONET_OUT, "onet-titles.json"), "utf8"));
const occOf = matcher(buildIndex(titles));
const name = t => { const i = occOf(t); return i < 0 ? null : out.occ[i][1]; };
assert.equal(name("Investment Banking Analyst"), "Financial and Investment Analysts");
assert.equal(name("Senior Financial Analyst - FP&A"), "Financial and Investment Analysts");
assert.equal(name("Account Executive, Startups"), "Sales Representatives, Wholesale and Manufacturing, Except Technical and Scientific Products");
assert.equal(name("Software Engineer II (Remote)"), "Software Developers");
assert.equal(name("Staff Backend Engineer, Payments"), "Software Developers");
assert.equal(name("Ceramic Artist / Studio Technician"), "Craft Artists");
assert.equal(name("Chief of Staff"), null, "no loose single-word matches");
console.log("✓ job titles matched to occupations");
const sw = out.occ.find(o => o[0] === "15-1252.00");
assert.equal(sw[6], "", "surveyed occupations aren't borrowed");
const craft = out.occ.find(o => o[0] === "27-1012.00");
assert.equal(craft[3], null, "nothing in the same family to borrow from");
console.log("✓ unsurveyed occupations borrow from their family when possible");
