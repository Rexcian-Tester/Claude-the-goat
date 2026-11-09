export type Subject = 'Phy' | 'Chem' | 'Math'
/** X = catch-up day, R = a Revision Phase day (neither is a chapter) */
export type PlanSubject = 'P' | 'C' | 'M' | 'X' | 'R'
export type Kind = 'study' | 'half' | 'cls' | 'buf'
export type Tier = 'T1' | 'T2' | 'T3' | 'T4'

export interface RawQuestion { y: string; q: string; t: string; m: boolean }
export interface RawSub { n: string; wr: number; wm: number; years: string[]; qs: RawQuestion[] }
export interface RawTopic { n: string; wr: number; wm: number; years: string[]; subs: RawSub[] }
export interface RawChapter {
  en: string
  n: string
  p: string
  no: number | string
  full: boolean
  score: number
  rate: number
  eff: number
  wr: number
  wm: number
  years: string[]
  days: number | null
  topics: RawTopic[]
  rank: number
  notTestedInTextbook: string | null
  tier: Tier
}
export interface PriorityMapJson { _readme: string; chapters: Record<Subject, RawChapter[]> }

export interface RawPlanItem {
  s: PlanSubject
  ch: string
  part: string
  t: string
  k: Kind
  m: string | null
  en: string
  topicList: string[]
  info?: { tier: Tier; rate: number; rank: number; en: string; full: boolean; q: number } | null
  /** days from meta.rebase on: the item's index in its keys (10+, so it never collides with an old item on that date) */
  ix?: number
  /** days from meta.rebase on: tick key per micro-task (a micro-task reused from the old plan keeps its old key) */
  tk?: string[]
}
export interface RawPlanDay { date: string; wd: string; phase: string; items: RawPlanItem[]; /** what was done on a free day */ note?: string }
export interface StudyPlanJson {
  _readme: string
  meta: {
    studyWindow: string
    day0: string
    revision: string[]
    /** a pure rest day before the exam, if any */
    rest: string | null
    exam: string
    timezone: string
    kinds: Record<Kind, string>
    phases: { name: string; range: string; about: string }[]
    dailyMethod: string[]
    ifBehind: string[]
    endgame: { date: string; what: string }[]
    intentionallyExcluded: string[]
    /** the plan was reorganised from this date; earlier days are kept as history and never owed */
    rebase: string
    /** every date the plan was reorganised, oldest first (the last is `rebase`) */
    reorganised?: string[]
    /** the date the Today countdown counts down to (00:00 Bangladesh time that day) */
    countdownTo?: string
    /** last day of the syllabus (the Today countdown) */
    syllabusEnd: string
    /** chapters left out on purpose (Priority Map shows them as skipped; not counted as remaining work) */
    skippedByChoice: string[]
  }
  days: RawPlanDay[]
  trackerChanges: [PlanSubject, string, number, number, string?][]
}

/** site-source/data/artifacts.json: one row per syllabus chapter with its study artifact */
export type ArtifactStatus = 'ready' | 'coming-soon' | 'none'
export interface ArtifactChapter {
  subject: Subject | 'Eng'
  paper: 1 | 2
  /** chapter order in the syllabus */
  no: number
  /** Bangla name */
  name: string
  status: ArtifactStatus
  link: string | null
  extras: { label: string; url: string }[]
  /** a chapter left out on purpose */
  skipped?: boolean
}
export interface ArtifactsJson { _readme: string; chapters: ArtifactChapter[] }

/** site-source/data/exams.json: admission exams (display only) */
export interface Exam {
  /** short label for tags, e.g. "RU C" */
  tag: string
  name: string
  unit: string
  /** YYYY-MM-DD, Bangladesh time */
  date: string
  /** 24-hour HH:MM */
  time: string
  format: string
  calculator: string
  subjects: string
  /** the main exam (MIST) */
  main?: boolean
  /** study links shown right in the card (exams with no guide page) */
  links?: { label: string; url: string }[]
}
/** An exam whose date is not announced yet (IUT): no Plan tag, no countdown. */
export interface UndatedExam extends Omit<Exam, 'date' | 'time'> {
  date: null
  time: null
  /** e.g. "Mar/Apr 2027? (date not announced)" */
  when: string
}
export interface ExamsJson { _readme: string; source: string; exams: (Exam | UndatedExam)[] }

/** site-source/data/exam-guides.json: one guide page per exam (#/exam/<slug>), keyed by Exam.tag. Display only. */
export interface ExamGuide {
  slug: string
  title: string
  kind: string
  /** [label, value] key facts */
  stats: [string, string][]
  /** [subject, questions, marks] */
  split: [string, number, number][]
  perQ: number
  history: string[]
  /** which papers the chapter counts come from */
  topFrom: string
  top: { subject: 'Physics' | 'Chemistry' | 'Math'; chapters: [string, number][] }[]
  /** English question types: [type, how many in the real papers] */
  english: [string, number][]
  tips: string[]
  /** [label, url, note] */
  links: [string, string, string][]
  source: string
}
export interface ExamGuidesJson { _readme: string; guides: Record<string, ExamGuide> }

export interface Repeat { subject: string; question: string; where: string; match: string }
export interface PriorityExtrasJson {
  findings: string[]
  repeats: Repeat[]
  english: { type: string; frequency: string }[]
  subjectSummary: Record<Subject, string>
  missingPages: Record<Subject, string[]>
  shortSyllabusYears: string[]
  fullSyllabusChapters: Record<string, string[]>
}

/* ---- enriched (ids added) ---- */
export interface Question extends RawQuestion { id: string; chapterId: string; topicIdx: number; subIdx: number }
export interface Sub extends Omit<RawSub, 'qs'> { id: string; qs: Question[] }
export interface Topic extends Omit<RawTopic, 'subs'> { id: string; subs: Sub[] }
export interface Chapter extends Omit<RawChapter, 'topics'> {
  id: string
  subject: Subject
  paper: 1 | 2
  topics: Topic[]
}
