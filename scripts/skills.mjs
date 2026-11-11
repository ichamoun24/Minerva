// Requirements read out of a job description, and the same skills read out of a resume.
// One dictionary serves both sides, so "matches 5 of 7 skills" compares like with like.
// Each entry: [id, label, group, pattern]. Patterns are matched case-insensitively.
import { plainText, reqYearsOf } from "./years.mjs";

export const SKILLS = [
  // office and general tools
  ["xl", "Excel", "Office tools", String.raw`\b(ms |microsoft )?excel\b(?!\s+(in|at|as|with|under)\b)`],
  ["ppt", "PowerPoint", "Office tools", String.raw`\bpower ?point\b`],
  ["gsuite", "Google Workspace", "Office tools", String.raw`\bg ?suite\b|google workspace|google sheets`],
  ["sfdc", "Salesforce", "Sales and CRM", String.raw`\bsalesforce\b|\bsfdc\b`],
  ["hubspot", "HubSpot", "Sales and CRM", String.raw`\bhubspot\b`],
  ["crm", "CRM tools", "Sales and CRM", String.raw`\bcrm\b`],
  ["jira", "Jira", "Project tools", String.raw`\bjira\b`],
  ["asana", "Asana", "Project tools", String.raw`\basana\b`],
  ["notion", "Notion", "Project tools", String.raw`\bnotion\b(?! of)`],
  ["pm", "Project management", "Project tools", String.raw`project management|program management|\bpmp\b`],
  ["agile", "Agile / Scrum", "Project tools", String.raw`\bagile\b|\bscrum\b`],
  // data
  ["sql", "SQL", "Data", String.raw`\bsql\b|postgres|mysql`],
  ["py", "Python", "Data", String.raw`\bpython\b`],
  ["rlang", "R", "Data", String.raw`\bR (programming|language|studio)\b|\brstudio\b|\bR\b,? (and|or|\/) python|python,? (and|or|\/) R\b`],
  ["tableau", "Tableau", "Data", String.raw`\btableau\b`],
  ["powerbi", "Power BI", "Data", String.raw`\bpower ?bi\b`],
  ["looker", "Looker", "Data", String.raw`\blooker\b`],
  ["snow", "Snowflake", "Data", String.raw`\bsnowflake\b`],
  ["dbt", "dbt", "Data", String.raw`\bdbt\b`],
  ["spark", "Spark", "Data", String.raw`\b(apache )?spark\b`],
  ["stats", "Statistics", "Data", String.raw`\bstatistic(s|al)\b|regression analysis|a\/b test`],
  ["ml", "Machine learning", "Data", String.raw`machine learning|\bml\b|deep learning`],
  ["llm", "LLMs / generative AI", "Data", String.raw`\bllms?\b|large language model|generative ai|\bgenai\b|prompt engineering`],
  ["ga", "Google Analytics", "Marketing", String.raw`google analytics|\bga4\b`],
  // engineering
  ["js", "JavaScript", "Engineering", String.raw`\bjavascript\b`],
  ["ts", "TypeScript", "Engineering", String.raw`\btypescript\b`],
  ["react", "React", "Engineering", String.raw`\breact(\.js|js)?\b(?! to)`],
  ["node", "Node.js", "Engineering", String.raw`\bnode(\.js|js)\b`],
  ["java", "Java", "Engineering", String.raw`\bjava\b(?!\s*script)`],
  ["golang", "Go", "Engineering", String.raw`\bgolang\b|\bgo (programming|language)\b`],
  ["cpp", "C++", "Engineering", String.raw`c\+\+`],
  ["csharp", "C#", "Engineering", String.raw`\bc#|\.net\b`],
  ["ruby", "Ruby", "Engineering", String.raw`\bruby\b|\brails\b`],
  ["swift", "Swift / iOS", "Engineering", String.raw`\bswift(ui)?\b|\bios development\b`],
  ["kotlin", "Kotlin / Android", "Engineering", String.raw`\bkotlin\b|\bandroid development\b`],
  ["aws", "AWS", "Engineering", String.raw`\baws\b|amazon web services`],
  ["gcp", "Google Cloud", "Engineering", String.raw`\bgcp\b|google cloud`],
  ["azure", "Azure", "Engineering", String.raw`\bazure\b`],
  ["k8s", "Kubernetes", "Engineering", String.raw`\bkubernetes\b|\bk8s\b`],
  ["docker", "Docker", "Engineering", String.raw`\bdocker\b`],
  ["git", "Git", "Engineering", String.raw`\bgit\b|github|gitlab`],
  ["api", "APIs", "Engineering", String.raw`\brest(ful)? api|\bapis?\b`],
  ["sec", "Security", "Engineering", String.raw`\bcyber ?security\b|information security|\bsoc 2\b|penetration test`],
  // design
  ["figma", "Figma", "Design", String.raw`\bfigma\b`],
  ["adobe", "Adobe Creative Suite", "Design", String.raw`adobe creative|creative cloud|creative suite|\bphotoshop\b|\billustrator\b|\bindesign\b`],
  ["video", "Video editing", "Design", String.raw`premiere pro|final cut|after effects|video editing|davinci resolve`],
  ["ux", "UX research and design", "Design", String.raw`\bux\b|user experience|user research|usability`],
  ["cad", "CAD", "Design", String.raw`\bautocad\b|\brevit\b|\bsolidworks\b|\bcad\b`],
  // finance and real estate
  ["model", "Financial modeling", "Finance", String.raw`financial model(l)?ing|\bmodel(l)?ing\b.{0,20}\b(financial|dcf|lbo|three[- ]statement)`],
  ["val", "Valuation (DCF, comps)", "Finance", String.raw`\bvaluation\b|\bdcf\b|comparable compan|precedent transaction`],
  ["lbo", "LBO modeling", "Finance", String.raw`\blbo\b|leveraged buyout`],
  ["ma", "M&A", "Finance", String.raw`\bm&a\b|mergers (and|&) acquisitions`],
  ["fpa", "FP&A / budgeting", "Finance", String.raw`\bfp&a\b|budgeting|forecasting`],
  ["gaap", "GAAP / accounting", "Finance", String.raw`\bgaap\b|\bifrs\b|general ledger|month[- ]end close|reconciliation`],
  ["uw", "Underwriting", "Finance", String.raw`underwrit`],
  ["capiq", "Capital IQ / PitchBook / FactSet", "Finance", String.raw`capital ?iq|\bcapiq\b|pitchbook|factset`],
  ["bbg", "Bloomberg Terminal", "Finance", String.raw`bloomberg (terminal|professional)`],
  ["argus", "Argus", "Real estate", String.raw`\bargus\b`],
  ["yardi", "Yardi", "Real estate", String.raw`\byardi\b`],
  ["costar", "CoStar", "Real estate", String.raw`\bcostar\b`],
  ["qb", "QuickBooks", "Finance", String.raw`quickbooks`],
  ["netsuite", "NetSuite", "Finance", String.raw`netsuite`],
  ["sap", "SAP", "Finance", String.raw`\bsap\b`],
  ["wday", "Workday (HR/finance)", "Finance", String.raw`\bworkday\b`],
  // sales, marketing, customer
  ["b2b", "B2B / SaaS sales", "Sales and CRM", String.raw`\bb2b\b|\bsaas\b`],
  ["prospect", "Prospecting / cold outreach", "Sales and CRM", String.raw`prospecting|cold (call|email|outreach)|outbound`],
  ["quota", "Quota-carrying sales", "Sales and CRM", String.raw`\bquota\b`],
  ["negot", "Negotiation", "Sales and CRM", String.raw`\bnegotiat`],
  ["acctmgmt", "Account management", "Sales and CRM", String.raw`account management|client relationship|relationship management`],
  ["cs", "Customer success / support", "Sales and CRM", String.raw`customer success|customer support|zendesk|intercom`],
  ["seo", "SEO / SEM", "Marketing", String.raw`\bseo\b|\bsem\b|search engine optimi`],
  ["paid", "Paid media", "Marketing", String.raw`paid (social|media|search)|google ads|meta ads|facebook ads`],
  ["social", "Social media", "Marketing", String.raw`social media|tiktok|instagram`],
  ["content", "Content and copywriting", "Marketing", String.raw`copywriting|content (strategy|creation|marketing)|editorial`],
  ["email", "Email marketing", "Marketing", String.raw`email marketing|klaviyo|mailchimp|braze`],
  ["events", "Event planning", "Marketing", String.raw`event (planning|management|production)`],
  ["pr", "Public relations", "Marketing", String.raw`public relations|media relations|press release`],
  // people, legal, operations
  ["recruit", "Recruiting", "People", String.raw`\brecruiting\b|talent acquisition|sourcing candidates`],
  ["hris", "HRIS", "People", String.raw`\bhris\b|bamboohr|greenhouse ats|\bats\b`],
  ["contracts", "Contracts", "Legal", String.raw`contract (drafting|review|negotiation|management)`],
  ["compliance", "Compliance", "Legal", String.raw`\bcompliance\b|\baml\b|\bkyc\b`],
  ["supply", "Supply chain / logistics", "Operations", String.raw`supply chain|logistics|procurement|inventory management`],
  // healthcare and care work
  ["emr", "EMR / EHR (e.g. Epic)", "Healthcare", String.raw`\bemr\b|\behr\b|\bepic\b(?! (journey|story|games))|electronic (medical|health) record`],
  ["bls", "BLS / CPR", "Healthcare", String.raw`\bbls\b|\bcpr\b|basic life support`],
  ["hipaa", "HIPAA", "Healthcare", String.raw`\bhipaa\b`],
  ["aba", "ABA therapy", "Healthcare", String.raw`\baba\b|applied behavior analysis`],
  ["casemgmt", "Case management", "Community", String.raw`case management|case manager|caseload`],
  ["clinical", "Clinical experience", "Healthcare", String.raw`clinical (experience|setting|rotation)`],
  ["bilingual", "Bilingual", "Languages", String.raw`\bbilingual\b`],
  ["spanish", "Spanish", "Languages", String.raw`\bspanish\b`],
  ["mandarin", "Mandarin", "Languages", String.raw`\bmandarin\b|\bchinese \(mandarin\)`],
  ["french", "French", "Languages", String.raw`\bfrench\b(?! (fries|toast|press))`],
  ["portuguese", "Portuguese", "Languages", String.raw`\bportuguese\b`],
  ["asl", "American Sign Language", "Languages", String.raw`american sign language|\basl\b`],
  // education
  ["sped", "Special education", "Education", String.raw`special education|\biep\b|students with disabilities`],
  ["esl", "ESL / ELL", "Education", String.raw`\besl\b|\bell\b|english language learner|\btesol\b`],
  ["curric", "Curriculum design", "Education", String.raw`curriculum (design|development)|lesson plan`],
  ["classroom", "Classroom management", "Education", String.raw`classroom management|classroom instruction`],
  ["tutor", "Tutoring", "Education", String.raw`\btutor`],
  ["youth", "Working with youth", "Community", String.raw`working with (youth|children|young people|students)|youth development`],
  // nonprofit and community
  ["grants", "Grant writing", "Community", String.raw`grant (writing|writer|proposal|management)|grants management`],
  ["fundraise", "Fundraising", "Community", String.raw`fundrais|donor (relations|cultivation|stewardship)|major gifts`],
  ["raisers", "Donor databases (Raiser's Edge)", "Community", String.raw`raiser'?s edge|blackbaud|salesforce npsp|donor perfect`],
  ["outreach", "Community outreach", "Community", String.raw`community (outreach|engagement|organizing)`],
  ["volunteer", "Volunteer management", "Community", String.raw`volunteer (management|coordination|recruitment)`],
  // arts and culture
  ["ceramics", "Ceramics / pottery", "Arts", String.raw`ceramic|pottery|wheel[- ]throwing|glaz(e|ing)\b|\bkiln`],
  ["arthandling", "Art handling", "Arts", String.raw`art handling|art handler|installation of (art|exhibitions)`],
  ["exhibit", "Exhibitions / curation", "Arts", String.raw`exhibition|curat(e|ion|orial)`],
  ["collections", "Collections / archives", "Arts", String.raw`collections management|archiv(e|ist|al)|registrar`],
  ["photo", "Photography", "Arts", String.raw`photograph`],
  ["music", "Music", "Arts", String.raw`\bmusic(al|ian)?\b|pro tools|ableton`],
  ["theater", "Theater / stage production", "Arts", String.raw`theat(er|re)|stage manag|production manag`],
  ["teachart", "Arts education", "Arts", String.raw`teaching artist|arts education|art instruction`],
  // trades and culinary
  ["osha", "OSHA safety", "Trades", String.raw`\bosha\b`],
  ["hvac", "HVAC", "Trades", String.raw`\bhvac\b`],
  ["electrical", "Electrical", "Trades", String.raw`electrical (work|systems|wiring|license)|electrician`],
  ["plumbing", "Plumbing", "Trades", String.raw`plumbing|plumber`],
  ["carpentry", "Carpentry / woodworking", "Trades", String.raw`carpent|woodwork`],
  ["forklift", "Forklift", "Trades", String.raw`forklift`],
  ["culinary", "Culinary / kitchen", "Trades", String.raw`culinary|kitchen (management|operations)|food safety|servsafe`],
];

// Licenses and certifications are kept apart: missing one usually rules a job out.
export const LICENSES = [
  ["cpa", "CPA", String.raw`\bcpa\b|certified public accountant`],
  ["cfa", "CFA", String.raw`\bcfa\b|chartered financial analyst`],
  ["s7", "Series 7", String.raw`series (\d{1,2},? ?(and|&|\/|,) ?)*7\b`],
  ["s63", "Series 63/66", String.raw`series (\d{1,2},? ?(and|&|\/|,) ?)*6[36]\b`],
  ["s79", "Series 79", String.raw`series (\d{1,2},? ?(and|&|\/|,) ?)*79\b`],
  ["re", "Real estate license", String.raw`real estate (license|salesperson license|broker license)|licensed real estate`],
  ["bar", "Bar admission", String.raw`admitted to (the|practice|a) .{0,20}bar|bar admission|member (of|in good standing of) the .{0,30}bar`],
  ["rn", "RN license", String.raw`\brn\b license|registered nurse license|licensed registered nurse|current rn\b|active rn\b`],
  ["lcsw", "LCSW / LMSW", String.raw`\blcsw\b|\blmsw\b|licensed (clinical|master) social worker`],
  ["teachcert", "Teaching certification", String.raw`teaching (certification|certificate|license)|certified teacher|state certification in`],
  ["pe", "PE license", String.raw`professional engineer|\bpe license\b|licensed pe\b`],
  ["cdl", "CDL", String.raw`\bcdl\b|commercial driver'?s license`],
  ["pmp", "PMP", String.raw`\bpmp\b`],
  ["drivers", "Driver's license", String.raw`valid driver'?s license`],
];

const DEG = [
  [5, String.raw`ph\.?\s?d\b|doctorate|doctoral degree|\bm\.?d\.?\b(?!a)|\bj\.?d\.?\b|juris doctor`],
  [4, String.raw`master'?s|\bmba\b|\bm\.s\.|\bm\.a\.|\bmsw\b|\bmfa\b|graduate degree`],
  [3, String.raw`bachelor'?s|\bb\.?s\.?\b|\bb\.?a\.?\b|\bbba\b|\bbfa\b|\bbsc\b|undergraduate degree|four[- ]year degree|college degree|university degree|baccalaureate`],
  [2, String.raw`associate'?s degree|associate degree|two[- ]year degree`],
  [1, String.raw`high school diploma|\bged\b|high school equivalen`],
];
export const DEGREE_LABEL = ["None stated", "High school", "Associate's", "Bachelor's", "Master's", "Doctorate / JD / MD"];

const C = re => new RegExp(re, "i");
const SKILL_RE = SKILLS.map(([id, , , re]) => [id, C(re)]);
const LIC_RE = LICENSES.map(([id, , re]) => [id, C(re)]);
const DEG_RE = DEG.map(([n, re]) => [n, C(re)]);
const PREF = /\b(prefer|preferred|nice to have|a plus|is a bonus|bonus points|ideally|desired|desirable)\b/i;

function sentences(t) { return t.split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(Boolean); }

// Required skills and credentials from a description. Things mentioned only as "preferred" are left out.
export function requirementsOf(raw) {
  const t = plainText(raw); if (!t) return {};
  const req = new Set(), lic = new Set();
  let degReq = 0, degEq = false, noSponsor = false, sponsors = false, travel = 0, office = 0, clearance = false;
  let prefSection = false;
  for (const s of sentences(t)) {
    if (s.length < 70 && /\b(preferred|nice[- ]to[- ]have|bonus|pluses|desired)\b/i.test(s) && !/required|minimum/i.test(s)) { prefSection = true; continue; }
    if (s.length < 70 && /\b(required|requirements|minimum|basic qualifications|what you('ll)? (need|bring)|you have|must have|qualifications)\b/i.test(s)) prefSection = false;
    const pref = prefSection || PREF.test(s);
    if (!pref) {
      for (const [id, re] of SKILL_RE) if (re.test(s)) req.add(id);
      for (const [id, re] of LIC_RE) if (re.test(s)) lic.add(id);
      if (/degree|diploma|bachelor|master|ph\.?d|doctorate|ged\b|baccalaureate|juris/i.test(s)) {
        for (const [n, re] of DEG_RE) if (re.test(s)) { if (!degReq || n < degReq) degReq = n; break; }
        if (/or (equivalent|comparable) (practical |professional |work )?experience|equivalent combination|in lieu of/i.test(s)) degEq = true;
      }
    }
    if (/(unable|not able|cannot|can'?t|will not|won'?t|do not|does not|is not able|are not able|not)\s+(to\s+)?(currently\s+)?(provide|offer|support)?\s*(visa\s+|immigration\s+|employment\s+)?sponsor/i.test(s)
      || /without (the )?(need for )?(current or future |now or in the future )?(visa |immigration |employment )?sponsorship/i.test(s)) noSponsor = true;
    else if (/(visa sponsorship (is )?(available|offered|provided)|will sponsor|able to sponsor|offers? (visa|h-?1b) sponsorship|sponsorship available)/i.test(s)) sponsors = true;
    let m = s.match(/travel[^.%]{0,30}?(\d{1,3})\s?%|(\d{1,3})\s?%[^.]{0,20}travel/i);
    if (m) { const v = +(m[1] || m[2]); if (v > travel && v <= 100) travel = v; }
    m = s.match(/(\d|one|two|three|four|five)\s*(?:days?|x)\s*(?:a|per|each|\/)\s*week[^.]{0,30}(office|on[- ]?site|in[- ]person)|(office|on[- ]?site|in[- ]person)[^.]{0,30}?(\d|one|two|three|four|five)\s*(?:days?|x)\s*(?:a|per|each|\/)\s*week/i);
    if (m) { const w = { one: 1, two: 2, three: 3, four: 4, five: 5 }; const v = w[(m[1] || m[4]).toLowerCase()] ?? +(m[1] || m[4]); if (v >= 1 && v <= 5 && v > office) office = v; }
    else if (/fully (on[- ]?site|in[- ]office|in[- ]person)|five days (a|per) week in/i.test(s)) office = 5;
    if (/security clearance|\bts\/sci\b|top secret|secret clearance|public trust clearance/i.test(s)) clearance = true;
  }
  const out = {};
  if (req.size) out.sk = [...req].slice(0, 14).join(",");
  if (lic.size) out.lc = [...lic].join(",");
  if (degReq) out.ed = degEq ? -degReq : degReq;     // negative = "or equivalent experience" accepted
  if (noSponsor) out.ns = 1; else if (sponsors) out.sp = 1;
  if (travel) out.tv = travel;
  if (office) out.od = office;
  if (clearance) out.cl = 1;
  return out;
}

// Skills, licenses and highest degree on a resume (same dictionary).
export function resumeProfile(raw) {
  const t = plainText(raw);
  const skills = SKILL_RE.filter(([, re]) => re.test(t)).map(([id]) => id);
  const lic = LIC_RE.filter(([, re]) => re.test(t)).map(([id]) => id);
  let degree = 0; for (const [n, re] of DEG_RE) if (re.test(t)) { degree = n; break; }
  return { skills, lic, degree };
}

// Everything the collector keeps from one description: years required plus the requirements above.
export function analyze(raw, mode = "max") {
  const t = plainText(raw); if (!t) return {};
  const out = requirementsOf(t);
  const y = reqYearsOf(t, mode); if (y) out.y = y;
  return out;
}

// The dictionary the website needs to read resumes the same way.
export function skillsForSite() {
  return { skills: SKILLS.map(([id, label, group, re]) => [id, label, group, re]), licenses: LICENSES.map(([id, label, re]) => [id, label, re]), degrees: DEG.map(([n, re]) => [n, re]), degreeLabels: DEGREE_LABEL };
}
