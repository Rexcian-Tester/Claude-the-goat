# Build my MIST prep website

I'm preparing for the MIST (Military Institute of Science and Technology, Bangladesh) Unit-A admission exam on **19 December 2026**. I already have two finished pages: a chapter priority map, built from 9 years of past papers plus 5 model tests, and a day-by-day study plan. Merge them into one personal website I can use on my phone, tablet, PC and MacBook. I'll host it myself from GitHub on Cloudflare Pages.

## Source data: use this, don't recreate it

Everything is in `site-source/`. The data is final and has been checked twice. **Import the JSON files as-is. Never retype, summarize, reorder or "improve" the content.** Bangla text must appear exactly as written.

- `data/study-plan.json`
  - `meta` (dates, phases, daily method, catch-up rules, endgame)
  - `days[]`: Day 0 is 30 Sep, then 1 Oct–14 Dec. Each item has:
    - `s` subject: P = Physics, C = Chemistry, M = Math, X = catch-up
    - `ch` Bangla chapter name and `en` English name
    - `part`
    - `t` topics string, plus `topicList` (the same topics split into micro-tasks)
    - `k` kind: study / half / cls = class day / buf = catch-up
    - `m` note
    - `info`: tier, rank, rate
  - `trackerChanges[]`
- `data/priority-map.json`
  - `chapters.Phy|Chem|Math[]`, each with:
    - `n` Bangla name, `en` English name, `p` paper, `no` chapter number
    - `full`: true if the chapter is only in the full syllabus
    - `score`, `tier` (T1–T4), `rank`
    - `rate`: average real questions per eligible paper
    - `wr` real question count, `wm` model test count
    - `years`, `days`
    - `topics[].subs[].qs[]`: the actual past questions. Each has `y` (year, or MT1–MT5 for model tests), `q` (question number), `t` (Bangla description) and `m` (true if from a model test).
    - `notTestedInTextbook`
  - Topics and subtopics are already ranked most-asked first.
- `data/priority-extras.json`
  - `findings[]` (HTML strings)
  - `repeats[]` (questions MIST asked more than once)
  - `english[]` (English question patterns)
  - `subjectSummary`, `missingPages`, `shortSyllabusYears`, `fullSyllabusChapters`
- `reference/priority-map.html` and `reference/study-plan.html`: the two current pages. **Match their visual design**: palette tokens, the Noto Serif Bengali + Hind Siliguri + JetBrains Mono fonts, tier pills (স্তর-১ … স্তর-৪), subject chip colours, year dots, and light/dark themes. Treat them as the design system.

A chapter's `n` in priority-map.json matches `ch` in study-plan.json for the same subject, apart from these exceptions:
- Plan `ভেক্টর` (P) also covers Math `ভেক্টর`.
- Plan `সরলরেখা ও কণিক` (M) is a revision day covering Math `সরলরেখা` and `কণিক`.
- Plan `বিস্তার পরিমাপ ও সম্ভাবনা` covers Math `বিস্তার পরিমাপ` and `সম্ভাবনা`.
- Plan `ত্রিকোণমিতিক অনুপাত ও সংযুক্ত কোণ` is Math chapters 6–7.

Write a single mapping module and link the two datasets through it. Write a test that fails if any chapter can't be matched.

## Language rule

The interface can be in English, but **every chapter name, chapter part, topic, subtopic and question stays in Bangla**. That's the language I study in. Show dates and numbers in Bangla digits (০–৯) on study content, with English month names in secondary labels where that helps.

## Tech

- Vite + React + TypeScript, mobile-first, no heavy UI library. Plain CSS with the design tokens from the reference pages.
- Installable PWA with a manifest and service worker, so it works offline from my phone's home screen.
- Local-first: all my progress saves instantly to IndexedDB.
- **Sync across devices** with a Cloudflare Pages Function and Cloudflare KV:
  - One JSON progress document, protected by a passcode I set as an environment secret. No accounts.
  - Merge per field by last-updated timestamp so ticking on my phone and my Mac never overwrites the other.
  - Show a small sync status (synced / offline / conflict resolved).
  - Everything must keep working with no network.
- Export/import all my progress as a JSON file, as a backup.
- Timezone is always **Asia/Dhaka** for "today".
- Include a `README.md` with exact steps: local dev, creating the KV namespace, setting the passcode secret, and deploying via GitHub → Cloudflare Pages.

## Pages and features

### 1. Top bar (always visible)
- A toggle between **Plan** and **Priority Map**, the two main views, plus a **Today** home and a **Progress** page.
- Global search, opened with a keyboard shortcut or the search icon (see section 2).
- Days left until 19 Dec. Also show how far ahead of or behind the plan I am, in days.

### 2. Search (the most important feature)
Search across chapters, topics, subtopics and past questions. It must work with:
- Bangla (`গতিবিদ্যা`)
- English (`dynamics`)
- Banglish/romanized input (`gotibidda`, `lami`, `cannizzaro`)
- Partial words

Build an alias table from `en` plus the Bangla names, and add common English synonyms (e.g. "kinematics" → গতিবিদ্যা, "EMI" → তড়িৎ চৌম্বক আবেশ, "stoichiometry" → পরিমাণগত রসায়ন, "organic" → জৈব রসায়ন).

Each result is a card showing:
- chapter name, subject and paper
- tier pill and rank
- average questions per paper
- a "full syllabus" tag where it applies
- **the exact date(s) it's scheduled in the plan**, with the day number
- status (not started / in progress / done)
- the top 3 subtopics

A subtopic or question result opens its chapter, scrolled to that item. Example: searching "dynamics" shows "গতিবিদ্যা · স্তর-১ · ১০ ও ১১ অক্টোবর (দিন ১০–১১) · ক্লাস দিন + অনুশীলন".

### 3. Today (home screen)
- Today's item(s) from the plan: chapter, part, and badges for class day, half day and catch-up day.
- **Micro-tasks**: each entry in `topicList` is a checkbox.
- The day counts as done when all its micro-tasks are ticked or I mark it done manually.
- A **"Yesterday's formulas" card** at the top: yesterday's chapter and topics, and a 15-minute recall timer.
- **Chapter-end prompt**: on the last day of a chapter, show the chapter's real MIST questions from priority-map.json as a checklist to solve.
- **What's left**: a short note field for anything unfinished. When a day is left partly done, carry its unticked micro-tasks into an "Overdue" list that stays visible until they're cleared or moved to the next catch-up day.
- **End-of-day reflection**, about 30 seconds:
  - hours studied (number)
  - focus rating 1–5
  - "what went well" (one line)
  - "what blocked me" (one line)
  - "tomorrow's first move" (one line)
- Tomorrow's preview.

### 4. Plan view
- The full calendar grouped by phase (গতি তৈরি / শীর্ষ পর্যায় / সমাপ্তি), with the Day 0 row and the endgame (15–17 Dec revision, 18 Dec rest, 19 Dec exam).
- Toggle between list view and a month grid.
- Each day shows its status colour and completion ratio.
- Tapping a day opens its detail: micro-tasks, notes, reflection and a link to the chapter.
- The daily method, the "if you fall behind" rules and the tracker-changes table from `meta` and `trackerChanges`, shown in collapsible panels.
- **Behind/ahead logic**: compare completed study days with calendar days elapsed. If I'm more than 2 days behind, show the cut order from `meta.ifBehind` as a banner. **Never auto-reschedule silently.** Offer a "shift remaining days" preview that I confirm; buffer days absorb the slip first.

### 5. Priority Map view
- Subject tabs for Physics, Chemistry, Math, English and Repeats, exactly as in the reference page.
- Chapter rows ranked by score, showing:
  - tier pill and "full syllabus" tag
  - average per paper, as a bar
  - year dots: dashed for years missing from the PDF, striped for years when the chapter wasn't in the short syllabus (2021-22 to 2023-24 for full-syllabus chapters)
  - model test count and tracker days
- Expanding a chapter shows topics, then subtopics, then the real questions (year, question number, Bangla description), with model test questions visually distinct. It also shows the "textbook parts not seen in papers" note.
- **Integration with the plan:** each chapter row shows its scheduled dates and progress, with a link to those days in the plan.
- **Per-question tracking:** each past question gets a status (unsolved / solved / wrong / revisit) and an optional note. These feed the Progress page and the revision list.

### 6. Chapter page (one per chapter, reached from search, plan or map)
- Everything about the chapter on one page: tier and stats, scheduled days, micro-task progress, ranked topics and subtopics, and the past questions with their statuses.
- Three self-rating ticks per subtopic: "বুঝেছি" (understood), "অনুশীলন করেছি" (practised), "MIST প্রশ্ন সমাধান করেছি" (MIST questions solved).
- A **formula sheet** for the chapter: a markdown text area I write myself, with inline math rendered by KaTeX.
- A confidence slider (1–5) that I update after revising.

### 7. Progress page
- Overall completion. Completion per subject (Physics / Chemistry / Math). Completion per tier (how much of Tier 1 is done).
- Past questions solved out of the total real questions, per subject, plus the "wrong / revisit" count.
- A plan-vs-actual burn-up chart of cumulative study days, and a streak counter for days in a row with the day completed.
- Charts of study hours and focus rating over time, from the reflections, with a 7-day average.
- **Weakest chapters**: lowest confidence × highest tier. This drives revision.
- **Revision list** for 15–17 Dec, generated automatically:
  - every question marked wrong or revisit
  - every Repeats question
  - every chapter with confidence ≤ 2
  - sorted by tier

### 8. Endgame mode (activates automatically on 15 Dec)
- Today switches to the revision list and a timed model test mode: a countdown timer I set, and a checklist of papers.
- On 18 Dec it shows only a rest message and the exam checklist (admit card, pens, calculator rules, travel time).

## Quality bar
- Fast on a mid-range Android phone. The whole dataset is small, so load it once and search in memory with a fuzzy matcher (e.g. Fuse.js).
- Bangla must render correctly, including conjuncts (ক্ষ, ন্ত্র) and subscripts or superscripts in formulas (H₂SO₄, sin⁻¹x, x³). Test with long chapter names such as `বিপরীত ত্রিকোণমিতিক ফাংশন ও ত্রিকোণমিতিক সমীকরণ`.
- Accessible: visible focus states, 44px tap targets, respects prefers-reduced-motion.
- Write unit tests for:
  - the chapter mapping (every plan chapter maps to the priority map, except catch-up days)
  - Dhaka-timezone "today" logic
  - behind/ahead calculation
  - sync merge
- Before you finish, run the app and check the Today, Plan, Priority Map, search ("dynamics", "গতিবিদ্যা", "lami", "ক্যানিজারো") and Progress views at phone width and desktop width, in light and dark themes.

Start by reading all three JSON files and both reference HTML files, then show me your plan (file structure, data model for progress, sync design) before writing code.
