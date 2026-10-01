// Short lines to keep going. Shown as you progress through a block and when a block is complete.
export interface Quote {
  text: string
  by: string
}
export const QUOTES: Quote[] = [
  { text: 'Talent without working hard is nothing.', by: 'Cristiano Ronaldo' },
  { text: 'Dreams are not what you see in your sleep. Dreams are things which do not let you sleep.', by: 'Cristiano Ronaldo' },
  { text: 'I am not a perfectionist, but I like to feel that things are done well.', by: 'Cristiano Ronaldo' },
  { text: 'There is no harm in dreaming of becoming the world’s best. It’s all about trying to be the best.', by: 'Cristiano Ronaldo' },
  { text: 'Your love makes me strong. Your hate makes me unstoppable.', by: 'Cristiano Ronaldo' },
  { text: 'I’m not gonna run away. I never go back on my word. That’s my ninja way.', by: 'Naruto Uzumaki' },
  { text: 'Hard work is worthless for those that don’t believe in themselves.', by: 'Naruto Uzumaki' },
  { text: 'A dropout will beat a genius through hard work.', by: 'Rock Lee' },
  { text: 'Surpass your limits. Right here, right now!', by: 'Yami Sukehiro' },
  { text: 'Not giving up is my magic!', by: 'Asta' },
  { text: 'I may not have magic, but I won’t give up.', by: 'Asta' },
]
export const DONE_QUOTES: Quote[] = [
  { text: 'We don’t want to tell our dreams. We want to show them.', by: 'Cristiano Ronaldo' },
  { text: 'I don’t mind people hating me, because it pushes me.', by: 'Cristiano Ronaldo' },
  { text: 'Surpass your limits. Right here, right now!', by: 'Yami Sukehiro' },
  { text: 'I never go back on my word. That’s my ninja way.', by: 'Naruto Uzumaki' },
  { text: 'Not giving up is my magic!', by: 'Asta' },
]
export const pickQuote = (list: Quote[], seed?: number) => list[Math.abs(seed ?? Math.floor(Math.random() * 1e9)) % list.length]
