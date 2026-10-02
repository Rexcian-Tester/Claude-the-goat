# MIST Prep: notes for Claude

Personal study site for the MIST Unit-A exam (19 Dec 2026). Vite + React + TypeScript PWA, hosted on
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
  under `day:<date>:focus:*` / `day:<date>:late:*`.
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
3. Tell the owner the short commit id. **Settings → This device** shows "App version <id>", so they can see
   whether a screen runs the latest build. When a newer build takes over, the app shows a
   "New version ready · Tap to reload" bar.
4. If the site looks old: compare the Settings version with the newest commit on `main`. If Cloudflare's
   production is behind, use **Rollback to this deployment** on the newest successful entry, or push a new
   commit. Never **Retry** an older entry.
5. The live site (`*.pages.dev` / custom domain) is not reachable from the Claude cloud sandbox; don't claim
   something is live without the check above or the owner's confirmation.
