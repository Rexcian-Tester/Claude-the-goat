// The JSON files are imported as-is from site-source/. Never copy or edit them.
import planJson from '../../site-source/data/study-plan.json'
import mapJson from '../../site-source/data/priority-map.json'
import extrasJson from '../../site-source/data/priority-extras.json'
import artifactsJson from '../../site-source/data/artifacts.json'
import examsJson from '../../site-source/data/exams.json'
import type { ArtifactsJson, ExamsJson, PriorityExtrasJson, PriorityMapJson, StudyPlanJson } from './types'

export const studyPlan = planJson as unknown as StudyPlanJson
export const priorityMap = mapJson as unknown as PriorityMapJson
export const extras = extrasJson as unknown as PriorityExtrasJson
export const artifactsData = artifactsJson as unknown as ArtifactsJson
export const examsData = examsJson as unknown as ExamsJson
