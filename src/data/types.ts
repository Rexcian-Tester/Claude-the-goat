export type Subject = 'Phy' | 'Chem' | 'Math'
export type PlanSubject = 'P' | 'C' | 'M' | 'X'
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
}
export interface RawPlanDay { date: string; wd: string; phase: string; items: RawPlanItem[]; /** what was done on a free day */ note?: string }
export interface StudyPlanJson {
  _readme: string
  meta: {
    studyWindow: string
    day0: string
    revision: string[]
    rest: string
    exam: string
    timezone: string
    kinds: Record<Kind, string>
    phases: { name: string; range: string; about: string }[]
    dailyMethod: string[]
    ifBehind: string[]
    endgame: { date: string; what: string }[]
    intentionallyExcluded: string[]
  }
  days: RawPlanDay[]
  trackerChanges: [PlanSubject, string, number, number, string?][]
}

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
