/**
 * 小阿卡纳的语境层不逐条撰写，改用生成规则（产品设计文档 5.2）：
 * 语境解读 = 花色倾向（领域）× 数字阶段（1–10 的含义）× 牌义核心。
 * 这样 280 条的工作量压缩到十几条规则，且口径一致。
 */

import type { CategoryId } from './questions'

export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles'

export const SUIT_LABELS: Record<Suit, string> = {
  wands: '权杖',
  cups: '圣杯',
  swords: '宝剑',
  pentacles: '星币',
}

export const SUIT_ELEMENT: Record<Suit, string> = {
  wands: '火',
  cups: '水',
  swords: '风',
  pentacles: '土',
}

/** 花色倾向：这张牌带来的底色是什么。 */
export const SUIT_DOMAIN: Record<Suit, string> = {
  wands: '权杖的底色是行动与热情，它关心的是你还想不想往前走',
  cups: '圣杯的底色是感受与联结，它关心的是你心里真实的温度',
  swords: '宝剑的底色是想法与判断，它关心的是你有没有把话说清楚、把事想明白',
  pentacles: '星币的底色是现实条件，它关心的是时间、身体、钱这些摸得到的东西',
}

/** 数字阶段：1–10 的阶段含义，宫廷牌单独给一组。 */
export const NUMBER_STAGE: Record<number, string> = {
  1: '数字 1 是一粒刚落到手里的种子，事情还在起点，方向比速度重要',
  2: '数字 2 是站在两个方向中间的犹豫，选择本身就是这一阶段的功课',
  3: '数字 3 是第一次看到回音的时候，事情开始有形状，但还不稳',
  4: '数字 4 是需要稳住的时候，安全和停滞常常只差一线',
  5: '数字 5 往往伴随着摩擦与失衡，难受是真的，但它也在告诉你哪里出了问题',
  6: '数字 6 是关系回暖、愿意给出的时候，给予与消耗要分清楚',
  7: '数字 7 需要停一停，看得更清楚一点，再决定要不要继续',
  8: '数字 8 是提速的阶段，反复出现的细节里藏着真正的关键',
  9: '数字 9 接近一段路的尾声，你已经走了很远，也背了不少东西',
  10: '数字 10 是一个周期的完成，同时也是下一轮的起点',
  11: '侍从代表的是一种刚起步的态度：好奇、试探、还不熟练',
  12: '骑士代表行动的推进方式：它更多在讲节奏，而不是结果',
  13: '王后代表的是一种向内的成熟：先照顾好自己，再谈别的',
  14: '国王代表的是承担与掌控：你在这件事里愿意负起多少责任',
}

/** 语境落点：把牌放进用户提问的领域里，避免同一段话套在所有问题上。 */
export const CATEGORY_LENS: Record<CategoryId, string> = {
  love: '放回你们的关系里看，',
  career: '放回你每天实际在做的事情上看，',
  study: '放回你眼下要完成的学习任务上看，',
  money: '放回你的收支与资源上看，',
  decision: '放回这个选择本身看，',
  self: '放回你最近的状态上看，',
  relation: '放回你和这个人之间的相处上看，',
  now: '放回这段时间的整体节奏上看，',
}

/** 取牌义核心：正文里最凝练的那句。 */
export function coreMeaning(meaning: string): string {
  const plain = meaning.replace(/\s+/g, '').trim()
  if (!plain) return ''
  const parts = plain.split(/(?<=[。！？])/).filter(Boolean)
  return (parts[0] ?? plain).replace(/。$/, '')
}

/**
 * 生成小阿卡纳的语境解读。
 * @param suit 花色
 * @param number 1–14
 * @param meaning 牌义核心（MDX 正文的「通用含义」）
 * @param categoryId 一级问题分类
 */
export function minorScene(
  suit: Suit,
  number: number,
  meaning: string,
  categoryId: CategoryId,
): string {
  const stage = NUMBER_STAGE[number] ?? NUMBER_STAGE[1]
  const core = coreMeaning(meaning)
  return `${CATEGORY_LENS[categoryId]}${SUIT_DOMAIN[suit]}，${stage}。落回你的问题，它想说的是：${core}。`
}
