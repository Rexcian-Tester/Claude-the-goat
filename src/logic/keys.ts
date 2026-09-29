// Field keys in the progress document. Prefixes are allow-listed in src/sync/merge.ts (KEY_RE).
export const K = {
  task: (date: string, item: number, i: number) => `task:${date}:${item}:${i}`,
  /** '' | 'cleared' | ISO date of the catch-up day it was moved to */
  moved: (date: string, item: number, i: number) => `task-moved:${date}:${item}:${i}`,
  dayDone: (date: string) => `day:${date}:done`,
  dayLeft: (date: string) => `day:${date}:left`,
  refl: (date: string, f: 'hours' | 'focus' | 'well' | 'blocked' | 'first') => `refl:${date}:${f}`,
  qStatus: (id: string) => `q:${id}:status`,
  qNote: (id: string) => `q:${id}:note`,
  sub: (subId: string, kind: 'understood' | 'practised' | 'mist') => `sub:${subId}:${kind}`,
  conf: (chId: string) => `ch:${chId}:confidence`,
  formula: (chId: string) => `ch:${chId}:formula`,
  shift: 'plan:shift',
  paper: (id: string) => `endgame:papers:${id}`,
  exam: (id: string) => `endgame:exam:${id}`,
  rev: (id: string) => `endgame:rev:${id}`,
  examCustom: 'endgame:examlist',
  note: (id: string) => `note:${id}`,
  /** calendar date (Asia/Dhaka): 'yes' | 'close' | 'no', answer to "did you complete today's goal?" */
  goal: (date: string) => `day:${date}:goal`,
  /** calendar date: a standing reminder ticked off for that day */
  rem: (date: string, id: string) => `day:${date}:rem:${id}`,
  /** calendar date: a block of the daily routine ticked off */
  routine: (date: string, id: string) => `day:${date}:routine:${id}`,
}
export type GoalAnswer = 'yes' | 'close' | 'no'
export type QStatus = 'unsolved' | 'solved' | 'wrong' | 'revisit'
export const Q_STATUSES: QStatus[] = ['unsolved', 'solved', 'wrong', 'revisit']
export type ReflField = 'hours' | 'focus' | 'well' | 'blocked' | 'first'
