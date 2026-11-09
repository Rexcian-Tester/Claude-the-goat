# MIST Prep: notes for Claude

Personal study site for the MIST Unit-A exam (22 Jan 2027; moved from 19 Dec 2026). Vite + React + TypeScript PWA, hosted on
**Cloudflare Pages** (project `project-1-rx`), which builds automatically from the `main` branch.
Progress syncs through a Pages Function + KV (`functions/api/sync.ts`). See `README.md` for setup.

## Working with the owner
- Chat in **English**. When mentioning anything that exists on the website (chapter names, part labels, tab
  names), write it **exactly as the site shows it**: Bangla stays Bangla (পরিমাণগত রসায়ন, বাকি অংশ ১/২),
  English stays English (Plan, Focus, Routine).
- Big or schedule changes: first restate what will change (a before/after table works well) and wait for approval.
  Nothing goes to `main` without an explicit yes in the chat.
- Everything runs on **Bangladesh time** (Asia/Dhaka). No other time zones.
- The owner studies mostly offline; the site must keep working offline and never lose progress.

## Code map
- Plan data: `site-source/data/study-plan.json` (the app imports it as-is). Edit it with a script that
  round-trips byte-identically (`q`, `rate` and the 4th column of `trackerChanges` are written as floats, e.g. `8.0`;
  no trailing newline). A day with `items: []` is a **free day** (`isFree`): never owed, not a catch-up day;
  an optional day `note` is shown instead of the generic text.
- **Plan reorganised three times** (`meta.reorganised`: 27 Oct, 6 Nov "MIST Plan v2", 8 Nov "MIST Plan v3" = v2 two
  days later; `meta.rebase` is the latest): days before the rebase are kept byte-identical as history
  (`PlanDay.archived`: never owed, not in Dues/overdue/days behind/overall completion/burn-up/shift). Plan v3 from
  8 Nov: Prime Phase to `meta.syllabusEnd` (13 Dec); Revision Phase 14 Dec – 22 Jan (বৃত্ত, সরলরেখা ও কণিক, 31 days of
  subject `R` রিভিশন + English to 15 Jan, SUST warm-up 16 Jan, then empty "free" days with a `note` for the SUST exam
  17 Jan, rest 21 Jan (`meta.rest`) and MIST 22 Jan, MIST final 18–20 Jan); CU Phase 23–29 Jan (CU prep; CU exam 30 Jan).
  The plan continues after the exam, so `phaseOf` checks exam / rest / endgame dates before plan days; free days are
  never owed and never moved by a shift. Exam 22 Jan 2027 (`meta.exam`; the days-left badge counts to it, "MIST ✓"
  after); the Today countdown counts to `meta.countdownTo` (10 Dec). Items from a reorganisation carry `ix` (10+ /
  20+ / 30+, so keys never collide with the plan they replaced on the same date) and `tk` (tick key per micro-task:
  a reused micro-task keeps its original key, so its tick carries over; "moved" keys stay per item, `PlanItem.mks`).
  A chapter counts finished if finished in any plan version (`eraOf`). Planner edits never move topics across the
  latest rebase. `plan:shift` was replaced by `plan:shift:v2` (old shift kept, unused).
  `meta.skippedByChoice` (বাস্তব সংখ্যা ও অসমতা, যোগাশ্রয়ী প্রোগ্রাম) show "নিজের সিদ্ধান্তে বাদ" on the Priority Map.
  `src/planner/markFinished.ts` once marked the owner's finished old-plan chapters Done (marker `plan:finished:2026-10-27`).
- Study artifacts: `site-source/data/artifacts.json` (one line per HSC chapter: subject, paper, no, Bangla name,
  status ready / coming-soon / none, link, extras, skipped). `src/data/artifacts.ts` matches a plan topic to its row by
  Bangla name (spacing, ও/এবং and small spelling differences ignored; `SPLITS` for two-chapter topics); the
  "📘 Open artifact" button (`src/components/ArtifactLinks.tsx`) shows in Plan, a day's panel, Today and Dues, and
  Map → Subject list (`#/map?view=list`) lists every row. Display only: no synced keys.
- Admission exams: `site-source/data/exams.json` (RU C 9 Jan, SUST A1 17 Jan, MIST 22 Jan = `main`, CU A 30 Jan; one
  line each, edit dates there). `src/components/MyExams.tsx` is the "My exams" card (Today under the countdown, and the
  endgame screens); the Plan tags those dates ("📝 RU C") in the list, Month grid and Endgame tiles. Display only.
  An exam with `"date": null` (IUT, Mar/Apr?) shows last in the card with its `when` text until its date is set on its
  guide page: the synced field `plan:examdate:<tag>` (`{ date, time }`, `setExamDate` in `src/data/exams.ts`), after
  which it counts down and gets a Plan tag like the others. Use `examList()` / `undatedList()` (they read that field).
- Exam guide pages: `site-source/data/exam-guides.json` (keyed by exam tag: MIST A, SUST A1, CU A, IUT; RU has none on
  purpose). Tapping that exam in My exams opens `#/exam/<slug>` (`src/views/ExamGuide.tsx`): pattern and marks, past
  layouts, guidelines, most asked chapters (counted from the owner's question-bank artifacts) and study artifact links.
  Display only.
- Progress keys are allow-listed in `src/sync/merge.ts` (`KEY_RE`); new synced keys must use an existing prefix
  (e.g. `day:<date>:…`). Keys are position-based (`task:<date>:<item>:<i>`), so moving topics on a day that
  already has ticks loses those ticks.
- Your own plan edits (Plan → Edit planner) live in the synced field `plan:edits` and are laid over the JSON by
  `src/logic/planEdits.ts` (`applyEdits`, used by `buildSchedule`); every change saves the previous version as
  `plan:hist:<ms>`. Ticks belong to the topic (`PlanItem.tks`), so moved/split topics keep them. Editing is locked
  unless the device has a passcode and a live sync (`src/planner/actions.ts`). If you change the plan JSON, existing
  edits still point at `<original date>:<item index>`, so check `plan:edits` before reordering a day's items.
- A topic's own Due / Done (`task:<topic key>:status`, `topicMark` in `src/logic/dayStatus.ts`) wins over its ticks and
  the day's "mark done"; with any mark on a day, the day is done only when every topic is done.
- Study Blocks (Focus): one app-wide timer in `src/study/engine.tsx`; logged study time and late starts are synced
  under `day:<date>:focus:*` / `day:<date>:late:*`. Blocks come from the day's routine (`routineFor(date)` in
  `src/views/Routine.tsx`: every day is a full study day, Study Blocks A, B & Revision, C, D; Friday has Jumu'ah
  12:30–2:30 with B ending 12:30 and C at 2:30–4:00, and D as weekly recovery; Sat–Thu C is 2:00–4:00, Refresh
  4:00–5:30, D 5:30–8:30, no Dinner block). The Study Blocks card shows the daily
  Goal 10h / Minimum 9h bar with "…to hold the line" / "…to perfect" / "Perfect day" (`DAILY_GOAL_MIN` / `DAILY_MINIMUM_MIN` and `dailyBar` in `src/logic/pomo.ts`).
  The routine is not dated: past days are shown with today's block times, while their stored data (ticks, late
  starts, study time by block id) is untouched.
  Study time is logged as you go and split by `splitStudy` (`src/logic/pomo.ts`): it counts to the block whose
  window it is in, and once that block reaches its target the extra fills the earliest block still short.
  `revision` ids only exist in data from before the merge.
- Watch sessions (Amazfit Bip 6, separate repo): the watch posts finished focus sessions to the inbox
  `functions/api/watch/sessions.ts` (its own add-only secret `WATCH_TOKEN`; KV key `watch-inbox`). Any device with
  the passcode imports them (`src/watch/inbox.ts`) as one field per session, `day:<date>:watch:<id>`, so a session
  never counts twice. `loggedMs` in `src/study/engine.tsx` = the site's own `day:<date>:focus:<block>` plus the watch's
  share (`src/watch/watchTime.ts`, same splitStudy rules). The timer also records its stretches as
  `day:<date>:span:<device>` so watch minutes overlapping them count once. Never write watch time into `focus:` keys.
  Test without a watch: `scripts/watch-send-test.mjs`.
  The watch's progress screen reads `GET /api/watch/today` (watch token): only the field `day:<date>:watchsum`
  (today's blocks, targets, studied, total, goal, counted watch ids), written by `src/watch/summary.ts` after local
  edits only (never on remote changes, to avoid two devices rewriting it) and filtered by `cleanToday`.
- Desk Buddy companion app (Android, separate repo): reads `GET /api/companion` (`functions/api/companion.ts`, its own
  read-only secret `COMPANION_TOKEN`), a summary built by `src/companion/summary.ts` from the progress document with the
  site's own logic (schedule, ticks, study time incl. watch, late starts, behind, overdue, last 7 days). It never writes.
  The routine's block times live in `src/logic/routine.ts` (pure) so functions can use them; `src/views/Routine.tsx` shows them.
- Cloudflare free plan: Workers KV allows ~1,000 writes a day (reset 00:00 UTC = 6 AM Dhaka), and every sync
  that changes anything is one write of the whole document. Keep writes rare: the Study Blocks timer saves every
  5 min (plus pause/stop/end), and syncs are debounced 10 s after the last change. Over the limit the function
  returns 429 and devices keep their changes until the reset.
- Tests: `npm test` (vitest). Build: `npm run build`. Always run both before pushing.

## Deploying (read this before every push)
Incident, 30 Sep 2026: two changes (a plan note and a font fix) were pushed to `main` but the live site kept
showing the old version for over an hour.
- Cause 1: Cloudflare Pages builds one at a time and was slow; pushing every change to both the working branch
  and `main` doubled the builds in the queue.
- Cause 2: one build failed, but a later commit contained the same change.
- Cause 3 (the one that undid the fix): **"Retry deployment" on an old entry rebuilds that entry's old commit**,
  not the latest `main`. It finished last and replaced the new version on production.
- Made harder to see: each device, browser tab and home-screen app keeps its own offline (service worker) copy.

Checklist:
1. Push **`main` first, once** (`git push origin HEAD:main`); sync the working branch only after `main`.
2. Confirm the build: `npm run deploy:status -- --wait` (reads the "Cloudflare Pages" check GitHub stores on
   the commit; exit 0 = deployed). If GitHub rate-limits, say so and ask the owner to check instead of guessing.
3. Tell the owner the short commit id. **Settings → This device** shows "App version <release name> <id>" (release
   name `RELEASE` in `src/views/Settings.tsx`, currently CR7), so they can see
   whether a screen runs the latest build. When a newer build takes over, the app shows a
   "New version ready · Tap to reload" bar.
4. If the site looks old: compare the Settings version with the newest commit on `main`. If Cloudflare's
   production is behind, use **Rollback to this deployment** on the newest successful entry, or push a new
   commit. Never **Retry** an older entry.
5. The live site (`*.pages.dev` / custom domain) is not reachable from the Claude cloud sandbox; don't claim
   something is live without the check above or the owner's confirmation.
