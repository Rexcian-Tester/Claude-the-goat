import { fmt1, bn } from '../data/bn'
import type { Chapter } from '../data/types'
import { K } from '../logic/keys'
import { FieldCheck, QuestionRow } from './ui'

const TICKS: { kind: 'understood' | 'practised' | 'mist'; label: string }[] = [
  { kind: 'understood', label: 'বুঝেছি' },
  { kind: 'practised', label: 'অনুশীলন করেছি' },
  { kind: 'mist', label: 'MIST প্রশ্ন সমাধান করেছি' },
]

/** Ranked topics -> subtopics -> real questions. `ticks` adds the three self-rating ticks per subtopic. */
export function TopicTree({ chapter, focus, ticks }: { chapter: Chapter; focus?: string | null; ticks?: boolean }) {
  if (!chapter.topics.length)
    return <p className="never" style={{ border: 'none', padding: 0 }}>এই অধ্যায় থেকে বিশ্লেষণকৃত কোনো প্রশ্নপত্র বা মডেল টেস্টে প্রশ্ন আসেনি।</p>
  return (
    <div className="stack" style={{ gap: 16 }}>
      {chapter.topics.map((t, ti) => (
        <div key={t.id} className={`topic ${focus === t.id ? 'hl' : ''}`} id={`f-${t.id}`}>
          <h4>
            {bn(ti + 1)}. {t.n}
            <span className="c">আসল প্রশ্ন {fmt1(t.wr)} · {bn(t.years.length)}টি প্রশ্নপত্র{t.wm ? ` · মডেল টেস্ট ${fmt1(t.wm)}` : ''}</span>
          </h4>
          {t.subs.map((s) => {
            const only = s.wr === 0
            return (
              <div key={s.id} className={`sub ${focus === s.id ? 'hl' : ''}`} id={`f-${s.id}`}>
                <div className="sub-h">
                  <span className={`n ${only ? 'onlymt' : ''}`}>{only ? '–' : fmt1(s.wr) + '×'}</span>
                  <span className="s">{s.n}</span>
                </div>
                {ticks && (
                  <div className="sub-ticks">
                    {TICKS.map((x) => <FieldCheck key={x.kind} k={K.sub(s.id, x.kind)}>{x.label}</FieldCheck>)}
                  </div>
                )}
                <div className="sub-qs">{s.qs.map((q) => <QuestionRow key={q.id} q={q} focus={focus} />)}</div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
