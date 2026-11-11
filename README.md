# Minerva Job Feed

A free "server" that collects every open job from company career boards hosted on **Greenhouse, Lever and Ashby**, every six hours, and publishes them as a searchable website plus JSON files your app can read.

It runs entirely on GitHub's free tools:

- **GitHub Actions** runs the collector on a schedule (free for public repositories).
- **GitHub Pages** hosts the results at `https://<your-username>.github.io/<repo-name>/`.

No credit card, no API keys, nothing to install on your computer.

## Other sources

Besides company boards on Greenhouse, Lever and Ashby, each run also reads (see `scripts/sources.mjs`):

- **Workable's public job search** (jobs.workable.com), city by city. This is where many schools, clinics, nonprofits, studios and small businesses post.
- **New York City government jobs** from NYC Open Data (updated daily).
- **Federal jobs from USAJOBS**, if you add two repository secrets: `USAJOBS_KEY` (free, from developer.usajobs.gov) and `USAJOBS_EMAIL` (the email you registered with). Settings → Secrets and variables → Actions.

Fast-food and retail store jobs (cashier, barista, line cook, store associate and similar) are dropped from every source. The count is in `stats.json` as `excludedRetailAndFastFood`.

## The website

`site/index.html` is the Minerva app. It loads the feed for one city at a time (`site/data/{city}.json`) and does everything else in the visitor's browser:

- reads a resume (PDF, Word or text) without uploading it, guesses years of experience and likely role types
- scores every job against experience level, chosen role types, resume words and ranked priorities
- shows the full job description, fetched straight from the company's Greenhouse, Lever or Ashby board
- tracks applications and interviews, with Google/Outlook calendar links
- interview prep, mock interviews and reading recruiter emails use Claude, through an Anthropic API key the visitor saves in their own browser (fine for testing; a public launch should route these through a server)

`site/feed.html` is the plain feed browser.

## How it finds "every" job

These platforms don't publish one master list. Each company has its own public board. So the collector:

1. **Starts from a hand-picked list** of about 65 boards (`seeds/boards.txt`).
2. **Discovers thousands more** each week from the public Common Crawl index, which records career-page URLs found across the web (`jobs.lever.co/…`, `boards.greenhouse.io/…`, `jobs.ashbyhq.com/…`).
3. **Reads every board**, keeps open jobs, and drops boards that no longer exist.

Expect thousands of companies and a very large number of jobs after the first full run. That's most venture-backed startups and many tech and consumer companies. It won't include companies that use Workday, iCIMS or their own systems, or jobs posted only on LinkedIn or Indeed.

## Set it up (about 10 minutes)

1. **Create a free GitHub account** at github.com if you don't have one.
2. **Create a new repository.** Click **+** (top right) → **New repository**. Name it e.g. `minerva-jobs`, choose **Public**, and click **Create repository**.
3. **Upload these files.** On the new repo page, click **uploading an existing file**. Unzip this package on your computer first, then drag in **everything inside the folder**, including the hidden `.github` folder. On a Mac, press Cmd+Shift+. in Finder to show hidden folders. Click **Commit changes**.
   - If the `.github` folder won't upload, create the file by hand instead: **Add file → Create new file**, name it `.github/workflows/update-jobs.yml`, and paste in the contents of that file.
4. **Turn on the website.** Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. **Run it the first time.** Go to the **Actions** tab. If asked, click **I understand my workflows, go ahead and enable them**. Click **Update jobs** → **Run workflow**.
   - For a quick test, set the board limit to `300` (a few minutes).
   - For everything, leave it at `0` (it can take an hour or more on the first run, while it discovers boards).
6. **Open your site.** When the run turns green, its address appears under **Settings → Pages**, e.g. `https://yourname.github.io/minerva-jobs/`.

After that it updates itself every six hours. Jobs that appeared since the last update are marked **New**, and closed jobs disappear.

## What it publishes

| File | What's in it |
|---|---|
| `data/stats.json` | Totals, jobs per city, last update time |
| `data/nyc.json`, `data/sf.json`, `data/remote.json`, … | Jobs for each city, newest first |
| `data/companies.json` | Every company and how many jobs it has open |

Each job looks like this (short keys keep the files small):

```json
{"i":"gh:stripe:101","s":"greenhouse","c":"Stripe","t":"Account Executive, Startups",
 "l":"New York, NY","d":"Sales","p":"$120K–$165K","u":"https://…","o":"2026-11-05","f":"2026-11-10","r":0}
```

`i` id · `s` source · `c` company · `t` title · `l` location · `d` team · `p` pay (when listed) · `u` apply link · `o` date posted · `f` date first seen by this feed · `r` remote · `k` job type.

## Settings you can change

In `.github/workflows/update-jobs.yml`:

- **How often:** `cron: "17 */6 * * *"` means every 6 hours. GitHub may delay scheduled runs a little.
- **Speed:** `CONCURRENCY` is how many boards are read at once. 16 is polite to the job platforms; don't raise it much.

In `scripts/fetch.mjs`, `CITIES` controls which cities get their own file. Add one by copying a line.

## Good to know

- **These are official public feeds.** Greenhouse, Lever and Ashby publish these endpoints so companies' openings can appear on other sites, so no scraping is involved. Keep the request rate polite.
- **Public by default.** GitHub Pages sites from free accounts are public, so anyone with the link can see the job data. Nothing personal is stored; it's only job postings.
- **Discovery isn't perfect.** If a company you care about is missing, add a line like `greenhouse:companyname` to `seeds/boards.txt`. The name is the part after the slash in their careers URL.
- **Test locally (optional):** with Node 20 installed, `npm test` runs the offline tests on sample data.
