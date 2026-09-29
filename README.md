# MIST Prep

A personal study site for the MIST Unit-A admission exam (**19 December 2026**). It merges the chapter priority map and the day-by-day study plan into one installable, offline-capable web app that syncs progress between your phone, tablet, PC and Mac.

- Vite + React + TypeScript, plain CSS, installable PWA
- All progress saves instantly to **IndexedDB** on your device (local-first)
- Optional sync through a **Cloudflare Pages Function + KV**, protected by one passcode, merged per field so two devices never overwrite each other
- Dates and "today" are always **Asia/Dhaka**

Your data lives in [`site-source/data/`](site-source/data). The app imports those three JSON files **as-is**. Never edit them through the app, and nothing in the code retypes or reorders their content.

---

## 1. Run it locally

You need Node 20.19+ (22 recommended; see `.node-version`).

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm test             # unit tests (mapping, Dhaka time, behind/ahead, sync merge, search, ...)
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ locally (no sync function)
npm run icons        # regenerate PWA icons from public/favicon.svg
```

Sync only exists where the Pages Function runs. To try the whole thing locally, including sync:

```bash
npm run build
npx wrangler pages dev dist --kv PROGRESS --binding SYNC_PASSCODE=pick-a-test-passcode
# open http://127.0.0.1:8788, then Settings -> passcode
```

`127.0.0.1` and `localhost` are different origins with separate storage, so opening both is a handy way to imitate two devices.

**Preview a date.** Settings -> *Test date* pretends it is another day (for example 15 Dec to see endgame mode). It is stored on that device only and never synced.

---

## 2. Put the code on GitHub

```bash
git add -A
git commit -m "MIST Prep"
# create an empty repo on github.com first (private is fine), then:
git remote add origin git@github.com:<you>/mist-prep.git
git branch -M main
git push -u origin main
```

---

## 3. Create the KV namespace

The KV namespace stores one JSON document: your progress.

```bash
npx wrangler login
npx wrangler kv namespace create PROGRESS
```

Wrangler prints something like `id = "0123abcd..."`. Paste that id into [`wrangler.toml`](wrangler.toml):

```toml
[[kv_namespaces]]
binding = "PROGRESS"
id = "0123abcd..."          # <- replace REPLACE_WITH_KV_NAMESPACE_ID
```

Commit and push. **Do this before the first deploy.** Because `wrangler.toml` sets `pages_build_output_dir`, Cloudflare reads bindings from this file, so you do not add the KV binding in the dashboard.

(You can also create the namespace in the dashboard: *Storage & Databases -> KV -> Create*, then copy its id.)

---

## 4. Deploy with Cloudflare Pages

1. Cloudflare dashboard -> **Workers & Pages** -> **Create application** -> **Pages** -> **Import an existing Git repository**.
2. Pick your GitHub repo and set:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Under *Environment variables* add `NODE_VERSION` = `22` (the repo's `.node-version` also covers this).
4. **Save and Deploy.** The first build runs. Sync will answer "server not configured" until you finish step 5.

Every push to `main` redeploys automatically. Your site is at `https://<project-name>.pages.dev`.

---

## 5. Set the passcode secret

The passcode is your only protection, so make it long (a 4-5 word phrase is ideal). Nobody can read or write your progress without it.

**Dashboard:** Workers & Pages -> your project -> **Settings** -> **Variables and Secrets** -> **Add** -> name `SYNC_PASSCODE`, type **Secret** (Encrypt), paste the passcode, **Save**.

**or CLI:**

```bash
npx wrangler pages secret put SYNC_PASSCODE --project-name <your-project-name>
```

Then **redeploy** (Deployments -> ... -> Retry deployment, or push any commit) so the function sees it.

---

## 6. Use it on every device

1. Open the site, then **Settings** -> paste the same passcode -> **Save**. The top-bar chip shows `Synced`.
2. Install it:
   - **iPhone/iPad (Safari):** Share -> *Add to Home Screen*
   - **Android (Chrome):** menu -> *Install app*
   - **Mac/PC (Chrome or Edge):** install icon in the address bar
3. Open it once while online so the app and fonts are cached. After that it works with no network.

### Sync, in plain words

- Every tick, note and rating is one field with a timestamp. Devices merge **field by field, newest edit wins**, so ticking on your phone and your Mac never overwrites each other unless you edit the *same* field.
- The chip shows: `Synced`, `Syncing...`, `Offline · N` (N changes waiting), `Conflict resolved` (another device's newer edit won for a field you also changed), `Wrong passcode`, or `Local only` (no passcode set).
- Offline edits are kept and sent automatically when you're back online.
- KV is eventually consistent, so a change can take up to about a minute to show on another device. Your device always keeps its own full copy and re-sends it, so nothing is lost even if two devices sync at the same moment.

### Backups

Settings -> **Export backup** downloads everything as JSON. **Import** can *merge* (newest edit per field wins) or *replace* (this device matches the file exactly). Export one now and then.

---

## How the app works

| Screen | What it does |
|---|---|
| **Today** | Yesterday's formulas + 15-min recall timer, today's micro-tasks, chapter-end MIST questions, overdue list, "what's left" note, 30-second reflection, tomorrow's preview |
| **Plan** | Day 0 through 14 Dec by phase, list or month grid, day sheets, endgame, daily method, "if you fall behind", tracker changes |
| **Priority Map** | Physics / Chemistry / Math / English / Repeats, ranked chapter rows with schedule + progress, per-question tracking |
| **Chapter** | Stats, scheduled days, confidence slider, KaTeX formula sheet, 3 ticks per subtopic, every past question with status and note |
| **Progress** | Completion by subject and tier, questions solved, plan-vs-actual chart, hours and focus charts (7-day average), streak, weakest chapters, revision list |
| **Search** (`Ctrl/Cmd+K` or `/`) | Bangla, English, Banglish (`gotibidda`, `lami`) and partial words, across chapters, topics, subtopics and questions |
| **Endgame** | From 15 Dec: revision list + timed model test + papers checklist. 18 Dec: rest message and exam checklist only |

**Behind / ahead** = study days that should be finished by now (days dated before today; catch-up days are never owed) minus study days finished. A day is finished when all its micro-tasks are ticked, moved or cleared, or you mark it done. More than 2 days behind shows the cut order from your plan. The app **never reschedules on its own**: "Preview shift remaining days" shows exactly what would move (catch-up days absorb the slip first, 15-18 Dec are never touched) and nothing changes until you press *Apply shift*. Reset to the original schedule any time from the Plan page.

### Adding search aliases

Edit [`src/search/aliases.ts`](src/search/aliases.ts): `['Phy', 'Dynamics', ['kinematics', 'your phrase']]`. A test fails if a target chapter doesn't exist.

### The chapter mapping

[`src/data/mapping.ts`](src/data/mapping.ts) is the only place plan chapters are linked to priority-map chapters. Exceptions (Physics and Math vectors, `সরলরেখা ও কণিক`, `বিস্তার পরিমাপ ও সম্ভাবনা`) are listed there, and `npm test` fails if any plan chapter cannot be matched, or any priority-map chapter is left out of the plan without being declared excluded.

---

## Project layout

```
site-source/          your final data + reference pages (untouched)
src/data/             typed loading, mapping, Dhaka dates, Bangla formatting
src/logic/            day status, behind/ahead, overdue, shift, stats, revision list
src/store/            IndexedDB store, sync client, export/import
src/sync/merge.ts     the merge (shared by the browser and the Pages Function)
src/search/           normalisation, Banglish skeleton, aliases, ranking
src/views/            Today, Plan, Map, Chapter, Progress, Search, Endgame, Settings
functions/api/sync.ts Cloudflare Pages Function (auth + KV)
```

## Troubleshooting

- **Chip says "Sync is not available here"** - you're on `npm run dev` or `preview`; the function only runs on Pages or `wrangler pages dev`.
- **"Server not configured"** - the KV id in `wrangler.toml` is still the placeholder, or `SYNC_PASSCODE` isn't set / you haven't redeployed since setting it.
- **"Wrong passcode"** - re-enter it in Settings; it must match the secret exactly.
- **App looks old after a deploy** - close and reopen it; the new version installs in the background.
