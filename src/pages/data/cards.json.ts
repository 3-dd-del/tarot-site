import type { APIRoute } from 'astro'

import { loadCards } from '../../lib/cards'

/** 抽牌岛与每日一牌共用的静态数据文件，构建期生成，按需加载。 */
export const GET: APIRoute = async () => {
  const cards = await loadCards()
  return new Response(JSON.stringify(cards), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
