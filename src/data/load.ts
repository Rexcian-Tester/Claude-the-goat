// The three JSON files are imported as-is from site-source/. Never copy or edit them.
import planJson from '../../site-source/data/study-plan.json'
import mapJson from '../../site-source/data/priority-map.json'
import extrasJson from '../../site-source/data/priority-extras.json'
import type { PriorityExtrasJson, PriorityMapJson, StudyPlanJson } from './types'

export const studyPlan = planJson as unknown as StudyPlanJson
export const priorityMap = mapJson as unknown as PriorityMapJson
export const extras = extrasJson as unknown as PriorityExtrasJson
