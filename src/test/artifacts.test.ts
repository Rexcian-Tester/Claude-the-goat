import { describe, expect, it } from 'vitest'
import { artifactChapters, artifactsForPlan, findArtifact, readyCount } from '../data/artifacts'
import { planDays } from '../data/plan'

describe('study artifacts (artifacts.json)', () => {
  it('lists the 51 syllabus chapters, each with a link exactly when ready', () => {
    expect(artifactChapters).toHaveLength(51)
    for (const c of artifactChapters) {
      expect(['ready', 'coming-soon', 'none']).toContain(c.status)
      if (c.status === 'ready') expect(c.link).toMatch(/^https:\/\//)
      for (const e of c.extras) expect(e.url).toMatch(/^https:\/\//)
    }
    // chapter order is unique within a subject and paper
    const keys = artifactChapters.map((c) => `${c.subject}${c.paper}.${c.no}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('counts ready artifacts per subject', () => {
    expect(readyCount('Phy')).toEqual({ ready: 19, total: 21 })
    expect(readyCount('Chem')).toEqual({ ready: 7, total: 10 })
    expect(readyCount('Math')).toEqual({ ready: 17, total: 20 })
    expect(readyCount('Eng')).toEqual({ ready: 0, total: 0 })
    expect(artifactChapters.filter((c) => c.skipped).map((c) => c.name).sort()).toEqual(['বাস্তব সংখ্যা ও অসমতা', 'যোগাশ্রয়ী প্রোগ্রাম'].sort())
  })

  it('matches every plan chapter by its Bangla name (only the revision days have none)', () => {
    const missing = new Set<string>()
    for (const d of planDays) for (const it of d.items) if (it.s !== 'R' && it.s !== 'X' && !artifactsForPlan(it).length) missing.add(it.ch)
    expect([...missing]).toEqual([])
  })

  it('names that differ slightly still match, and only the right chapter', () => {
    expect(findArtifact('Phy', 'ভৌত জগৎ ও পরিমাপ')?.no).toBe(1)
    expect(findArtifact('Phy', 'পরমাণুর মডেল এবং নিউক্লিয়ার পদার্থবিজ্ঞান')?.name).toBe('পরমাণুর মডেল ও নিউক্লিয়ার পদার্থবিজ্ঞান')
    expect(findArtifact('Phy', 'তড়িৎ চৌম্বক আবেশ ও পরিবর্তী প্রবাহ')?.name).toBe('তড়িৎচৌম্বকীয় আবেশ ও পরবর্তী প্রবাহ')
    expect(findArtifact('Math', 'যোগজীকরণ-1')?.name).toBe('যোগজীকরণ')
    expect(findArtifact('Phy', 'স্থির তড়িৎ')?.name).toBe('স্থির তড়িৎ')
    expect(findArtifact('Phy', 'চল তড়িৎ')?.name).toBe('চল তড়িৎ')
    expect(findArtifact('Math', 'কোনো অজানা অধ্যায়')).toBeUndefined()
  })

  it('ভেক্টর in the plan is the Physics one; two-chapter days get both', () => {
    expect(artifactsForPlan({ s: 'P', ch: 'ভেক্টর' }).map((c) => c.subject)).toEqual(['Phy'])
    expect(artifactsForPlan({ s: 'M', ch: 'সরলরেখা ও কণিক' }).map((c) => c.name)).toEqual(['সরলরেখা', 'কণিক'])
    const second = artifactsForPlan({ s: 'M', ch: 'ত্রিকোণমিতিক অনুপাত ও সংযুক্ত কোণ', part: 'দিন ২/২ · সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত' })
    expect(second[0].name).toBe('সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত')
    const first = artifactsForPlan({ s: 'M', ch: 'ত্রিকোণমিতিক অনুপাত ও সংযুক্ত কোণ', part: 'দিন ১/২ · ত্রিকোণমিতিক অনুপাত' })
    expect(first[0].name).toBe('ত্রিকোণমিতিক অনুপাত')
    expect(artifactsForPlan({ s: 'R', ch: 'রিভিশন' })).toEqual([])
  })
})
