/**
 * 抽牌随机性：用 crypto.getRandomValues，不用 Math.random。
 * 结果在翻牌动画开始前就计算完成，动画只负责呈现（产品设计文档 5.3）。
 */

export type RandomSource = (max: number) => number

/** 无偏取整：拒绝采样，避免取模带来的分布偏差。 */
export function cryptoRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`max 必须是正整数，收到 ${max}`)
  }
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('当前环境不支持 crypto.getRandomValues')
  }

  const limit = Math.floor(0xffffffff / max) * max
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    cryptoApi.getRandomValues(buffer)
    value = buffer[0] ?? 0
  } while (value >= limit)

  return value % max
}

export function pickOne<T>(items: readonly T[], random: RandomSource = cryptoRandomInt): T {
  if (items.length === 0) {
    throw new RangeError('抽牌池是空的')
  }
  return items[random(items.length)] as T
}

/** 时间戳，抽牌时一并记录，用于当天重抽限制与可追溯性。 */
export function nowStamp(clock: () => number = Date.now): number {
  return clock()
}
