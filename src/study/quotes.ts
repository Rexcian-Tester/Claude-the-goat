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

/* CR7 on the Progress page: lines about Ronaldo (not his own words). Comeback lines when you are behind,
 * standard-keeping lines when you are on plan or ahead. */
const ON = 'On CR7'
export const CR7_COMEBACK: Quote[] = [
  { text: 'At 12 he left Madeira for Lisbon, alone and homesick, and got teased for his accent. He answered with work, not words.', by: ON },
  { text: 'In the Euro 2016 final he went off injured early. He spent the rest of it on the touchline, driving his team to the trophy.', by: ON },
  { text: 'He missed his penalty in the 2008 Champions League final shootout. United still won, and he never stopped stepping up to take the next one.', by: ON },
  { text: 'As a teenager he needed heart surgery. Soon after, he was back on the pitch. A bad week is not the end of the story.', by: ON },
  { text: 'They called him a show-off with no end product. He became the top scorer in Champions League history. Let the results answer.', by: ON },
]
export const CR7_STANDARD: Quote[] = [
  { text: 'Teammates tell the same story: first into training, last to leave. That is the whole secret.', by: ON },
  { text: 'Even at the top he kept adding to his game: weaker foot, headers, free kicks. Never satisfied with yesterday’s level.', by: ON },
  { text: 'He didn’t wait to feel motivated. He built habits that didn’t need motivation.', by: ON },
  { text: 'He built a skinny winger into a machine one session at a time. One session at a time is how chapters get finished too.', by: ON },
  { text: 'Seven isn’t just a number on a shirt. It’s what discipline looks like every single day.', by: ON },
]
