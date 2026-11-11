// Everything the collector reads out of one job description, in compact fields:
//   y   years of experience required          sk  required skills (ids from skills.mjs)
//   lc  licenses / certifications required    ed  degree level required (negative = "or equivalent experience")
//   ns  says it won't sponsor a visa           sp  says it will sponsor
//   tv  % travel                              od  days a week in the office
//   cl  security clearance needed             gp  pipeline / talent-pool language (used by the ghost scan, then dropped)
import { plainText } from "./years.mjs";
import { analyze } from "./skills.mjs";
import { pipelineLanguage } from "./ghost.mjs";

export function info(parts, mode = "max") {
  const t = plainText((Array.isArray(parts) ? parts : [parts]).filter(Boolean).join("\n"));
  if (!t) return {};
  const out = analyze(t, mode);
  if (pipelineLanguage(t)) out.gp = 1;
  return out;
}
